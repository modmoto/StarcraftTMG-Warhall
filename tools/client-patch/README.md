# Warhall Community Patch 1.0.1

Adds leading-model movement, individual and selected-group dragging, and a shared StarCraft scoreboard. The scoreboard keeps its normal asset-free UI and uses the existing Photon room connection. The original terrain scoreboard stays on the left for clients without the patch.

## Install

1. Close Warhall. Download and extract the ZIP for your system from the GitHub release.
2. Windows: run **WarhallCommunityPatch.exe**. Mac: open **Install.command**.
3. Select the **original** Warhall game installation, not the launcher or an already patched copy. On Mac the suggested location is /Applications/WarhallTest.app; Windows accepts the game EXE or its containing folder.
4. The installer creates a separate copy in **Documents/Warhall Community/**. Start Warhall from that copy.

No Unity, C# SDK, .NET installation, Node or Python is required. The patcher includes its runtime. The original game installation remains untouched.

Only the reviewed Warhall Test 2.08 managed build is accepted. The installer checks a fingerprint of the affected classes and refuses other builds before copying or changing anything. A Windows build with different managed code is also refused; send its displayed fingerprint to the developer for review rather than bypassing the check.

The downloads are not Windows-code-signed or Apple-notarized; operating-system confirmation may appear. No administrator access is intended when writing to your Documents folder.

## Play

- Click a model: select the squad for the native wound counter.
- Drag a model: move it individually; on release, reselect the squad.
- Box-select multiple models, then drag one selected model: move the selected group together. A group drag retains its selection and does not trigger leader teleport.
- **L** toggles the clicked leading model. **Right-drag** sets and moves a leader in one gesture. Followers move forward within the 3-inch circle, or 4 inches with Squadron.
- The triangle resets model positions, orientations and the original leader.
- The new StarCraft scoreboard is on the right. Left/right clicks increase/decrease values. Global Supply starts at 6. The arrow button swaps player colors.
- Both clients, including the room's Master Client, need the patch for shared scoreboard state. Unpatched clients keep seeing the old left board; its counters are independent.

The patch does not intercept token or terrain asset loading, substitute skins, or arrange/create/deduplicate tokens. Warhall uses its normal catalogue assignments and assets; token placement belongs to deployment/import data.

## Reset or update

To return to the original game, simply start your untouched original installation.

To replace the community copy with original files, run the patcher with the same source/output and **--restore**:

```text
WarhallCommunityPatch --source "<original app or game folder>" --output "<community copy>" --restore
```

The installer only replaces an existing output folder carrying its own matching sidecar marker. It builds a new copy in a staging folder first. Keep the original installation available. After a Warhall update, use a matching new patch release; unsupported versions are rejected.

## Multiplayer and limits

Scoreboard state is synchronized through Photon room properties, including current supply, global supply and colors. Concurrent edits use compare-and-swap plus acknowledgements to prevent lost updates or double counting. Late joiners receive the current room values. Room state is not yet saved into Warhall saved games and counters have no Undo/Redo. A new scoreboard object starts fresh.

Placement still ignores terrain/other-unit collision and uses conservative circular approximations for non-round bases. Leader and reset snapshots are local session state.

Native Mac installation/signing and deterministic state/selection tests passed. The state tests use a simulated Photon server. Real two-client play, reconnects, Master Client handover and Windows gameplay have not yet been verified.

## Maintainer build

End users do not need these tools. Maintainers need Node, .NET SDK 8 and the reviewed original Warhall Managed folder.

Build the helper directly from the same developer examples used by the local app:

```sh
dotnet build tools/client-patch/runtime/MovementPrototype.csproj -c Release -p:GameManagedDir="/path/to/Managed" -o tools/client-patch/payload
node tools/client-patch/checks/run.mjs
dotnet publish tools/client-patch/ClientPatch.csproj -c Release -r win-x64 --self-contained true -p:RuntimeFrameworkVersion=8.0.33 -o .cache/client-patch/win-x64
dotnet publish tools/client-patch/ClientPatch.csproj -c Release -r osx-arm64 --self-contained true -p:RuntimeFrameworkVersion=8.0.33 -o .cache/client-patch/osx-arm64
dotnet publish tools/client-patch/ClientPatch.csproj -c Release -r osx-x64 --self-contained true -p:RuntimeFrameworkVersion=8.0.33 -o .cache/client-patch/osx-x64
```

`DOTNET_EXECUTABLE` can select another dotnet executable for the checks. Refresh the embedded payload before publishing. The supported.json fingerprint list is reviewed input; do not automatically accept unknown versions. `--fingerprint /path/to/Assembly-CSharp.dll` prints a build fingerprint without modifying the game.

The patcher modifies the user's own Assembly-CSharp.dll copy with Mono.Cecil. Downloads contain the patcher, its runtime and our helper DLL, not Warhall game assemblies. On Mac, the copied Gate resources are moved under Contents/Resources and their existing path literals adjusted so the copied app can be ad-hoc signed as a proper bundle.

Whenever movement or scoreboard changes, update the corresponding example source and README together, rebuild the helper and installer packages, and rerun the checks. All Photon helpers stay in the single StarcraftScoreboard.cs source file.
