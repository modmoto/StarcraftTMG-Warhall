# Warhall Production Patch 1.0.3

Leading-model movement, shared StarCraft shields and a Photon-synchronized StarCraft scoreboard for the installed production game.

## Install

1. Download and extract the ZIP for Windows x64, macOS Apple Silicon or macOS Intel.
2. Close Warhall. Run **WarhallCommunityPatch.exe** on Windows or **Install.command** on Mac.
3. The patcher automatically finds **production Warhall**, backs up the original managed DLL and patches the installed app. There are no questions, confirmations or Enter prompts in the patcher.
4. Start **Warhall normally**, using the same app or launcher as before. No separate community app is created.

On Mac the normal target is /Applications/Warhall.app, then ~/Applications/Warhall.app. Windows checks production Warhall locations and registered install locations. Test installations and the older separate community copies are rejected. If automatic detection fails, the advanced --source option accepts the production app, EXE or game folder; it never opens an interactive prompt.

No Unity, C# SDK, .NET installation, Node or Python is required. The runtime is bundled. Only reviewed managed builds are accepted. The installed Mac production build V2.00 matches the reviewed core fingerprint. Unknown builds are rejected and their fingerprint is logged.

## Logs and errors

Every run appends to **WarhallCommunityPatch.log beside the patcher executable**, including timestamps, detected game path, checks, backup path, result and full errors. Send that file to the developer if installation fails. Logs and backups are not included in the download.

Failures exit with a nonzero status. Insufficient write permissions, unsupported builds, unrecognized modifications and a locked Windows game DLL cause an error rather than a question or automatic elevation. The patcher does not close a running game or bypass operating-system protections. OS authorization to run downloaded software is separate from the application's no-prompt behavior.

## Minimal changes and backup

Only two game files are installed/replaced:

- Managed/Assembly-CSharp.dll receives the movement/input hooks and the scoreboard Update hook.
- Managed/MovementPrototype.dll contains the feature implementation.

The original app path, native executable, bundle identity, Gate, version files, launcher and asset-loading methods remain unchanged. There is no copying of the entire app, no Gate relocation, no string rewriting, no renaming and no re-signing of the installed app.

Original code and installation metadata are retained under **Managed/.WarhallCommunityPatch/**. The original DLL is hash-checked before use. Re-running the patcher patches from this clean original, rather than stacking hooks on an already patched DLL. Temporary files are prepared before replacing the targets; failures during replacement restore the preceding DLLs. Unrecognized changes after installation are not silently overwritten.

## Restore and updates

Run **Restore.command** on Mac or **Restore.cmd** on Windows. It restores the backed-up original DLL in the same installation and removes the recognized helper. It also runs without prompts and writes the same log. The original backup remains available.

Advanced command-line options:

```text
WarhallCommunityPatch --source "<production app, EXE or game folder>"
WarhallCommunityPatch --source "<production app, EXE or game folder>" --restore
```

Warhall's updater may replace the modified files during an official update. Use a compatible new patch release afterwards. If the original build or helper changed unexpectedly, installation stops rather than applying old code or overwriting the backup.

## Play

- Click a model to select the squad for the native wound counter.
- Drag a model to move it individually; release reselects the squad.
- Box-select multiple models, then drag a selected model to move the selected group together. The selection stays intact and the leader teleport is suppressed for group drags.
- **L** toggles the clicked leader. **Right-drag** sets and moves a leader in one gesture. Followers move forward inside its 3-inch range, or 4 inches with Squadron.
- StarCraft shields are shared by the squad and read from its profile. Damage consumes shields before wounds; healing repairs wounds before restoring shields. The blue shield counter disappears at zero.
- Moving tokens no longer makes hidden radius circles visible. Intentionally enabled radii remain available.
- The triangle restores model positions, rotations and the original leader.
- The additional scoreboard on the right tracks Supply and Mission points across five rounds. Left/right clicks increase/decrease values. Global Supply starts at 6; the arrow button swaps player colors.
- Both clients, including the room's Master Client, need the patch for the shared scoreboard. The original left board remains available to unpatched players; its counters are independent.

The patch does not create, reposition or deduplicate tokens and does not replace missing skins. Tokens and assets remain the responsibility of normal deployment/import data and Warhall's catalogue.

## Verification and limits

Direct installation, repeated application, hash-preserving restore and refusal of Test were checked on a complete production-app fixture. A file comparison confirmed that only the original Assembly-CSharp.dll changed, with the helper and backup metadata added. The installed native executable and launcher files are unchanged.

Selection-path and simulated Photon tests cover group selection, counter validation, concurrency conflicts, retry deduplication, late join and color swaps. Real two-client play, reconnects, Master Client handover and Windows gameplay remain unverified. All players applying damage to shielded units need this patch. Shield room state is not stored in saved games; newly opened rooms start with full shields. Real multiplayer shield synchronization and casualty Undo/Redo remain unverified. See [developer integration](../../examples/unit-shields/README.md).

Scoreboard room state is not stored in Warhall saved games and has no Undo/Redo. Placement ignores terrain/other-unit collision.

## Maintainer build

Maintainers need .NET SDK 8, Node for the checks and the reviewed original production Managed folder. End users do not.

```sh
dotnet build tools/client-patch/runtime/MovementPrototype.csproj -c Release -p:GameManagedDir="/path/to/production/Managed" -o tools/client-patch/payload
node tools/client-patch/checks/run.mjs
node tools/client-patch/checks/install.mjs --patcher /path/to/built/WarhallCommunityPatch --source /path/to/original/Warhall.app
dotnet publish tools/client-patch/ClientPatch.csproj -c Release -r win-x64 --self-contained true -p:RuntimeFrameworkVersion=8.0.33 -o .cache/client-patch/win-x64
dotnet publish tools/client-patch/ClientPatch.csproj -c Release -r osx-arm64 --self-contained true -p:RuntimeFrameworkVersion=8.0.33 -o .cache/client-patch/osx-arm64
dotnet publish tools/client-patch/ClientPatch.csproj -c Release -r osx-x64 --self-contained true -p:RuntimeFrameworkVersion=8.0.33 -o .cache/client-patch/osx-x64
```

The helper is built directly from the maintained movement, shield and scoreboard examples. All Photon helpers stay in StarcraftScoreboard.cs. Refresh the embedded payload when feature code changes and update each example README with its implementation. DOTNET_EXECUTABLE selects the dotnet executable for the checks.

The supported.json fingerprints are reviewed input. --fingerprint /path/to/Assembly-CSharp.dll prints the native-build fingerprint without patching it. Do not automatically accept unknown builds. Downloads contain the patcher, its runtime and our helper, not original Warhall assemblies.
