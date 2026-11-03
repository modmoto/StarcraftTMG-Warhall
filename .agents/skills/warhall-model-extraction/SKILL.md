---
name: warhall-model-extraction
description: Find, inspect and extract textured StarCraft miniature models for the Warhall catalogue.
---

# Model Extraction

Use the existing TTS extraction and preview workflow in scripts/extract-tts-models.mjs, scripts/download-tts-previews.mjs and scripts/render-tts-previews.py. Inspect the rendered geometry and texture. Prefer firing poses for ranged units and charging or striking poses for melee. Record one reviewed pose per unit and link it through the established unit/profile naming and model-selections.json.

For platform-specific Unity bundles, follow docs/model-calibration.md for portable GLB conversion. Bake the pose, retain textures and transforms, and inspect orientation, ground contact and scale. Preserve approved entries for unchanged units. Hand the reviewed assets to warhall-publish-skins for registration.
