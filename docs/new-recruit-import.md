# List import data

The native Warhall list importer is implemented in the separate client repository. This mod repository maintains the names, IDs, options, cards and reserve-model definitions it consumes.

`npm run lists:parse -- --input LIST.txt --output PLAN.json` runs the repository-side New Recruit parser/planner against current WDS data. It is an offline data-validation tool, not a client deployment API. Maintained lists are under `test/fixtures/lists/`; related tests check names, counts, options and card resolution.

Keep unit/profile IDs stable and preserve exact card names. Native AddExtra card options use their card's exact name and contain both that card and its reserve models. Unit reserves belong to WDSUnit.ExtraItems. Do not restore hardcoded reserve spawning in a client patch or the local parser. See [native extras](native-extra-items.md) and [upgrade data](import-options.md).

Changing rules/data can require updating list fixtures and parser expectations. Client-only layout, movement, network synchronization and additional exporter formats belong in the client repository. A passing local parser test does not establish a successful native import.
