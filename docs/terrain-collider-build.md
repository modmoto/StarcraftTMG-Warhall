# Unity terrain asset build

Use Unity 6000.0.81f1 and the AssetBundle, Physics and ImageConversion modules from `examples/ramp-collider/manifest.json`. Asset builders are editor-only; no custom runtime component is required.

High Ground retains the reviewed 14.75 x 8 inch footprint and 65 mm height from terrain-calibration.json. The raised obelisk uses the matching baked height. Keep existing map IDs and poses.

## Rebuild

1. Run `node scripts/update-terrain.mjs --offline` using the reviewed source cache.
2. Prepare `.cache/ramp-collider-test` with Packages/manifest.json from the example, Assets/Editor and Output directories.
3. Run `node scripts/prepare-ramp-unity.mjs`.
4. Run Unity in hidden batch mode with `-batchmode -nographics -quit -projectPath PROJECT -executeMethod BuildHighGround.Run -logFile LOG`.
5. Require a successful build and `HIGH_GROUND_COLLIDER_OK` after bundle reload. Hash-name the output under model-assets, update High Ground's colliderBundle input, and regenerate terrain/catalogue references.
6. Push the required files and publish the terrain skin to the requested server with the normal scoped checkpoint. Verify canonical/default and exact-name menu bindings.

The builder uses complete source meshes on renderer-free MeshCollider children on ElevatedGround layer 15. Visible renderers remain separate. Retain this reviewed behavior: a previous surface-only split was explicitly reverted after edge-placement glitches. Source transforms are baked; retain readable meshes and non-trigger colliders. Pointer height sampling and movement behavior still need a client test.

Physical terrain WDS records have a 0.1 cm selection Height and IsBaseTransparent=true. Helpers retain their own generated definitions. Selection volume is not walkable height or visible obstacle geometry.

Current bundles target Windows. Do not infer macOS compatibility from API registration. Local collider/raycast checks are not a substitute for locked/unlocked terrain, ramp approach/edge and elevated placement tests in the native client.
