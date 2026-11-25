# StarCraft TMG data and assets for Warhall

This repository maintains the StarCraft WDS dataset, Command Center DB importer, model catalogue and Unity asset builders. Warhall client implementation is maintained separately.

## Repository layout

- `Starcraft/`: the single generated game dataset, including its referenced card art and icons.
- `src/` and `scripts/`: maintained importers, generators, validators and publication tools.
- `model-assets/`: content-addressed models, textures, bundles and required source previews.
- `examples/ramp-collider/` and `examples/token-collider/`: active Unity editor asset builders.
- Root JSON files: reviewed source selections, calibration, rule overrides and publication inputs.
- `.agents/skills/`: reusable workflows for rules, models, tokens and releases.
- `test/`: generator, data and publication contract checks.

## Generate and validate

Use Node.js 22.13 or later. Install dependencies with `npm ci`, then run:

```sh
npm run wave:update
npm run validate
npm run check:local
```

Wave updates use the public Command Center DB for units, stats, weapons, abilities, upgrades and tactical cards. The general rulebook and keyword glossary stay unchanged. Only missing base footprints may come from official card PDFs, through `npm run wave:bases -- --pdf-dir PATH --apply`. Existing sizes and all established IDs are preserved.

`wave:update` downloads and audits a candidate without changing `Starcraft/`. `--offline` reuses `sources/command-center.json`; `--source-input FILE` reads a saved DB snapshot. Apply a validated candidate with `--apply` after resolving missing bases and reviewing the separate blue/green lists. See [DB wave updates](docs/command-center-updates.md). Legacy PDF/New Recruit converters can write only to an explicit separate comparison output, never the maintained dataset.

Update artwork or terrain through their generators, not by hand-editing generated JSON:

```sh
npm run tokens:update
npm run terrain:update -- --offline
npm run models:catalogue
```

Run generators in the workflow order documented by the corresponding skill. Native formation choices and maintained terrain fields must survive regeneration. Preserve stable IDs, reviewed dimensions and poses, clickable rule links, and native WDS ExtraItems for reserve models.

## Test and production

Work and push directly on `main`, which feeds Warhall Test. The `release` branch feeds production. Both use `Starcraft/`; promotion advances release to the tested main commit without copying folders or rewriting history.

Both servers use the exact game name `Starcraft`. Resolve their IDs independently. The intended manifests are:

- Test: `https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/refs/heads/main/Starcraft/manifest.json`
- Production: `https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/refs/heads/release/Starcraft/manifest.json`

A release also publishes missing/changed shared skins and verifies default/menu bindings. Git promotion alone does not register skins. See [releases](docs/releases.md), [model publication](docs/model-publication.md) and [saved authentication](docs/local-authentication.md).

## Asset maintenance

Keep assets referenced by main, release, generator inputs or published skins on either server. A local catalogue scan alone is insufficient. Remove obsolete shared assignments and owned skins before deleting their otherwise unreferenced files. Keep source/preview companions required for rebuilding assets. Do not overwrite hash-named files or rewrite published history to perform routine cleanup.

`.cache/` and `node_modules/` are ignored local data. Preserve downloaded sources required by offline generation and server-scoped publication checkpoints. Remove registered Git worktrees with `git worktree remove`, not a raw directory delete.

## Focused documentation

- [Unit rules and presentation](docs/unit-rules.md)
- [Native reserve models](docs/native-extra-items.md)
- [Cards](docs/cards.md) and [rulebook](docs/rulebook.md)
- [Model calibration](docs/model-calibration.md)
- [Terrain calibration](docs/terrain-calibration.md) and [Unity build](docs/terrain-collider-build.md)
- [Tokens and templates](docs/tokens.md)
- [Deployments](docs/shared-deployments.md) and [mission markers](docs/mission-markers.md)
- [Editor data comparison](docs/wds-editor-compatibility.md)
