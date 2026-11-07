---
name: warhall-markers-tokens
description: Create StarCraft gameplay tokens and objective markers, publish shared skins, and preserve Warhall web editor token order and bindings.
---

# Warhall markers and tokens

Ask during wave inventory whether new tokens are needed. Check official materials and confirm artwork, size and distinct faces or states before creating them. Use docs/tokens.md and the current Test data for the existing inventory.

## Gameplay tokens

Use the definitions and SVG artwork under src/tokens and token-artwork. Existing custom tokens are single-sided round 25 mm GLBs. Use separate entries for separate states. Keep the canonical sc_token_* publication IDs. The emitted Token records contain Id, Name and Type, with Id and Name exactly matching the shared skin name.

1. Run npm run tokens:update, npm run convert -- --offline and npm run models:catalogue. Inspect artwork, dimensions and thumbnails, then run npm run check:local.
2. Push hosted assets and Test data before uploading changed token skins. Use warhall-publish-skins with kind token, then synchronize the exact-name menu assignments with models:menus.
3. Refresh the Test catalogue and check token placement. Export the web editor draft as ZIP and compare it with the repository using scripts/compare-wds-export.py.
4. When the catalogue changes, review the exported token IDs and update token-menu-order.json to match the verified editor sequence. The editor takes its order from the public catalogue followed by shared results, deduplicated by skin ID. Replacements can change that sequence. Regenerate and verify the resulting token array. Merge the reviewed order into the generator inputs and preserve other files from the repository.

## Objective markers

Use src/deployments/marker-assets.mjs and docs/mission-markers.md. Keep the five current objectives as Terrain with exact skin-name IDs and canonical sc_mission_* publication bindings. Deployments reference those names in DeploymentTerrains with IsToken=false. Preserve placement and color assignments. The current unnumbered design uses a decorated 32 mm centre and an open control outline.

Build with models:catalogue, inspect the previews, push the assets, and publish changed skins with kind marker. Synchronize menu bindings and verify a fresh deployment in Test. Check the terrain picker and ZIP roundtrip separately from battlefield placement. See docs/wds-editor-compatibility.md for omitted helper records and rounded dimensions. Merge intended edits into the source generators after reviewing the ZIP diff.

## Map loading token tray

The map generator places the custom gameplay token inventory opposite the scoreboard through src/tokens/tray.mjs. Each definition gets its own row with 1.25-inch spacing. Activation definitions get five copies each, including both colors and both phases. Other definitions get one copy. Preserve exact shared token names and Type Token so the client creates tokens. This tray loads with the map, alongside the scoreboard. Loading only a deployment retains the existing tray.
