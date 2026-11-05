# Walkable imported terrain

## Confirmed November 5, 2026

The user verified the cyan Ramp Collision Probe in Warhall Test v110: a model stands on its surface. This supersedes the assumption that imported terrain always requires a client change. The real High Ground replacement still needs its own client check.

Use Unity **6000.0.81f1**, matching the tested client. Unity installation alone is insufficient: enable the built-in AssetBundle, Physics and ImageConversion modules using `examples/ramp-collider/manifest.json`. With an empty package manifest, the earlier bundles lost colliders and failed to load even in their own editor.

Keep visible MeshRenderer/MeshFilter objects separate from renderer-free MeshCollider children. Put the collider children on layer **15 (ElevatedGround)**. Warhall reassigns layers on the root and renderer objects; a collider on those objects loses its walkable layer. No custom runtime MonoBehaviour is needed. Use actual surface geometry, including the slope and platform, rather than an enclosing box. Terrain locking preserves layer-15 colliders.

## Rebuild the real High Ground

1. Remove `heightMm` from `terrain-calibration.json` → High Ground. The original TTS geometry is about 99.89 mm high, with the reviewed 14.75 × 8 inch footprint.
2. Run `node scripts/update-terrain.mjs --offline`. It generates the restored GLB and textured preview geometry. `colliderBundle` may remain present: the preview still comes from the same authored geometry.
3. Create `.cache/ramp-collider-test` with Packages/manifest.json from the example, Assets/Editor and Output directories. Run `node scripts/prepare-ramp-unity.mjs` to write binary mesh/UV input, original textures and the editor builder. This uses the existing terrain input cache, not the installed game's cache.
4. Run Unity with `-batchmode -nographics -quit -projectPath <absolute-project> -executeMethod BuildHighGround.Run -logFile <absolute-log>`. On Windows use a hidden process and wait for completion. Inspect exit/log; require `HIGH_GROUND_COLLIDER_OK` after bundle reload and simulated client layer reassignment. The initial restored build sampled 2,556 surface hits, heights 0.682–9.989 cm.
5. SHA-256-name Output/high-ground-windows.unity3d into model-assets. Set High Ground `colliderBundle` to that filename, rerun terrain:update and models:catalogue. Retain previewGeometryFile for real geometry previews and calibration. Push assets before publishing.
6. Publish only canonical `sc_terrain_f2dd0d048a087d53` to the requested server using the existing checkpoint and publisher. Preserve the exact skin-name menu alias. Existing maps keep their High Ground IDs; remove experimental map/probe records after replacing them with the real model.
7. Restart the client, reload Map 5 and check slope, plateau and ground off the edge with terrain locked. API success and local physics do not establish this gameplay result.

The current bundle targets Windows. macOS AssetBundle compatibility is **not verified**; do not claim parity or replace production without testing the corresponding platform strategy. GLB preview/fallback geometry itself remains portable, but GLB cannot carry these Unity colliders.

## Test v112: reviewed lower platform

The user requested half height after confirming the real ramp works. High Ground now uses heightMm=50 (5 cm), retaining its footprint. Rebuild the bundle after height changes; changing only preview geometry does not change the collider. A separate raised Temple Obelisk has 5 cm baked into its geometry and is used only in Map 5; normal obelisks remain ground-level. Both variants regenerate through terrain:update.
