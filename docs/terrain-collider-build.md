# Walkable imported terrain

## Confirmed November 5, 2026

The user verified the cyan Ramp Collision Probe in Warhall Test v110: a model stands on its surface. This supersedes the assumption that imported terrain always requires a client change. The real High Ground replacement still needs its own client check.

Use Unity **6000.0.81f1**, matching the tested client. Unity installation alone is insufficient: enable the built-in AssetBundle, Physics and ImageConversion modules using `examples/ramp-collider/manifest.json`. With an empty package manifest, the earlier bundles lost colliders and failed to load even in their own editor.

Keep visible MeshRenderer/MeshFilter objects separate from renderer-free MeshCollider children. Put the collider children on layer **15 (ElevatedGround)**. Warhall reassigns layers on the root and renderer objects; a collider on those objects loses its walkable layer. No custom runtime MonoBehaviour is needed. Use actual surface geometry, including the slope and platform, rather than an enclosing box. Terrain locking preserves layer-15 colliders.

## Rebuild the real High Ground

1. Remove `heightMm` from `terrain-calibration.json` â†’ High Ground. The original TTS geometry is about 99.89 mm high, with the reviewed 14.75 Ã— 8 inch footprint.
2. Run `node scripts/update-terrain.mjs --offline`. It generates the restored GLB and textured preview geometry. `colliderBundle` may remain present: the preview still comes from the same authored geometry.
3. Create `.cache/ramp-collider-test` with Packages/manifest.json from the example, Assets/Editor and Output directories. Run `node scripts/prepare-ramp-unity.mjs` to write binary mesh/UV input, original textures and the editor builder. This uses the existing terrain input cache, not the installed game's cache.
4. Run Unity with `-batchmode -nographics -quit -projectPath <absolute-project> -executeMethod BuildHighGround.Run -logFile <absolute-log>`. On Windows use a hidden process and wait for completion. Inspect exit/log; require `HIGH_GROUND_COLLIDER_OK` after bundle reload and simulated client layer reassignment. The initial restored build sampled 2,556 surface hits, heights 0.682â€“9.989 cm.
5. SHA-256-name Output/high-ground-windows.unity3d into model-assets. Set High Ground `colliderBundle` to that filename, rerun terrain:update and models:catalogue. Retain previewGeometryFile for real geometry previews and calibration. Push assets before publishing.
6. Publish only canonical `sc_terrain_f2dd0d048a087d53` to the requested server using the existing checkpoint and publisher. Preserve the exact skin-name menu alias. Existing maps keep their High Ground IDs; remove experimental map/probe records after replacing them with the real model.
7. Restart the client, reload Map 5 and check slope, plateau and ground off the edge with terrain locked. API success and local physics do not establish this gameplay result.

The current bundle targets Windows. macOS AssetBundle compatibility is **not verified**; do not claim parity or replace production without testing the corresponding platform strategy. GLB preview/fallback geometry itself remains portable, but GLB cannot carry these Unity colliders.

## Test v112: reviewed lower platform

The user requested half height after confirming the real ramp works. High Ground now uses heightMm=50 (5 cm), retaining its footprint. Rebuild the bundle after height changes; changing only preview geometry does not change the collider. A separate raised Temple Obelisk has 5 cm baked into its geometry and is used only in Map 5; normal obelisks remain ground-level. Both variants regenerate through terrain:update.

## Test v113

User raised the reviewed 50 mm ramp by 30 percent: current platform height is 65 mm. The raised Map 5 obelisk is baked at the same 6.5 cm offset. The Unity bundle and collider were rebuilt; local raycasts confirm max height 6.5 cm.

## Terrain-aware Leading Model Movement audit — November 17, 2026

Scope: repository assets and generators only. No client changes, patch, GameConfig option or server publication. The production WDS folder is unchanged.

### Asset decisions

- **High Ground:** rebuilt Windows bundle with separate visible blocking bodies and visible walkable surfaces. All original 1,227 triangles are retained; 185 upward-facing triangles within 45 degrees are assigned to the walkable surfaces, leaving the other 1,042 in the blocking bodies. Renderer-free children use non-trigger, non-convex MeshCollider on ElevatedGround (15). Only the walkable renderer parents use the optional `LMWalkable` prefix; the root and blocking bodies do not. The collider children retain layer 15 after root/renderer layer reassignment.
- **Scoreboard:** its sole flat mesh is named `VisBase Scoreboard` in the exported GLB node. There is no raised plinth or extra obstacle collider. The GLB encoder now preserves optional mesh names; unnamed existing assets keep their previous output.
- **Already suitable, retained:** Wall Sets 1–6, Head Statue, Statue Shard, Vespene Geyser, both Temple Obelisks, Protoss Banner and grass. Their visible geometry remains the obstacle geometry, without added box/convex colliders or walkable labels. A welded-component audit found no independent horizontal decorative plate in these source meshes (including High Ground). Structural stone plinths, rubble and mesh undersides are not decorative selection plates and were not renamed `VisBase`.
- Terrain selection rectangles supplied by Warhall are not meshes in these source assets. Their filtering cannot be changed by renaming an asset child; verify that the new client's selection-surface exclusion also covers those generated rectangles.

### Geometry and rebuild contract

`assembleTerrain` already bakes source/attachment scaling and rotations into the vertices, including winding correction for the mirrored coordinate system. The Unity builder creates identity child transforms; no nested nonuniform scale/rotation or shear remains. Mesh assets retain CPU data (never call `UploadMeshData(true)`). After bundle reload, the builder asserts `isReadable` on every visible mesh and walkable collider mesh, verifies collider flags/layers, and repeats the client's renderer/root layer reassignment. GLB buffers are present in the portable files; runtime readability and preserved GLB node names after Warhall import remain client integration checks.

The current immutable Windows bundle is `9b47147e89cf3e353adc92f5093bc7786fc62f36ba50d9e153db6516748de551.unity3d`. Its source is `examples/ramp-collider/BuildHighGround.cs`; rebuild with the workflow above. `terrain-calibration.json`, `terrain-models.json` and `model-catalogue.json` reference it. The scoreboard generator and catalogue also reference its newly named GLB. No WDS manifest bump is needed for these immutable shared-skin asset changes; they still require normal skin publication when deployment is requested.

### Local validation and remaining gameplay checks

Unity 6000.0.81f1 built and reloaded the actual Windows bundle successfully:

- 2,541 downward hits: 840 slope samples and 1,701 plateau samples; maximum height 6.5 cm. Every hit normal satisfies the 45-degree limit. Authored inclined triangles are approximately 14.06–14.69 degrees.
- A 115-sample approach from the lower ramp end to the upper platform has no missing height samples. The greatest sampled rise, including the initial ground transition, is 0.306 cm. The original small stone lips remain; this is geometry validation, not a guarantee about the client's step tolerance.
- A ray outside the raised side misses, a neighbouring ray inside returns 6.5 cm, and a horizontal ray through the cliff does not hit the height-only collider. The visible cliff remains present as a blocking mesh.
- Export regression checks verify the actual scoreboard GLB node name and identity transforms; existing map footprint/alignment tests pass.

**Required in the new Warhall client:** move across the scoreboard and selection rectangles; stop against a wall's actual stone body; approach the ramp from its low end; attempt a move into its raised side; move and stop on the plateau. Check locked terrain and both players. These tests establish obstacle filtering, no side jumping and stable elevated movement; local raycasts alone do not. macOS bundle compatibility is still unverified.

## Release 153: native scoreboard

The custom flat scoring-board terrain and its automatic map placement were removed because Warhall now supplies its native scoreboard. Keep `InteractiveScoreboardType: Starcraft` enabled. The custom terrain is absent from the active catalogue, terrain menu and all nine map presets; do not reintroduce its generator. Historical hash-named media remains available for old saves.

## Data 154: nonzero native selection boxes

Some imported walls could be rectangle-selected but not clicked or dragged. In the inspected `TerrainItem.RPCConfigureTerrain`, the native selection box uses `WDSTerrain.Height` directly. The field defaults to zero when absent; ordinary imported GLB meshes do not supply their own physics collider. WDS data previously omitted Height everywhere.

The terrain generator now sets Height=0.1 cm (1 mm) on the 14 physical terrain records, including the raised obelisk. Width, Length, placement and visible geometry remain unchanged. This restores a thin positive selection volume rather than a wall-sized selection box. Mission-marker helpers and deployment overlays still omit Height. Keep terrain unlocked when testing direct clicks and dragging. The native movement implementation must continue to ignore generated selection boxes as obstacles and use visible geometry; ElevatedGround slope/platform colliders are unchanged.

Local checks validate the generated selection dimensions and retained map geometry. Direct click/drag, terrain locking and the new movement obstacle filtering still require a fresh Warhall client test. This is a supported WDS change; no client patch, model rebuild or skin reupload is required.
