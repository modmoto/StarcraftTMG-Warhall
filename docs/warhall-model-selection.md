# Selecting imported models by their visible mesh

The requested behavior is to click a Marine, vehicle or flying model itself and select/drag its owning soldier or unit, while keeping base selection available. This is separate from imported terrain supporting units on top.

## Inspected client path

Read-only inspection of the installed Warhall Test managed assembly on November 3, 2026 found:

- `AssetDownloadController.RunTriLibImport` calls `ConfigureForStaticProps`, which sets `AssetLoaderOptions.GenerateColliders = false`. This affects hosted OBJ/GLB models used by the mod.
- After the remote model loads, `Model.LoadModel` assigns its descendants to the `ModelMesh` layer. The callback does not create picking colliders or forward mouse events to the owning soldier.
- Selection and dragging enter `GameItem.OnMouseDown`, `OnMouseDrag`, `OnMouseEnter` and related handlers, which call `InputManager` with the owning GameItem. A visible imported mesh is not itself that GameItem.
- WDS base dimensions, model transforms and the shared skin publication payload expose no collider-generation or mouse-forwarding option. A GLB contains geometry/materials, not Unity MonoBehaviour components. Adding invented JSON flags cannot enable the missing client behavior.

No application binary or local asset cache was patched. No models were reuploaded for this investigation.

## Client implementation request

Add an opt-in picking collider after each remote model finishes loading. Fit a suitable selection-only proxy to its renderer bounds, or generate mesh picking colliders where practical. Connect hits to the nearest owning Soldier/GameItem and route them through the same existing selection, drag, double-click and context-menu paths as the base. Child meshes must not become independent game pieces.

Keep picking separate from movement surfaces, collision-based placement, line of sight and base measurements. Do not enable terrain elevation colliders globally or enlarge every gameplay base as a substitute. Rebuild/remove picking proxies when a model, skin or scale changes, and retain existing ownership/observer and UI-input checks.

Acceptance: click/hover/drag a Marine's torso, an Immortal arm, and a Raven above its flight stand. Each must affect the correct existing soldier/unit; the base must still work. Repeat with overlapping units, selection modifiers, right-click, a second player, skin replacement, and locked terrain. Terrain collision and measurements must remain unchanged on Mac and Windows.
