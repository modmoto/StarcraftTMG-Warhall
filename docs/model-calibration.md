# Preserve the Windows cache layouts

The working local adapter in `scripts/install-warhall-model-cache.mjs` used the selected model's layout size, position and rotation, with `UseLegacyScale: 1`. The shared website creates nonlegacy skins. In addition, the former `--default-scale` upload path sent `transforms: null`, losing position and rotation as well as scale. That reset broke the terrain/map rotation compensation and changed model dimensions.

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

Checks compare every part's rotation and translation with the original Windows installer inputs and compare the client-computed scale multipliers. All 62 unit/terrain assemblies preserve the authored dimensions. Live macOS/Windows testing is still required: add fresh units and reload the map after refreshing the shared catalogue. In particular, check the Adept's orientation/materials and the Wall Set 4/5 map rotation compensation.
