---
name: warhall-model-extraction
description: Find, inspect and extract textured StarCraft miniature models for the Warhall catalogue.
---

# Model Extraction

Use the existing TTS extraction and preview workflow in scripts/extract-tts-models.mjs, scripts/download-tts-previews.mjs and scripts/render-tts-previews.py. Inspect the rendered geometry and texture. Prefer firing poses for ranged units and charging or striking poses for melee. Record one reviewed pose per unit and link it through the established unit/profile naming and model-selections.json.

For platform-specific Unity bundles, follow docs/model-calibration.md for portable GLB conversion. Bake the pose, retain textures and transforms, and inspect orientation, ground contact and scale. Preserve approved entries for unchanged units. Hand the reviewed assets to warhall-publish-skins for registration.

## Calibrate official terrain layouts

Use the workflow in [terrain calibration](../../../docs/terrain-calibration.md). Render the official map page and record the exact pixel bounds of the playable board. Verify the scale against the printed 6-inch lines on both axes. Convert centers from the page image to inches from the board center, with X right and Z up. Use the Workshop bag to identify pieces and orientations. Check identifiable landmarks before using its coordinate frame. The first three Skirmish bags are rotated a quarter turn relative to their PDF pages.

Store reviewed positions and rotations by object GUID in terrain-calibration.json. Inspect wall centerlines, joins and ramp orientation against the PDF with the calibrated meshes. Use the default 54-by-36-inch table origin when generating edge offsets. Load square presets on the default table, then resize to 36 by 36 inches and verify the centered terrain. The client computes offsets from the active table edges when the preset loads.

## Walkable terrain with Unity

For ramp/platform collision, follow [the confirmed collider build](../../../docs/terrain-collider-build.md). The cyan imported prototype was confirmed working by the user in Warhall Test on November 5, 2026. Use Unity 6000.0.81f1 with AssetBundle, Physics and ImageConversion modules enabled; keep layer-15 MeshCollider children separate from all renderer objects. Preserve the actual slope/platform geometry. Installing Unity without these modules and hierarchy is insufficient. Use examples/ramp-collider/BuildHighGround.cs and scripts/prepare-ramp-unity.mjs for the real textured assembly. Verify local reload/physics, then publish only the changed terrain and test it in a fresh map. Windows success does not establish macOS bundle compatibility.

