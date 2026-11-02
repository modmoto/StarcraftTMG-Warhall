# PDF-grid terrain calibration (release 21)

The six official maps are reviewed against rulebook PDF pages 118–123 and their six-inch grid. `terrain-calibration.json` records the PDF SHA-256, image frame, footprint measurements and stable TTS object GUIDs with reviewed map centers and rotations. `terrain-sources.json` remains the original workshop placement reference.

These are measurements of raster artwork, not manufacturer-certified physical dimensions. Color-isolated footprint samples are measured in the terrain's aligned frame, corrected for the one-pixel extraction margin, and rounded to one-eighth inch. Mirrored L walls share the same 7.625×3.875-inch footprint. Straight Wall Set 1 is 7×1.375 inches. The head statue is 2.875×4.25 inches and the shard is 2.125×3.125 inches. The complete ramp/platform footprint is 14.75×8 inches. Heights retain the original TTS XYZ scales: top-down maps cannot establish heights.

## Geometry

The former terrain importer replaced nonuniform parent and attachment scales with the largest horizontal scale. For the shard attachment, Z=2.16877 was also applied to X, making it much too wide. The corrected importer composes child XYZ scale, child rotation and offset, then parent XYZ scale. It bakes the complete assembly into one textured GLB. Ramp and platform layers cannot lose their relative offsets through a zero-to-null API vector conversion.

L-wall alignment uses ±20° in the geometry instead of the previous guessed ±25°. Map rotation is independent and uses exact intended 15° steps, including cardinal orientations. Main runs align with the selection-base axes. The sculpted broken edges themselves remain irregular; this is not a claim that every stone is a perfect right angle.

Footprints are centered before placement. Cardinal wall reference centerlines lie on exact quarter-inch subdivisions of the six-inch grid, favoring the half-cell lines when close to the reference. Other reviewed centers and touching wall joins use eighth-inch subdivisions. The 26 wall-to-wall joins identified in the PDF retain less than 0.15-inch terminal separation in the geometry review. Map 5's opposing platforms meet on X=0; map 6's adjoining walls meet the platform edges. Source artwork imperfections are not converted into arbitrary rotation drift.

Textures are embedded at up to 2048 pixels per axis. This keeps the shard's enormous source texture from creating a GLB beyond GitHub's file-size limit, while preserving a detailed model texture. No source OBJ or texture URL is replaced with a different sculpt.

## Regenerate and review

```sh
npm run terrain:update -- --offline
npm run models:catalogue
npm run terrain:review
npm run check:local
```

The review writes top-down views, a six-inch grid and optional selection-base outlines to `.cache/terrain-review`. Its HTML can display `reference-1.png` through `reference-6.png` alongside those renders; export the corresponding PDF map images into the review directory for that comparison. New or changed PDF layouts require review of the explicit calibration data before release. The builder does not silently recalculate these decisions from noisy artwork.

The current review artifacts are also saved outside the repository in the workspace `outputs/terrain-grid-review` folder. Runtime game data contains hosted HTTPS model URLs; it does not depend on those local review files.

## Publish and verify

Push version 21 and the generated `model-assets/` files first. Then replace only terrain skins:

```sh
npm run models:publish -- --kind terrain --apply --login --replace --accept-publication-terms
```

Default target is Warhall Test. Unit skins, marker skins and deployment-line skins are separate batches. The publisher includes updated screenshots and removes old owned terrain skins only after the new assignment succeeds. Refresh the shared catalogue, update Starcraft and reload a fresh map. Confirm the L-wall/base alignment, wall joins, relative shard/head size and ramps on Mac and Windows. Local rendering and glTF validation do not establish live client success.

Imported ramps still need the client-side elevated-ground support described in `warhall-client-terrain-support.md` for units to stand on their mesh surfaces. Correct geometry does not add that client feature.

## Release 39: shared statue and banner variants

Only Head Statue acfebe and the dark green Protoss Banner d26342 are generated. terrain-calibration.json assetAliases maps the removed statue 633ae2 and three other banner variants to these retained source assets. All six maps retain their placement counts, positions, rotations and calibrated footprints. The menu has 13 map models plus eight deployment overlays. Old cloud skin registrations remain available for saved games; no unchanged meshes need uploading.

## Temporary 50 mm ramp height

The High Ground ramp/platform assembly is vertically compressed to 50 mm using its heightMm override in terrain-calibration.json. Its bottom stays grounded; its X/Z footprint, assembly joins, map placement and shared menu IDs are unchanged. This is a temporary visibility workaround while imported elevated collision remains unsupported. It does not make the mesh walkable.

To undo this temporary change, revert its dedicated commit, regenerate the terrain/catalogue and republish only sc_terrain_f2dd0d048a087d53, including its menu alias. Reverting Git alone does not change an already-published skin. No WDS version bump is required for this shared-skin-only adjustment.
