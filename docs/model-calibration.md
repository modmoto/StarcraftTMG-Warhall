# Model calibration

Release 21 intentionally recalibrates terrain against the official PDF grid at the user's request. Read [terrain-calibration.md](terrain-calibration.md) for the corrected XYZ composition, footprints and placements. The Windows baseline described below remains authoritative for units; terrain now uses `pdf-grid-v1` portable assemblies.

## Original Windows cache baseline

The former local adapter used the selected model's layout size, position and rotation, with `UseLegacyScale: 1`. The shared website creates nonlegacy skins. In addition, the former `--default-scale` upload path sent `transforms: null`, losing position and rotation as well as scale. That reset broke the terrain/map rotation compensation and changed model dimensions.

`models:catalogue` now preserves those original layouts from `model-selections.json` and `terrain-models.json`. It does not refit units to their bases or invent new dimensions. The isolated manual Marine scale override has been removed; its original Windows layout is used again. `model-calibration-report.json` records source sizes, original scales, API scales and physical size estimates for review.

## Scale conversion

The installed test client calculates a single nonlegacy OBJ's final multiplier as:

```
(2.6666667 / maximum source mesh dimension) * 2.54 * API scale
```

The Windows legacy multiplier was `2.54 * layout.size`. Therefore the equivalent API scale is `layout.size * maximum source mesh dimension / 2.6666667`.

Multipart models are not normalized by the client, so their per-part scales stay exactly as authored. Position and rotation remain unchanged for every part, including all terrain. The catalogue's `windows-cache-v1` marker makes these prepared transforms take precedence over the old `--default-scale` flag. New commands should omit that flag.

## Portable bundle replacements

Adepts, Jim Raynor, Nova Assault Mode, Omega Worm and Viles used Unity bundles. The native client loads those through Unity's platform-specific AssetBundle loader, which is unsuitable for sharing a Windows bundle with macOS. Their selected prefab geometry and textures are now exported to static GLB files under `model-assets/`, with bones baked to the prefab pose and textures embedded. UV/handedness conversion is explicit. No different model or variant is selected.

The raw prefab coordinates remain the same size; GLB uses the client's legacy-style multiplier, so the original layout scale and transforms are retained. Generated GLBs are content-addressed and referenced through GitHub raw URLs. All five pass Khronos glTF validation with zero errors and warnings. This confirms file format integrity, not in-game rendering.

Push `model-assets/`, the updated catalogue and code before updating shared skins. Apply checks availability of hosted portable assets before requesting credentials or creating skins. A GitHub push or game-data version bump alone does not change the shared skins.

## Apply

```sh
npm run models:catalogue
npm run models:publish -- --apply --login --replace --accept-publication-terms
```

The publisher generates updated thumbnails, replaces the selected shared skins, and cleans up old owned skins after successful assignment. It retains existing progress and reconciles live server data. If a previous batch stopped during creation with an uncertain outcome, reconcile that record before retrying.

Checks compare every part's rotation and translation with the original Windows installer inputs and compare the client-computed scale multipliers. The original baseline preserved 62 unit/terrain assemblies. Release 21 preserves unit dimensions and explicitly replaces the terrain dimensions with PDF-grid calibration. Live macOS/Windows testing is still required: add fresh units and reload the map after refreshing the shared catalogue. In particular, check the Adept's orientation/materials and the Wall Set 4/5 map rotation compensation.

## Server zero-to-null transform bug

A live test catalogue read exposed a second difference from the local Windows cache. On the High Ground skin 13182, ramp layer 33410 stored `SocketPositionX=-12.1058745566`, `SocketPositionY=3.5225010612`, but `SocketPositionZ=null` even though the upload supplied zero. The installed client's `DBHSQL.CreateSkinLayerDictionary` only constructs a position or rotation vector when all three components are non-null. One null component therefore discarded the whole ramp translation. Zero rotation components can similarly erase a nonzero rotation on another axis.

The HTTP adapter now encodes zero position/rotation components as `1e-7` in create and update payloads. This negligible transport-only offset avoids a falsey-zero-to-null conversion while retaining the authored layout to visual precision. Catalogue/source values remain the original exact zeros. Scale values and nonzero offsets are unchanged.

Repair existing shared skins without replacing meshes or changing skin IDs:

```sh
node scripts/repair-model-transforms.mjs --apply --login --profile sc_terrain_f2dd0d048a087d53
```

Without `--apply`, the command previews the selected authored transforms. Omit `--profile` to repair all published model/terrain transforms. `--server test|prod` selects the target, defaulting to test. It resolves the exact game, requires administrator access and exactly one matching shared skin per profile, reads `/SelectSkinParts`, posts `/UpdateSkinLayerTransforms`, then reads back every position, rotation and scale. Nulls or mismatches fail verification. This does not upload meshes, create skins, delete skins or modify local Warhall caches.

After a verified server repair, refresh/restart Warhall Test and reload the map. Already-spawned terrain does not receive the external API edit automatically. The verified API response establishes stored transforms; a live map check still establishes rendering.
