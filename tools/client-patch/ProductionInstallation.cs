using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Win32;
using Mono.Cecil;

public static class ProductionInstallation
{
    private const string Version = "1.0.3";

    public static string Resolve(string? requested)
    {
        if (requested != null)
        {
            var path = Path.GetFullPath(requested.Trim().Trim('"', '\'').Replace("\\ ", " "))
                .TrimEnd(Path.DirectorySeparatorChar);
            if (File.Exists(path) && path.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                path = Path.GetDirectoryName(path)!;
            ValidateProduction(path);
            return path;
        }
        if (OperatingSystem.IsMacOS())
        {
            foreach (var path in new[] { "/Applications/Warhall.app",
                         Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Applications", "Warhall.app") })
                if (Directory.Exists(path)) { ValidateProduction(path); return path; }
        }
        else if (OperatingSystem.IsWindows())
        {
            var roots = new List<string>();
            foreach (var parent in new[]
                     {
                         Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                         Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                         Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                         Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs")
                     }.Where(Directory.Exists))
            {
                if (File.Exists(Path.Combine(parent, "Warhall.exe"))) roots.Add(parent);
                roots.AddRange(SafeDirectories(parent).Where(p =>
                    Path.GetFileName(p).Contains("Warhall", StringComparison.OrdinalIgnoreCase)));
            }
            roots.AddRange(RegistryLocations());
            foreach (var location in roots.ToArray())
            {
                var parent = Directory.GetParent(location)?.FullName;
                if (parent != null && File.Exists(Path.Combine(parent, "Warhall.exe"))) roots.Add(parent);
            }
            foreach (var root in roots.Distinct(StringComparer.OrdinalIgnoreCase))
                foreach (var path in Descendants(root, 2))
                    if (File.Exists(Path.Combine(path, "Warhall.exe")))
                    {
                        try { ValidateProduction(path); return Path.GetFullPath(path); }
                        catch (IOException) { }
                    }
        }
        throw new DirectoryNotFoundException(
            "Production Warhall was not found. No prompt is shown. Install it first, or use --source <production app/EXE/folder>.");
    }

    private static IEnumerable<string> SafeDirectories(string path)
    {
        try { return Directory.GetDirectories(path); }
        catch (IOException) { return []; }
        catch (UnauthorizedAccessException) { return []; }
    }

    private static IEnumerable<string> Descendants(string root, int depth)
    {
        if (!Directory.Exists(root) || Path.GetFileName(root).Contains("Test", StringComparison.OrdinalIgnoreCase)) yield break;
        yield return root;
        if (depth == 0) yield break;
        foreach (var child in SafeDirectories(root))
            foreach (var path in Descendants(child, depth - 1)) yield return path;
    }

    private static List<string> RegistryLocations()
    {
        var locations = new List<string>();
        if (!OperatingSystem.IsWindows()) return locations;
        foreach (var hive in new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine })
            foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
                try
                {
                    using var root = RegistryKey.OpenBaseKey(hive, view);
                    using var uninstall = root.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall");
                    if (uninstall == null) continue;
                    foreach (var name in uninstall.GetSubKeyNames())
                    {
                        using var item = uninstall.OpenSubKey(name);
                        var display = item?.GetValue("DisplayName") as string ?? "";
                        if (!display.Contains("Warhall", StringComparison.OrdinalIgnoreCase) ||
                            display.Contains("Test", StringComparison.OrdinalIgnoreCase)) continue;
                        if (item?.GetValue("InstallLocation") is string location && Directory.Exists(location))
                            locations.Add(location);
                        if (item?.GetValue("DisplayIcon") is string icon)
                        {
                            var executable = icon.Split(',')[0].Trim().Trim('"');
                            if (File.Exists(executable)) locations.Add(Path.GetDirectoryName(executable)!);
                        }
                    }
                }
                catch (Exception exception) when (exception is UnauthorizedAccessException or IOException or System.Security.SecurityException)
                { Console.WriteLine("Registry discovery skipped: " + exception.Message); }
        return locations;
    }

    private static void ValidateProduction(string root)
    {
        if (!Directory.Exists(root)) throw new DirectoryNotFoundException(root);
        if (OperatingSystem.IsMacOS())
        {
            var plist = Path.Combine(root, "Contents", "Info.plist");
            var start = new ProcessStartInfo("/usr/libexec/PlistBuddy")
                { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
            foreach (var arg in new[] { "-c", "Print :CFBundleIdentifier", plist }) start.ArgumentList.Add(arg);
            using var process = Process.Start(start)!;
            var identifier = process.StandardOutput.ReadToEnd().Trim();
            var error = process.StandardError.ReadToEnd();
            process.WaitForExit();
            if (process.ExitCode != 0 || identifier != "com.Greenfeet.Warhall")
                throw new IOException("Only the original production Warhall app is supported; Test and community copies are rejected. " + error);
        }
        else if (OperatingSystem.IsWindows())
        {
            if (!File.Exists(Path.Combine(root, "Warhall.exe")) || !Directory.Exists(Path.Combine(root, "Warhall_Data")))
                throw new IOException("Only the production folder with Warhall.exe and Warhall_Data is supported.");
        }
        else throw new PlatformNotSupportedException("Only macOS and Windows are supported.");
        if (!File.Exists(Path.Combine(Managed(root), "Assembly-CSharp.dll")))
            throw new IOException("The selected game has no managed Assembly-CSharp.dll.");
    }

    private static string Managed(string root) => OperatingSystem.IsMacOS()
        ? Path.Combine(root, "Contents", "Resources", "Data", "Managed")
        : Path.Combine(root, "Warhall_Data", "Managed");

    private static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

    private static bool IsPatched(string path)
    {
        using var assembly = AssemblyDefinition.ReadAssembly(path);
        return assembly.MainModule.AssemblyReferences.Any(reference => reference.Name == "MovementPrototype");
    }

    private static void Replace(string destination, byte[] bytes)
    {
        var temporary = destination + ".community-" + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            File.WriteAllBytes(temporary, bytes);
            if (!OperatingSystem.IsWindows() && File.Exists(destination))
                File.SetUnixFileMode(temporary, File.GetUnixFileMode(destination));
            File.Move(temporary, destination, true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }

    public static void Install(string root, string[] supported, bool restore)
    {
        var managed = Managed(root);
        var target = Path.Combine(managed, "Assembly-CSharp.dll");
        var helper = Path.Combine(managed, "MovementPrototype.dll");
        var folder = Path.Combine(managed, ".WarhallCommunityPatch");
        var backup = Path.Combine(folder, "Assembly-CSharp.original.dll");
        var stateFile = Path.Combine(folder, "state.json");
        var priorStateBytes = File.Exists(stateFile) ? File.ReadAllBytes(stateFile) : null;
        var state = priorStateBytes == null ? null : JsonSerializer.Deserialize<InstallationState>(priorStateBytes)
            ?? throw new IOException("The backup metadata is invalid.");
        var baseline = state == null ? target : backup;
        if (state != null && (!File.Exists(backup) || Hash(File.ReadAllBytes(backup)) != state.OriginalHash))
            throw new IOException("The original backup is missing or changed. Nothing was patched.");
        var fingerprint = Compatibility.Fingerprint(baseline);
        if (!supported.Contains(fingerprint))
            throw new IOException("Unsupported production build. Nothing was patched. Fingerprint: " + fingerprint);
        var before = File.ReadAllBytes(target);
        var beforeHelper = File.Exists(helper) ? File.ReadAllBytes(helper) : null;
        var currentHash = Hash(before);
        if (state == null)
        {
            if (restore) throw new IOException("There is no backup for this installation.");
            if (beforeHelper != null) throw new IOException("An unrecognized MovementPrototype.dll already exists. Nothing was overwritten.");
        }
        else
        {
            if (currentHash != state.OriginalHash && currentHash != state.InstalledHash)
                throw new IOException("Warhall was updated or modified after this patch. Existing backup was retained; nothing was overwritten.");
            if (beforeHelper != null && Hash(beforeHelper) != state.HelperHash)
                throw new IOException("MovementPrototype.dll changed outside this installer. Nothing was overwritten.");
        }
        if (OperatingSystem.IsWindows())
        {
            try { using var exclusive = new FileStream(target, FileMode.Open, FileAccess.ReadWrite, FileShare.None); }
            catch (IOException exception) { throw new IOException("Close Warhall and rerun the patcher; the game DLL is locked.", exception); }
        }
        Directory.CreateDirectory(folder);
        using var installLock = new FileStream(Path.Combine(folder, "install.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        if (!File.Exists(backup))
        {
            File.Copy(target, backup);
            Console.WriteLine("Original DLL backed up: " + backup);
        }
        if (Hash(File.ReadAllBytes(backup)) != Hash(File.ReadAllBytes(baseline)))
            throw new IOException("Backup does not match the reviewed original.");
        byte[] result;
        byte[]? newHelper = null;
        var output = Path.Combine(managed, ".community-patched-" + Guid.NewGuid().ToString("N") + ".tmp");
        var helperInput = Path.Combine(managed, ".community-helper-" + Guid.NewGuid().ToString("N") + ".tmp");
        try
        {
            if (restore) result = File.ReadAllBytes(backup);
            else
            {
                using var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("Helper.dll")!;
                using var bytes = new MemoryStream();
                resource.CopyTo(bytes);
                newHelper = bytes.ToArray();
                File.WriteAllBytes(helperInput, newHelper);
                PatchEngine.Apply(backup, output, helperInput);
                result = File.ReadAllBytes(output);
            }
            var nextState = new InstallationState
            {
                Version = Version, OriginalHash = Hash(File.ReadAllBytes(backup)),
                InstalledHash = restore ? state!.InstalledHash : Hash(result),
                HelperHash = restore ? state!.HelperHash : Hash(newHelper!),
                OriginalFingerprint = fingerprint, Restored = restore
            };
            try
            {
                Replace(stateFile, JsonSerializer.SerializeToUtf8Bytes(nextState, new JsonSerializerOptions { WriteIndented = true }));
                if (newHelper != null) Replace(helper, newHelper);
                Replace(target, result);
                if (restore && File.Exists(helper)) File.Delete(helper);
            }
            catch (Exception exception)
            {
                Console.Error.WriteLine("Installation failed; rolling back the two DLL files.");
                try
                {
                    Replace(target, before);
                    if (beforeHelper == null) { if (File.Exists(helper)) File.Delete(helper); }
                    else Replace(helper, beforeHelper);
                    if (priorStateBytes == null) { if (File.Exists(stateFile)) File.Delete(stateFile); }
                    else Replace(stateFile, priorStateBytes);
                }
                catch (Exception rollback) { throw new AggregateException("Rollback failed; the original backup is retained.", exception, rollback); }
                throw;
            }
            if (Hash(File.ReadAllBytes(target)) != Hash(result)) throw new IOException("Installed DLL verification failed.");
            Console.WriteLine(restore ? "Original managed code restored." : "Production managed DLL patched.");
            Console.WriteLine("Installed DLL SHA256: " + Hash(result));
            Console.WriteLine("App path, executable, identity, Gate, launcher files and normal asset loading were left unchanged.");
        }
        finally
        {
            if (File.Exists(output)) File.Delete(output);
            if (File.Exists(helperInput)) File.Delete(helperInput);
        }
    }

    private sealed class InstallationState
    {
        public string Version { get; set; } = "";
        public string OriginalHash { get; set; } = "";
        public string InstalledHash { get; set; } = "";
        public string HelperHash { get; set; } = "";
        public string OriginalFingerprint { get; set; } = "";
        public bool Restored { get; set; }
    }
}
