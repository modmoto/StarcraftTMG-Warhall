using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using Mono.Cecil;
using Mono.Cecil.Cil;

static string Payload(string name)
{
    using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)
        ?? throw new InvalidOperationException("Missing embedded file: " + name);
    using var reader = new StreamReader(stream);
    return reader.ReadToEnd();
}

static void Run(string executable, params string[] arguments)
{
    var start = new ProcessStartInfo(executable) { UseShellExecute = false };
    foreach (var argument in arguments) start.ArgumentList.Add(argument);
    using var process = Process.Start(start) ?? throw new IOException("Could not start " + executable);
    process.WaitForExit();
    if (process.ExitCode != 0) throw new IOException(executable + " failed: " + process.ExitCode);
}

static void CopyTree(string source, string destination)
{
    Directory.CreateDirectory(destination);
    foreach (var file in Directory.EnumerateFiles(source))
    {
        var target = Path.Combine(destination, Path.GetFileName(file));
        File.Copy(file, target, true);
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(target, File.GetUnixFileMode(file));
    }
    foreach (var directory in Directory.EnumerateDirectories(source))
    {
        var info = new DirectoryInfo(directory);
        var target = Path.Combine(destination, info.Name);
        if (info.LinkTarget != null) Directory.CreateSymbolicLink(target, info.LinkTarget);
        else CopyTree(directory, target);
    }
}

static string Managed(string root)
{
    if (root.EndsWith(".app", StringComparison.OrdinalIgnoreCase))
        return Path.Combine(root, "Contents", "Resources", "Data", "Managed");
    var directories = Directory.GetDirectories(root, "*_Data", SearchOption.TopDirectoryOnly);
    if (directories.Length != 1) throw new IOException("Select the game folder containing WarhallTest.exe and WarhallTest_Data.");
    return Path.Combine(directories[0], "Managed");
}

static void PrepareMac(string app, string assemblyPath)
{
    var resources = Path.Combine(app, "Contents", "Resources");
    foreach (var name in new[] { "Gate", "VersionInfo.json" })
    {
        var old = Path.Combine(app, name);
        var target = Path.Combine(resources, name);
        if (Directory.Exists(old)) { if (Directory.Exists(target)) Directory.Delete(target, true); Directory.Move(old, target); }
        else if (File.Exists(old)) File.Move(old, target, true);
    }
    using var resolver = new DefaultAssemblyResolver();
    resolver.AddSearchDirectory(Path.GetDirectoryName(assemblyPath)!);
    using var assembly = AssemblyDefinition.ReadAssembly(assemblyPath,
        new ReaderParameters { InMemory = true, AssemblyResolver = resolver });
    IEnumerable<TypeDefinition> AllTypes(IEnumerable<TypeDefinition> types)
    {
        foreach (var type in types) { yield return type; foreach (var child in AllTypes(type.NestedTypes)) yield return child; }
    }
    foreach (var type in AllTypes(assembly.MainModule.Types))
        foreach (var method in type.Methods.Where(m => m.HasBody))
            foreach (var instruction in method.Body.Instructions)
                if (instruction.OpCode == OpCodes.Ldstr && instruction.Operand is string value)
                    instruction.Operand = value.Replace("/../Gate", "/Resources/Gate")
                        .Replace("/../VersionInfo.json", "/Resources/VersionInfo.json");
    assembly.Write(assemblyPath);
    var plist = Path.Combine(app, "Contents", "Info.plist");
    Run("/usr/libexec/PlistBuddy", "-c", "Set :CFBundleIdentifier local.modmoto.WarhallCommunity", plist);
    Run("/usr/libexec/PlistBuddy", "-c", "Set :CFBundleName Warhall Community", plist);
    var displayCheck = new ProcessStartInfo("/usr/libexec/PlistBuddy")
        { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
    displayCheck.ArgumentList.Add("-c");
    displayCheck.ArgumentList.Add("Print :CFBundleDisplayName");
    displayCheck.ArgumentList.Add(plist);
    using (var check = Process.Start(displayCheck)!)
    {
        check.StandardOutput.ReadToEnd();
        check.StandardError.ReadToEnd();
        check.WaitForExit();
        Run("/usr/libexec/PlistBuddy", "-c", check.ExitCode == 0
            ? "Set :CFBundleDisplayName Warhall Community"
            : "Add :CFBundleDisplayName string Warhall Community", plist);
    }
    Run("/usr/bin/codesign", "--force", "--deep", "--sign", "-", app);
    Run("/usr/bin/codesign", "--verify", "--deep", "--strict", app);
}

try
{
    if (args.Length == 2 && args[0] == "--fingerprint")
    {
        Console.WriteLine(Compatibility.Fingerprint(args[1]));
        return;
    }
    Console.WriteLine("Warhall Community Patch 1.0.0 — movement + StarCraft scoreboard");
    Console.WriteLine("Creates a separate patched copy. Your original game is not modified.");
    Console.WriteLine("Close Warhall before continuing. No Unity or .NET installation is required.");
    string? source = null, output = null;
    var restore = false;
    for (var i = 0; i < args.Length; i++)
    {
        if (args[i] == "--restore") restore = true;
        else if (args[i] == "--source" && i + 1 < args.Length) source = args[++i];
        else if (args[i] == "--output" && i + 1 < args.Length) output = args[++i];
        else throw new ArgumentException("Use --source <original app/game folder> --output <new copy> [--restore].");
    }
    if (source == null)
    {
        var suggested = OperatingSystem.IsMacOS() && Directory.Exists("/Applications/WarhallTest.app")
            ? "/Applications/WarhallTest.app" : "";
        Console.WriteLine("Original Warhall app, EXE or game folder" + (suggested.Length > 0 ? " [" + suggested + "]" : "") + ":");
        source = Console.ReadLine()?.Trim().Trim('"', '\'');
        if (string.IsNullOrEmpty(source)) source = suggested;
    }
    if (string.IsNullOrWhiteSpace(source)) throw new ArgumentException("No game selected.");
    source = Path.GetFullPath(source.Replace("\\ ", " "));
    if (File.Exists(source) && source.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) source = Path.GetDirectoryName(source)!;
    if (!Directory.Exists(source)) throw new DirectoryNotFoundException(source);
    var managed = Managed(source);
    var original = Path.Combine(managed, "Assembly-CSharp.dll");
    var fingerprint = Compatibility.Fingerprint(original);
    var supported = JsonSerializer.Deserialize<string[]>(Payload("supported.json"))!;
    if (!supported.Contains(fingerprint))
        throw new InvalidOperationException("Unsupported Warhall build. Nothing was changed. Send the developer this fingerprint: " + fingerprint);
    var documents = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
    if (string.IsNullOrEmpty(documents)) documents = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    output ??= Path.Combine(documents, "Warhall Community", Path.GetFileName(source.TrimEnd(Path.DirectorySeparatorChar)));
    output = Path.GetFullPath(output);
    if (output.StartsWith(source.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) ||
        output.Equals(source, StringComparison.OrdinalIgnoreCase))
        throw new InvalidOperationException("Output must be a separate folder, outside the original installation.");
    var marker = output + ".community-patch.json";
    if (Directory.Exists(output))
    {
        if (!File.Exists(marker)) throw new IOException("Output folder already exists and is not a managed patch copy: " + output);
        var prior = JsonSerializer.Deserialize<Dictionary<string,string>>(File.ReadAllText(marker))!;
        if (!prior.TryGetValue("source", out var previousSource) || previousSource != source)
            throw new IOException("The existing copy belongs to a different original installation.");
    }
    Console.WriteLine("Creating " + output);
    var stage = output + ".building-" + Guid.NewGuid().ToString("N");
    try
    {
        CopyTree(source, stage);
        var targetManaged = source.EndsWith(".app", StringComparison.OrdinalIgnoreCase)
            ? Path.Combine(stage, "Contents", "Resources", "Data", "Managed")
            : Managed(stage);
        if (!restore)
        {
            var helper = Path.Combine(targetManaged, "MovementPrototype.dll");
            using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Helper.dll")!)
            using (var file = File.Create(helper)) stream.CopyTo(file);
            PatchEngine.Apply(original, Path.Combine(targetManaged, "Assembly-CSharp.dll"), helper);
            if (OperatingSystem.IsMacOS()) PrepareMac(stage, Path.Combine(targetManaged, "Assembly-CSharp.dll"));
        }
        if (Directory.Exists(output)) Directory.Delete(output, true);
        Directory.Move(stage, output);
        File.WriteAllText(marker, JsonSerializer.Serialize(new Dictionary<string,string>
        {
            ["source"] = source, ["fingerprint"] = fingerprint, ["version"] = restore ? "original" : "1.0.0"
        }, new JsonSerializerOptions { WriteIndented = true }));
    }
    catch { if (Directory.Exists(stage)) Directory.Delete(stage, true); throw; }
    Console.WriteLine(restore ? "Original files restored to the separate copy." : "Patch installed. Start the game from this copy:");
    Console.WriteLine(output);
    Console.WriteLine("To reset this copy, rerun with --restore and the same --source/--output.");
    if (args.Length == 0) { Console.WriteLine("Press Enter to close."); Console.ReadLine(); }
}
catch (Exception exception)
{
    Console.Error.WriteLine("ERROR: " + exception.Message);
    Environment.ExitCode = 1;
    if (args.Length == 0) { Console.Error.WriteLine("Press Enter to close."); Console.ReadLine(); }
}
