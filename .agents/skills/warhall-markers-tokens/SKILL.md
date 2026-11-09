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

The map generator places both player batches on the same side opposite the scoreboard through src/tokens/tray.mjs. Use the negative world-X edge, which is screen-right in the reviewed client camera. Blue and red occupy opposite corners along that edge. Rotate the red batch's token faces 180 degrees. Each batch has five blue Movement markers followed by one red Movement marker in its first row, and five red Assault markers followed by one blue Assault marker in its second row, then Buff above Debuff from its player's view. Beside those two tokens, arrange six faction markers in two rows of three. After a gap, place one of each remaining marker in two horizontal rows of four. Map items use the token record's Name in their Id field with Type Token because the preset loader resolves GetTokenByName. Load the tray alongside the scoreboard when selecting a map. Deployment changes retain the existing tray.

## Click and selection outline for custom token bundles

Keep the sized BoxCollider on the prefab root so the remote token loader does not create a small fallback collider. Give each visible renderer GameObject the Unity Token tag. Warhall applies Token to the parent game item and changes renderer layers, but its hover and selection outlines look for the Token, Base or Selection tag on the renderer objects themselves. Declare Token in the Unity project before building. Use scripts/prepare-token-colliders.mjs and examples/token-collider/BuildTokenColliders.cs, then verify that the loaded bundle retains both the root collider and each renderer tag. Reload Warhall Test and check hover, selection and edge dragging on a fresh token. The local bundle check does not establish the in-game outline. Current builds target Windows.
