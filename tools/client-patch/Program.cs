using System.Reflection;
using System.Text;
using System.Text.Json;

var logPath = Path.Combine(AppContext.BaseDirectory, "WarhallCommunityPatch.log");
StreamWriter? log = null;
try
{
    log = new StreamWriter(logPath, append: true) { AutoFlush = true };
    var synchronizedLog = TextWriter.Synchronized(log);
    Console.SetOut(new TeeWriter(Console.Out, synchronizedLog));
    Console.SetError(new TeeWriter(Console.Error, synchronizedLog));
    Console.WriteLine($"\n=== {DateTimeOffset.Now:O} | Production patch 1.0.3 | {Environment.OSVersion} ===");
    if (args.Length == 2 && args[0] == "--fingerprint")
    {
        Console.WriteLine(Compatibility.Fingerprint(args[1]));
        return;
    }
    string? source = null;
    var restore = false;
    for (var i = 0; i < args.Length; i++)
    {
        if (args[i] == "--restore") restore = true;
        else if (args[i] == "--source" && i + 1 < args.Length) source = args[++i];
        else throw new ArgumentException("Supported options: --source <production app/EXE/folder> and --restore.");
    }
    var path = ProductionInstallation.Resolve(source);
    Console.WriteLine("Production Warhall: " + path);
    using var supportedStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("supported.json")!;
    var supported = JsonSerializer.Deserialize<string[]>(supportedStream)!;
    ProductionInstallation.Install(path, supported, restore);
    Console.WriteLine(restore
        ? "Original DLL restored. Start Warhall normally."
        : "Patch installed in the current app. Start Warhall normally; restart it if it is already open.");
    Console.WriteLine("Log: " + logPath);
}
catch (Exception exception)
{
    Console.Error.WriteLine("ERROR: " + exception);
    Console.Error.WriteLine("Log: " + logPath);
    Environment.ExitCode = 1;
}
finally
{
    log?.Flush();
}

sealed class TeeWriter(TextWriter terminal, TextWriter log) : TextWriter
{
    public override Encoding Encoding => Encoding.UTF8;
    public override void Write(char value) { terminal.Write(value); log.Write(value); }
    public override void Write(string? value) { terminal.Write(value); log.Write(value); }
    public override void WriteLine(string? value) { terminal.WriteLine(value); log.WriteLine(value); }
    public override void Flush() { terminal.Flush(); log.Flush(); }
}
