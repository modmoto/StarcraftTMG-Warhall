using System.Security.Cryptography;
using System.Text;
using Mono.Cecil;
using Mono.Cecil.Cil;

public static class Compatibility
{
    private static readonly HashSet<string> Types = new()
    {
        "InputManager", "Soldier", "Unit", "GameItem", "CornerMarker", "Token",
        "TerrainItem", "ModelDBEntry", "ModelPart", "Cloud", "UndoRedo"
    };

    public static string Fingerprint(string path)
    {
        using var assembly = AssemblyDefinition.ReadAssembly(path);
        if (assembly.MainModule.AssemblyReferences.Any(a => a.Name == "MovementPrototype"))
            throw new InvalidOperationException("This installation is already patched. Select the original Warhall installation.");
        var text = new StringBuilder();
        void Append(string line) => text.Append(line).Append('\n');
        foreach (var type in assembly.MainModule.Types.Where(t => Types.Contains(t.Name))
                     .OrderBy(t => t.FullName, StringComparer.Ordinal))
        {
            Append(type.FullName);
            foreach (var field in type.Fields.OrderBy(f => f.FullName, StringComparer.Ordinal))
                Append(field.FullName);
            foreach (var method in type.Methods.OrderBy(m => m.FullName, StringComparer.Ordinal))
            {
                Append(method.FullName);
                if (!method.HasBody) continue;
                foreach (var local in method.Body.Variables) Append(local.VariableType.FullName);
                foreach (var instruction in method.Body.Instructions)
                    Append(instruction.ToString());
                foreach (var handler in method.Body.ExceptionHandlers)
                    Append($"{handler.HandlerType}:{handler.TryStart}:{handler.TryEnd}:{handler.HandlerStart}:{handler.HandlerEnd}:{handler.CatchType}");
            }
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text.ToString()))).ToLowerInvariant();
    }
}
