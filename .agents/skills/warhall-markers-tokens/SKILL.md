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

## Map loading activation stacks

Every map loads exactly two token stacks outside the standard board edge: 15 blue Movement/Assault markers and 15 red. src/tokens/tray.mjs owns the placements. No other token is automatically spawned. Separate Assault definitions are removed; Movement is the front and Assault the reverse of each 32 mm activation marker. The Shield token is removed from definitions, artwork, menu ordering and the active catalogue; native unit shield stats remain.

## Native templates and flipping

Blast Template keeps WDS Id Token5Inch, Name Blast Template and IsTemplate=true, with a custom 130 mm shared asset. Do not reset this profile to the built-in 127 mm skin during menu synchronization. The native Test client uses mesh triangles for TemplateArea, so include a filled translucent disc as well as the rim; a ring-only mesh misses models inside. Build it with examples/token-collider/BuildBlastTemplate.cs and retain blast-template.json. Contact highlighting and no attachment are native client behavior and still need a gameplay check.

Native token Flip rotates the model 180 degrees around local Z. Activation models therefore need opposing textured faces and a centred collider/pivot; no WDS flip flag or custom script is required. Use BuildTokenColliders.RunActivationTokens, preserve the two reviewed output bundles in token-model-overrides.json, and validate back-face normals and stable height after rotation. Keep the active-ID manifest so deleted cache inputs do not return on export. New native features are Test-only until production publication is requested.

## Click and selection outline for custom token bundles

Keep the sized BoxCollider on the prefab root so the remote token loader does not create a small fallback collider. Give each visible renderer GameObject the Unity Token tag. Warhall applies Token to the parent game item and changes renderer layers, but its hover and selection outlines look for the Token, Base or Selection tag on the renderer objects themselves. Match the native TokenWarhallPurple renderer tag ID (20020). A freshly declared Token can serialize as 20000 and pass the local name check while failing in Warhall. The builder reserves custom tag slot 20 and requires a Unity restart if the slot changed. Force a full bundle rebuild and independently inspect the serialized renderer tags before publishing. Use scripts/prepare-token-colliders.mjs and examples/token-collider/BuildTokenColliders.cs, then verify that the loaded bundle retains both the root collider and each renderer tag. Reload Warhall Test and check hover, selection and edge dragging on a fresh token. The local bundle check does not establish the in-game outline. Current builds target Windows.

Preserve token-model-overrides.json when regenerating catalogues: its reviewed Unity bundles retain the working collider and renderer tags. Generated GLBs are preview/source geometry and must not replace those bundles during routine publication.
