---
name: warhall-model-extraction
description: Find, inspect and extract textured StarCraft miniature models for the Warhall catalogue.
---

# Model Extraction

Use the existing TTS extraction and preview workflow in scripts/models/extract-tts-models.mjs, scripts/models/download-tts-previews.mjs and scripts/models/render-tts-previews.py. Inspect the rendered geometry and texture. Prefer firing poses for ranged units and charging or striking poses for melee. Record one reviewed pose per unit and link it through the established unit/profile naming and model-selections.json.

For platform-specific Unity bundles, follow docs/model-calibration.md for portable GLB conversion. Bake the pose, retain textures and transforms, and inspect orientation, ground contact and scale. Preserve approved entries for unchanged units. Hand the reviewed assets to warhall-publish-skins for registration.

## Calibrate official terrain layouts

Use the workflow in [terrain calibration](../../../docs/terrain-calibration.md). Render the official map page and record the exact pixel bounds of the playable board. Verify the scale against the printed 6-inch lines on both axes. Convert centers from the page image to inches from the board center, with X right and Z up. Use the Workshop bag to identify pieces and orientations. Check identifiable landmarks before using its coordinate frame. The first three Skirmish bags are rotated a quarter turn relative to their PDF pages.

Store reviewed positions and rotations by object GUID in terrain-calibration.json. Inspect wall centerlines, joins and ramp orientation against the PDF with the calibrated meshes. Use the default 54-by-36-inch table origin when generating edge offsets. Load square presets on the default table, then resize to 36 by 36 inches and verify the centered terrain. The client computes offsets from the active table edges when the preset loads.

## Walkable terrain with Unity

For ramp/platform collision, follow [the confirmed collider build](../../../docs/terrain-collider-build.md). The cyan imported prototype was confirmed working by the user in Warhall Test on November 5, 2026. Use Unity 6000.0.81f1 with AssetBundle, Physics and ImageConversion modules enabled; keep layer-15 MeshCollider children separate from all renderer objects. Preserve the actual slope/platform geometry. Installing Unity without these modules and hierarchy is insufficient. Use tools/unity-assets/terrain/BuildHighGround.cs and scripts/terrain/prepare-ramp-unity.mjs for the real textured assembly. Verify local reload/physics, then publish only the changed terrain and test it in a fresh map. Windows success does not establish macOS bundle compatibility.


Tal'darim Slayer uses the normal Stalker geometry and reviewed transforms, with only yellow/gold material pixels replaced by red. Preserve neutral pixels, alpha, value and saturation; do not recolour the whole model or restore the old all-red Wave-4 mesh. wave4-model-sources.json reuseUnitId and prepare-wave4-models.mjs preserve the choice on future exports; preserveSourceColors prevents the catalogue from resetting red to the normal Protoss palette.

## Specialists within an existing unit

Follow [specialist models](../../../docs/specialists.md). Use specialist-model-sources.json and scripts/models/prepare-specialist-models.mjs for the reviewed TTS AGG-12, Rocket Launcher, Acid Blast and Scourgeshot objects. Preserve nested attachments, authored bundle scale and reviewed launcher alignment. Omit the decorative library root base; ground the actual figure. Render and inspect attachments before publishing. Keep the unit's existing base and model count.

Specialist weapon options are native Type 4 (ModifyItemOnSingle), like T9A command models. Do not create separate units or ExtraItems. Bind skins to the existing assignmentProfileId plus exact selectedOptions IDs; a unique catalogue/checkpoint profileId identifies the variant locally. Never overwrite the ordinary profile default with a specialist skin. The existing rule_keyword_specialist belongs directly to that soldier and selects the custom star-and-chevron badge, replacing the initially proposed flag. Icon visibility still follows native Warhall preferences/features.

Only explicit SPECIALIST choices qualify. Ordinary Goliath/Immortal weapons remain unit-wide; Wild Mutation is not a specialist assignment. On every wave, audit current rules and TTS models instead of assuming every optional weapon is another soldier or every firing mode is another specialist. Verify multi-option imports and model counts in the client; API readback alone does not prove rendering.

Terran specialist body bundles contain a grey armour texture. Reuse the normal Marine texture through bodyTextureFromUnitId=unit_marine; its UV layout is compatible. Apply this only to the body bundle, retaining weapon attachment textures. Hue-only faction recolouring intentionally preserves neutral pixels and therefore cannot turn the grey armour blue. Inspect the resulting body and attachments before replacing Test skins.

Compare all specialist bodies with the reviewed ordinary unit size before publication. prepare-specialist-models.mjs uses the normal catalogue preview transforms, scales the complete figure uniformly against its first/body mesh, and writes specialist-model-report.json. Never resize the normal reference unit to fit the specialist. Marine reference height is approximately 32.93 mm; Infested Marine approximately 51.23 mm, as derived from their maintained calibrated models. Exclude added weapon height from this comparison. The Rocket Launcher was initially oversized and its manual downward offset embedded the launchers in the arms; seat the launchers directly on the shoulder armour instead, using the body surface intersection in specialist-geometry.mjs. Keep the four native Type-4 option Names as short blue popup links, with plain stable IDs for imports and skin modifiers.

Rocket Launcher pods must sit directly on the shoulder armour, as explicitly requested on 2026-11-26. Remove the disconnected handheld-grip components using the reviewed source threshold; seat the pod bottoms on the actual body surface under their footprint. Do not restore the rejected floating rear/backpack placement. Inspect front, side and rear previews. Infested Marine and its two specialist figures use centerOnStand: center the lowest 2% of body contact geometry in X/Z, moving the complete assembly together, excluding weapon/horn extents. Keep scale and ground height intact. Rebuild only the reviewed catalogue profiles when preserving other skins, using --refresh-profile.
