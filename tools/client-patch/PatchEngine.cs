using Mono.Cecil;
using Mono.Cecil.Cil;

public static class PatchEngine
{
    private static void RegisterStarcraftParser(ModuleDefinition module, ModuleDefinition runtime)
    {
        var config = module.Types.Single(type => type.Name == "WDSGameConfig");
        var modes = config.NestedTypes.Single(type => type.Name == "ListParsingAlgorithmMode");
        const int starcraftMode = 7;
        if (modes.Fields.Any(field => field.HasConstant && (int)field.Constant == starcraftMode))
            throw new InvalidOperationException("Warhall already uses list parsing mode 7.");
        modes.Fields.Add(new FieldDefinition("Starcraft",
            FieldAttributes.Public | FieldAttributes.Static | FieldAttributes.Literal | FieldAttributes.HasDefault,
            modes) { Constant = starcraftMode });

        var factory = module.Types.Single(type => type.Name == "WdsUnitParser")
            .Methods.Single(method => method.Name == "CreateParser" && method.Parameters.Count == 2);
        var current = module.Types.Single(type => type.Name == "WDSGameConfigAccess")
            .Methods.Single(method => method.Name == "get_Current");
        var mode = config.Methods.Single(method => method.Name == "get_ListParsingAlgorithm");
        var constructor = runtime.Types.Single(type => type.Name == "WdsUnitParserStarcraft")
            .Methods.Single(method => method.IsConstructor && !method.IsStatic);
        var il = factory.Body.GetILProcessor();
        var original = factory.Body.Instructions[0];
        il.InsertBefore(original, il.Create(OpCodes.Call, current));
        il.InsertBefore(original, il.Create(OpCodes.Callvirt, mode));
        il.InsertBefore(original, il.Create(OpCodes.Ldc_I4, starcraftMode));
        il.InsertBefore(original, il.Create(OpCodes.Bne_Un, original));
        il.InsertBefore(original, il.Create(OpCodes.Ldarg_1));
        il.InsertBefore(original, il.Create(OpCodes.Newobj, module.ImportReference(constructor)));
        il.InsertBefore(original, il.Create(OpCodes.Ret));

        var positionHook = module.ImportReference(constructor.DeclaringType.Methods
            .Single(method => method.Name == "PlaceImportedCard"));
        var army = module.Types.Single(type => type.Name == "WDSArmy");
        var cardPositionCalls = army.Methods.Where(method => method.HasBody)
            .SelectMany(method => method.Body.Instructions
                .Where(instruction => instruction.Operand is MethodReference called &&
                    called.DeclaringType.Name == "GameController" && called.Name == "CreateCard")
                .Select(instruction => (Method: method, Instruction: instruction)))
            .ToArray();
        if (cardPositionCalls.Length != 1)
            throw new InvalidOperationException("Expected exactly one native imported card positioning call.");
        var (_, cardPositionCall) = cardPositionCalls[0];
        cardPositionCall.OpCode = OpCodes.Call;
        cardPositionCall.Operand = positionHook;

        var deployBody = army.NestedTypes.Single(type => type.Name.StartsWith("<Deploy>", StringComparison.Ordinal))
            .Methods.Single(method => method.Name == "MoveNext").Body;
        var summonCall = deployBody.Instructions.Single(instruction =>
            instruction.Operand is MethodReference called && called.Name == "SummonUnit");
        var deployIl = deployBody.GetILProcessor();
        var duplicate = deployIl.Create(OpCodes.Dup);
        deployIl.InsertAfter(summonCall, duplicate);
        deployIl.InsertAfter(duplicate, deployIl.Create(OpCodes.Call,
            module.ImportReference(constructor.DeclaringType.Methods.Single(method => method.Name == "TrackImportedUnit"))));

        var controller = module.Types.Single(type => type.Name == "GameController");
        var deployment = controller.NestedTypes.Single(type => type.Name.StartsWith("<NewArmyDeployed>", StringComparison.Ordinal))
            .Methods.Single(method => method.Name == "MoveNext");
        var deployCall = deployment.Body.Instructions.Single(instruction =>
            instruction.Operand is MethodReference called && called.DeclaringType.FullName == "Gamelogic.Army" &&
            called.Name == "Deploy");
        deployCall.OpCode = OpCodes.Call;
        deployCall.Operand = module.ImportReference(constructor.DeclaringType.Methods
            .Single(method => method.Name == "DeployWithAdditionalLoads"));
    }

    public static void Apply(string inputPath, string outputPath, string helperPath)
    {
        var args = new[] { inputPath, outputPath, helperPath };
        if (args.Length != 3)
            throw new ArgumentException("Usage: Patcher input.dll output.dll MovementPrototype.dll");

        var resolver = new DefaultAssemblyResolver();
        resolver.AddSearchDirectory(Path.GetDirectoryName(Path.GetFullPath(args[0]))!);
        resolver.AddSearchDirectory(Path.GetDirectoryName(Path.GetFullPath(args[1]))!);
        using var assembly = AssemblyDefinition.ReadAssembly(args[0], new ReaderParameters { AssemblyResolver = resolver });
        int changed = 0;
        foreach (var type in assembly.MainModule.Types)
        {
            foreach (var method in type.Methods.Where(method => method.HasBody))
            {
                var processor = method.Body.GetILProcessor();
                foreach (var instruction in method.Body.Instructions.ToArray())
                {
                    if (instruction.OpCode != OpCodes.Ldfld ||
                        instruction.Operand is not FieldReference field ||
                        field.DeclaringType.Name != "InputManager" ||
                        field.Name != "_isSoldierSelectionCurrentMode")
                        continue;

                    instruction.OpCode = OpCodes.Pop;
                    instruction.Operand = null;
                    processor.InsertAfter(instruction, processor.Create(OpCodes.Ldc_I4_1));
                    Console.WriteLine($"Individual selection: {type.Name}.{method.Name}");
                    changed++;
                }
            }
        }
        var module = assembly.MainModule;
        var gameItem = module.Types.Single(type => type.Name == "GameItem");
        var soldier = module.Types.Single(type => type.Name == "Soldier");
        var input = module.Types.Single(type => type.Name == "InputManager");
        var mouseDown = input.Methods.Single(method => method.Name == "MouseDown");
        using var runtime = AssemblyDefinition.ReadAssembly(args[2]);
        RegisterStarcraftParser(module, runtime.MainModule);
        var hooks = runtime.MainModule.Types.Single(type => type.Name == "LeadingMovement");
        MethodReference Hook(string name) => module.ImportReference(hooks.Methods.Single(method => method.Name == name));
        void AtEntry(MethodDefinition method, string hook, bool argument, bool instance = false)
        {
            var processor = method.Body.GetILProcessor();
            var first = method.Body.Instructions[0];
            if (argument) processor.InsertBefore(first, processor.Create(instance ? OpCodes.Ldarg_0 : OpCodes.Ldarg_1));
            processor.InsertBefore(first, processor.Create(OpCodes.Call, Hook(hook)));
        }
        var redraw = gameItem.Methods.Single(method => method.Name == "RedrawShapeDrawer");
        var redrawIl = redraw.Body.GetILProcessor();
        var nativeRedraw = redraw.Body.Instructions[0];
        redrawIl.InsertBefore(nativeRedraw, redrawIl.Create(OpCodes.Ldarg_0));
        redrawIl.InsertBefore(nativeRedraw, redrawIl.Create(OpCodes.Call, Hook("ShouldRedraw")));
        redrawIl.InsertBefore(nativeRedraw, redrawIl.Create(OpCodes.Brtrue, nativeRedraw));
        redrawIl.InsertBefore(nativeRedraw, redrawIl.Create(OpCodes.Ret));
        AtEntry(mouseDown, "Click", true);
        var mouseDownIl = mouseDown.Body.GetILProcessor();
        var originalMouseDown = mouseDown.Body.Instructions.First(instruction => instruction.OpCode == OpCodes.Ldarg_0);
        mouseDownIl.InsertBefore(originalMouseDown, mouseDownIl.Create(OpCodes.Ldarg_1));
        mouseDownIl.InsertBefore(originalMouseDown, mouseDownIl.Create(OpCodes.Call, Hook("SelectionTarget")));
        mouseDownIl.InsertBefore(originalMouseDown, mouseDownIl.Create(OpCodes.Starg_S, mouseDown.Parameters[0]));
        AtEntry(input.Methods.Single(method => method.Name == "StartDrag"), "PrepareSingleDrag", true, true);
        var soldierDrag = soldier.Methods.Single(method => method.Name == "OnMouseDrag");
        var soldierDragIl = soldierDrag.Body.GetILProcessor();
        var nativeDrag = soldierDrag.Body.Instructions[0];
        soldierDragIl.InsertBefore(nativeDrag, soldierDragIl.Create(OpCodes.Ldarg_0));
        soldierDragIl.InsertBefore(nativeDrag, soldierDragIl.Create(OpCodes.Call, Hook("RequestDrag")));
        soldierDragIl.InsertBefore(nativeDrag, soldierDragIl.Create(OpCodes.Brfalse, nativeDrag));
        soldierDragIl.InsertBefore(nativeDrag, soldierDragIl.Create(OpCodes.Ret));

        AtEntry(input.Methods.Single(method => method.Name == "MouseEnter"), "Hover", true);
        AtEntry(input.Methods.Single(method => method.Name == "MouseExit"), "Leave", true);
        var update = input.Methods.Single(method => method.Name == "Update");
        var updateIl = update.Body.GetILProcessor();
        foreach (var ret in update.Body.Instructions.Where(instruction => instruction.OpCode == OpCodes.Ret).ToArray())
        {
            ret.OpCode = OpCodes.Ldarg_0;
            var call = updateIl.Create(OpCodes.Call, Hook("AfterInput"));
            updateIl.InsertAfter(ret, call);
            updateIl.InsertAfter(call, updateIl.Create(OpCodes.Ret));
        }

        AtEntry(input.Methods.Single(method => method.Name == "Update"), "Update", false);
        var shields = runtime.MainModule.Types.Single(type => type.Name == "StarcraftShields");
        foreach (var pair in new[] { ("RemoveHealthPoint", "Damage"), ("AddHealthPoint", "Heal") })
        {
            var method = input.Methods.Single(method => method.Name == pair.Item1 && method.Parameters.Count == 0);
            var il = method.Body.GetILProcessor();
            var first = method.Body.Instructions[0];
            il.InsertBefore(first, il.Create(OpCodes.Ldarg_0));
            il.InsertBefore(first, il.Create(OpCodes.Call, module.ImportReference(shields.Methods.Single(hook => hook.Name == pair.Item2))));
            il.InsertBefore(first, il.Create(OpCodes.Brfalse, first));
            il.InsertBefore(first, il.Create(OpCodes.Ret));
        }
        var shieldFirst = update.Body.Instructions[0];
        updateIl.InsertBefore(shieldFirst, updateIl.Create(OpCodes.Call, module.ImportReference(shields.Methods.Single(hook => hook.Name == "Tick"))));
        var scoreType = runtime.MainModule.Types.Single(type => type.Name == "StarcraftScoreboard");
        var scoreHook = module.ImportReference(scoreType.Methods.Single(method => method.Name == "Tick"));
        var scoreFirst = update.Body.Instructions[0];
        updateIl.InsertBefore(scoreFirst, updateIl.Create(OpCodes.Call, scoreHook));
        updateIl.InsertBefore(scoreFirst, updateIl.Create(OpCodes.Brfalse, scoreFirst));
        updateIl.InsertBefore(scoreFirst, updateIl.Create(OpCodes.Ret));
        AtEntry(soldier.Methods.Single(method => method.Name == "StartDrag"), "Begin", true, true);
        var endDrag = soldier.Methods.Single(method => method.Name == "EndDrag");
        var endIl = endDrag.Body.GetILProcessor();
        foreach (var ret in endDrag.Body.Instructions.Where(instruction => instruction.OpCode == OpCodes.Ret).ToArray())
        {
            ret.OpCode = OpCodes.Ldarg_0;
            var call = endIl.Create(OpCodes.Call, Hook("Finish"));
            endIl.InsertAfter(ret, call);
            endIl.InsertAfter(call, endIl.Create(OpCodes.Ret));
        }
        var markerType = module.Types.Single(type => type.Name == "CornerMarker");
        var capture = markerType.Methods.Single(method => method.Name == "OnPhotonInstantiate");
        var captureIl = capture.Body.GetILProcessor();
        foreach (var ret in capture.Body.Instructions.Where(instruction => instruction.OpCode == OpCodes.Ret).ToArray())
        {
            ret.OpCode = OpCodes.Ldarg_0;
            var call = captureIl.Create(OpCodes.Call, Hook("CaptureMarker"));
            captureIl.InsertAfter(ret, call);
            captureIl.InsertAfter(call, captureIl.Create(OpCodes.Ret));
        }
        var markerClick = markerType.Methods.Single(method => method.Name == "OnMouseDown");
        var markerIl = markerClick.Body.GetILProcessor();
        var nativeClick = markerClick.Body.Instructions[0];
        markerIl.InsertBefore(nativeClick, markerIl.Create(OpCodes.Ldarg_0));
        markerIl.InsertBefore(nativeClick, markerIl.Create(OpCodes.Call, Hook("RestoreMarker")));
        markerIl.InsertBefore(nativeClick, markerIl.Create(OpCodes.Brfalse, nativeClick));
        markerIl.InsertBefore(nativeClick, markerIl.Create(OpCodes.Ret));
        Console.WriteLine("Corner marker hooks: capture full model transforms and restore on click.");
        Console.WriteLine("Leading movement hooks: click, L key, start drag, finish drag.");
        if (changed != 4)
            throw new InvalidOperationException("No supported selection-mode reads found. Refusing to patch.");
        assembly.Write(args[1]);
        Console.WriteLine($"Patched {changed} selection-mode reads. Movement/reset methods retained.");
    }
}
