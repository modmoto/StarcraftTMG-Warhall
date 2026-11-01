# Tokens and faction icons

Release 29 adds 13 round 25 mm tokens under **Cards → Tokens**. They use the existing native round-card objects because those support front/back textures and Flip; regular imported skin tokens have no corresponding two-face texture configuration. They are shared HTTPS assets and require no machine-local cache installation or separate skin registration.

- Blue and red activation markers: movement arrow on the front, assault crosshair on the reverse.
- Terran blue/white, Protoss yellow/white and Zerg purple/white faction markers. Each has a separate inverted white/colour version so two players can distinguish the same faction. Their reverse repeats their faction face.
- One reversible buff/debuff token, blue lightning bolt / red lightning bolt.
- Stim, Burrowed, Hidden and Siege Status reminders. These have the same face on both sides; their gameplay effects are applied manually.

The artwork is generated in Node from SVG shapes and original faction logo paths in `token-artwork/factions`. Release 30 replaces the grainy raster masks with vector paths from [sc2-icons](https://github.com/sc2-pulse/sc2-icons), pinned to the revision recorded in the source manifest. The paths are rendered directly at final resolution for both tokens and dropdown logos. The emblem source URLs, source checksums and vector provenance are in `token-artwork/sources.json`. These are existing StarCraft emblems, not newly invented faction symbols. Token sizes are a presentation choice, not a claim about official physical token dimensions.

`npm run tokens:update` regenerates hash-named PNG faces and `token-artwork.json`. `npm run convert` incorporates the token cards, hierarchy group and `icons.json`. `npm run check:local` checks deterministic artwork and all token references. The PDF card generator preserves token cards and their menu group. Scenario markers are separate 32 mm terrain profiles and remain outside this token menu.

The faction dropdown's extra left margin is the image slot. The inspected client uses `PanelNewUnit` → `UI.CreateDropdownOptions` → `WDSAccess.GetFactionIcon` and loads `Type: faction` icons by exact faction name from icons.json. Protoss, Terran and Zerg have no whitespace in their names. The supplied coloured transparent PNGs fill that slot after updating and downloading the new images.

Refresh Starcraft to release 31, then test Cards → Tokens, both activation faces, buff/debuff Flip, both faction palettes, status reminders and all faction dropdown logos. Native flip behavior and image rendering still require a live client check.

Release 30 changes Stim to a syringe and uses plain up/down arrows without the extra bars for buff/debuff, matching the reference token style. Activation faces retain their arrow/crosshair design. The upstream SVG copyright headers and MIT vectorization licence are retained in token-artwork/factions.

Release 31 changes buff/debuff back to lightning-bolt artwork, matching the uploaded physical-token reference. The activation token retains the movement arrow and assault crosshair, and Stim retains its syringe.
