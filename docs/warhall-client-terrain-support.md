# Warhall Test terrain support required

Observed in Warhall Test 2.08. These are client changes, not working WDS settings. No client binaries have been modified.

## Imported terrain as elevated ground

Native Ninth Age hills have colliders on Unity's `ElevatedGround` layer. `GameController.GetGroundRaycast(true)` includes ground (layer 8) and elevated ground (layer 15). Units use this raycast while dragging.

For imported OBJ models, `AssetDownloadController.ConfigureForStaticProps` sets `GenerateColliders = false`. `TerrainItem.RPCConfigureTerrain` supplies a selection box, but it is not an elevated-ground surface. Setting WDS `Height` therefore does not let units stand on a platform.

Add an opt-in terrain property for elevated ground. For opted-in terrain, create mesh colliders for the actual imported ramp/platform meshes, on `ElevatedGround`, after import and before discarding readable mesh data. Keep their transforms synchronized with each skin part. Preserve those colliders when terrain is locked; `TerrainItem.SetColliders` already exempts this layer. Do not treat a whole assembly's bounding box as a ramp surface.

Acceptance: load Starcraft Official Map 5, lock terrain, drag a Marine onto the platform and several points on the ramp. Its base must follow the visible surface at each position, then return to ground height off the assembly.

## Terrain without visible bases

`WDSTerrain` exposes Width, Length, Height and Shape. `TerrainItem` always calls `Base.SetSizeTerrain`, which creates the scenario-textured surface and border. There is no per-terrain WDS hide-base option. The global base-visibility switch also affects unit bases and does not implement this request.

Add an optional per-terrain `ShowBase` flag and disable both the base renderer and `_surface` renderer when false. Keep the terrain's real selection/elevation colliders. Zero-width bases are not a substitute: they collapse the selection collider and distort the surface scale.

The minimal client implementation, after configuring the terrain's dimensions, is:

```csharp
// WDSTerrain: defaults preserve existing games.
public bool ShowBase { get; set; } = true;

// TerrainItem.RPCConfigureTerrain: rendering only; keep colliders unchanged.
_base.GetComponent<Renderer>().enabled = terrain.ShowBase;
_base.SetSurface(terrain.ShowBase);
```

The global visibility handler should preserve this per-terrain preference when bases are toggled. Merely removing the material/shader causes Unity's missing-material rendering; it does not make the surface transparent. An alpha-zero color also cannot hide an opaque shader reliably. Disabling the two renderers avoids either issue.

Acceptance: hide bases for imported Starcraft terrain while keeping Marine bases visible, terrain selectable when unlocked, and elevated ground usable when locked.

## Lock deployment markers automatically

`PanelBattlefield.TerrainInDeployments` creates all configured terrain through `TerrainController.CreateTerrain`; that method explicitly calls `SetTerrainLock(false)`. Unlike `NinthAgeSetupController.LoadPresetMap`, deployment loading never relocks afterward.

Relock after deployment terrain has finished spawning, or expose a deployment configuration flag to do so. Markers are already ordinary terrain in this mod and obey the existing lock switch.
