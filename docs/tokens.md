# Tokens and faction icons

Release 33 moves all game tokens into Warhall's **Tokens** menu. They are native Token records backed by shared 25 mm round GLB skins. There are no token cards, Tokens card group, front/back faces or flipping.

Release 37 uses each shared skin's exact name as the WDS menu Id. Canonical `sc_token_*` publication IDs remain registered for compatibility; run `npm run models:menus -- --apply --login` to synchronize the menu aliases after publication. The publisher also updates aliases during future replacements. See [editor compatibility](wds-editor-compatibility.md) before saving any web-editor draft.

The menu contains 16 separate tokens:

- Blue movement arrow and blue assault crosshair.
- Red movement arrow and red assault crosshair.
- Terran blue/white, Protoss yellow/white and Zerg purple/white faction markers, with a separate inverted variant for each faction.
- Blue Buff and red Debuff lightning bolts.
- Stim syringe, Burrowed, Hidden and Siege Status reminders.

The artwork is generated in Node from SVG shapes and original faction logo paths in token-artwork/factions. The vectors come from [sc2-icons](https://github.com/sc2-pulse/sc2-icons), pinned to the revision and checksums in token-artwork/sources.json. Source headers and the MIT vectorization licence are retained. Paths render directly at final resolution for both token faces and faction dropdown logos.

Each skin is a thin circular mesh with an embedded unlit PNG texture. Geometry is authored in centimetres, converted through the existing shared-asset scale adapter, and uses a 25 mm diameter. Sizes are a presentation choice, not a claim about official physical tokens. Gameplay effects remain manual.

Run npm run tokens:update to regenerate artwork and token-artwork.json, then npm run convert to generate tokens.json and remove obsolete token cards. Run npm run models:catalogue to build the portable skins and previews. Push the generated assets before publishing only these skins:

```sh
npm run models:publish -- --kind token --apply --login --accept-publication-terms
```

Use the saved login; default target is Warhall Test. Normal fingerprint reconciliation preserves unchanged skins and replaces only changed owned uploads. The publisher supplies generated thumbnails and shared defaults for each token ID. Tokens require shared catalogue publication as well as the WDS update; a data version alone cannot populate their visual models.

The faction dropdown uses icons.json with Type faction and exact faction names. These PNGs load directly through HTTPS and do not need shared skin registration. Scenario markers are separate 32 mm terrain profiles.

After updating to release 33, refresh the shared catalogue and reopen the Tokens menu. Verify all 16 entries, single-face artwork, 25 mm size and placement on Mac/Windows. This does not claim a live client render test.

## Release 42: built-in Warhall tokens

The token menu contains 16 custom tokens plus the native blue, orange, black, white and purple Warhall tokens and native 3-inch/5-inch templates (23 total). builtinTokenNames in src/tokens/package.mjs owns the native list. models:menus resolves exact public native skin names on the selected server and verifies default bindings without reuploading their models or previews.

## Editor serialization compatibility

The generator emits only Id, Name and Type for native token records, matching TokensEditor.buildTokensJson. Explanatory descriptions remain in the source tokenDefinitions for artwork/documentation but are not emitted into tokens.json. token-menu-order.json records the actual 23-token catalogue order from the release-43 editor upload; nativeTokens sorts by that order rather than definition order. This prevents opening Tokens from creating a normalization-only draft for the current catalogue.

The editor orders selected skins by its public-then-shared catalogue response (deduplicated by skin ID), not alphabetically or by the incoming JSON order. Republishing skins can change this remote order. After a deliberate catalogue change, export the Tokens panel, compare all records and refresh token-menu-order.json from that reviewed token ID sequence. Do not upload unrelated terrain normalization. The regression test compares the generated token array with the actual editor-uploaded package. This change does not fix native thumbnail previews.
