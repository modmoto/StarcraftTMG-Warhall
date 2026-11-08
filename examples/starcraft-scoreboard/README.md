# StarCraft map scoreboard

An interactive scoreboard built entirely from Unity UI at runtime. It uses a world-space Canvas, RectTransforms, Images and Text with Unity's built-in LegacyRuntime.ttf font. No scoreboard image, model, texture, skin registration or downloaded asset is required.

Copy [StarcraftScoreboard.cs](StarcraftScoreboard.cs) into the game assembly. Dependencies: existing Warhall TerrainItem and InputManager classes; UnityEngine.CoreModule, UIModule, UI, TextRenderingModule, PhysicsModule, InputLegacyModule, PhotonUnityNetworking, PhotonRealtime and Photon3Unity3D. This is source-level integration; the local prototype used Mono.Cecil to inject the same calls.

## Demonstration

![StarCraft scoreboard demonstration](scoreboard-demo.gif)

## Behavior

- Only the StarCraft terrain ID `Starcraft - Terrain - Scoreboard - score1` activates the board. Other terrain IDs keep their native behavior.
- The original terrain scoreboard stays on the left, using its normal skin/model path. Unpatched players retain that original board; patched players also see the interactive board on the right. The two scoreboards do not share counters.
- The board sits outside the right map edge, between the two token trays, facing the battlefield. It measures 40 × 28.4 cm. Round 1 is at the bottom; round 5 at the top.
- Each side has Supply and Mission points for every round. Left-click increases a value; right-click decreases it, with a minimum of zero.
- The large totals automatically sum both point columns across all five rounds.
- Current Supply is independently adjustable per side, initially 0 / 6. Global Supply is the shared denominator, initially 6. Changing the denominator does not change current values.
- The small **← →** button between the totals swaps blue/red styling, including headings, outlines and column backgrounds. Scores and supply values stay in their current positions. Left-click again to restore the original colors.
- There is no title, player-name banner or mouse-instruction footer.

## Integration hooks

Preserve native method bodies and apply these hooks only when this feature is enabled.

| Location | Insertion |
| --- | --- |
| `InputManager.Update()` | Before native input processing and before the leading-movement hook: `if (StarcraftScoreboard.Tick()) return;` |

Keep native terrain configuration and skin loading unchanged. Tick discovers the existing scoreboard terrain by its WDS ID and attaches a new Canvas without hiding its original renderers or colliders. It follows the final anchor position after map placement.

Tick raycasts the active camera onto the UI plane, converts the hit to local pixel coordinates, and dispatches clicks to numeric cells or the color-swap button. Consumed clicks return before native model dragging or camera rotation. No GraphicRaycaster or EventSystem button listener is needed in this prototype.

World orientation matters: with Warhall's map coordinates, the right tray is on **negative world X**. The Canvas uses Euler rotation (90, -90, 0). The current placement infers the battlefield edge from the old left scoreboard's anchor; production should use the actual battlefield bounds instead.

## Tokens and deployment

Token placement belongs to deployment data or a separate import. The scoreboard does not create, reposition, hide or deduplicate tokens. It only handles its own UI and counters. Tokens and the original scoreboard use Warhall’s normal catalogue skins and model/texture assets; the patch does not override their loading.

## Photon synchronization

All helpers are nested in **StarcraftScoreboard.cs**; no second source file, custom RPC registration or new backend is needed.

Each scoreboard uses its existing terrain PhotonView.ViewID as a stable room-local identity. State is stored in the room property `sc.scoreboard.v1.<viewId>`: a revision plus 24 values (20 round fields, two current-supply values, global supply and the color-swap flag). The Master Client initializes missing state once. Both players, including the Master Client, need this patch to use the shared board.

Clicks enqueue deltas, not absolute values. The client serializes one command at a time with Photon SetCustomProperties and an expected previous state (compare-and-swap). The server accepts only an unchanged revision. Concurrent edits retry against the latest state after 750 ms. Each client has a separate acknowledgement property keyed by a random session identifier, updated atomically with state; retries are therefore not counted twice. The UI displays accepted room state rather than optimistic network values.

Tick polls Photon's synchronized room-property cache. Late joiners read the current board state from that same cache. Standalone/offline mode changes local state directly. Spectators can view the board but the UI blocks their edits. Current Supply, Global Supply, round points and color swaps all follow this same path.

The state decoder validates field count, format and ranges. Values are clamped to 0–1,000,000; totals are derived locally. The implementation follows [Photon's Custom Properties / CAS model](https://doc.photonengine.com/pun/current/gameplay/synchronization-and-state).

## Persistence and verification

Photon room state survives client joins while the room exists. It is **not** written into Warhall saved games and is not part of Undo/Redo. Recreating the terrain gives it a new PhotonView identity and a fresh score; room properties for old views are not automatically pruned. Production integration should connect state to Warhall save/load, clean up old room keys and replace the placement heuristic with actual map bounds.

Pure state and simulated-transport tests cover validation, zero clamps, serialization, concurrent increments, conflicting CAS retries without double counting, late join and synchronized color swaps. Native compilation and local DLL injection were checked. A real two-client game, reconnects, Master Client handover and Windows gameplay still need verification.

Verify five-round totals, left/right clicks, shared denominator, color swap preserving values, the original left board remaining visible, 54×36 and 36×36 maps, unchanged deployment tokens, and no activation in other game systems. The original board still requires its normal catalogue skin on unpatched clients; the patch does not replace missing skins.

The production installer patches the existing app directly, without prompts. It leaves the native executable, launcher and asset loading unchanged, keeps a hash-checked original DLL backup, and writes WarhallCommunityPatch.log beside the patcher. See [the installer guide](../../tools/client-patch/README.md).

Token trays remain deployment/map data, never runtime scoreboard arrangement. The tray generator now places the outer activation row flush with each battlefield end, using its actual 25 mm diameter. It preserves all 56 tokens, their IDs, X positions, rotations and group spacing. This applies equally to 36-inch Skirmish boards. Reload the updated Test map to obtain the new positions; existing placed tokens are not moved or duplicated.
