# Repository scripts

Run scripts from the repository root. Existing npm commands remain the supported entry points; see package.json for their current paths.

| Folder | Purpose |
| --- | --- |
| data | DB wave imports, base footprints, rules and data validation |
| cards | Official card artwork extraction and formatting |
| models | Model extraction, calibration, previews and shared skin publication |
| terrain | Terrain data, map layouts and Unity input preparation |
| tokens | Token artwork and Unity input preparation |
| deployments | Deployment data and overlays |
| imports | List planning and WDS editor-export comparison |
| auth | Local credential enrollment and GitHub authentication |
| release | Promotion of tested main commits to release |
| checks | Local verification and Test-server setup |

Unity editor asset builders live in tools/unity-assets/terrain and tools/unity-assets/tokens. They generate mod assets and do not modify the Warhall client.

For TTS specialist figures, run `node scripts/models/prepare-specialist-models.mjs`, then rebuild the catalogue. See [specialist models](../docs/specialists.md) for native single-model options, rank badges and option-specific skins.
