# Tokens and faction icons

Release 33 moves all game tokens into Warhall's **Tokens** menu. They are native Token records backed by shared 25 mm round GLB skins. There are no token cards, Tokens card group, front/back faces or flipping.

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
