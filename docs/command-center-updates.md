# Command Center wave updates

As requested on 2026-11-25, the official public Command Center database supplies units, stats, weapons, abilities, upgrades, squad sizes/costs and tactical cards. The starting reference is [StarcraftTMG-NR's warhall-import-script](https://github.com/modmoto/StarcraftTMG-NR/blob/92fa314c31bac64514e6832edbe6759537444ee1/update-official.mjs). This repository adapts its public Firestore source directly to the existing Warhall generator; it does not modify New Recruit XML.

The importer requests only `army_units` and `tactical_cards`. It never requests `rules_sections`. General `Starcraft/rules.json`, `rulebook.json` and `rule-keywords.json` remain unchanged. Unit ability text and tactical card text do update from the DB. Existing card images are retained; new cards have text until reviewed artwork is available. Card text updates do not prove the old printed artwork is current.

## Inventory and application

```sh
npm run wave:update
npm run wave:update -- --offline
npm run wave:update -- --source-input /absolute/path/source.json
```

These commands write the downloaded source, inventory and (when all bases are known) a validated candidate under `.cache/wave-update/`. They do not write the maintained dataset. The report lists new/existing units, missing bases, missing selected models, source conflicts, separate blue/green proposals and complete source wording for reserve/token review. A missing previously mapped unit blocks application rather than silently deleting it. New DB identities require an explicit entry in `command-center-mapping.json`.

The mapping retains historical `pdf_` IDs for compatibility with existing lists, models, profile assignments and native ExtraItems. The prefix records ID history, not the current source. Existing weapon source IDs and optional upgrade identities are mapped explicitly so DB ordering cannot renumber them. Consolidation preserves ability IDs referenced by the retained general rulebook.

After the actual blue and green proposal lists have been approved separately, apply that exact snapshot fingerprint:

```sh
npm run wave:update -- --source-input .cache/wave-update/command-center.json --apply --approve-blue FINGERPRINT --approve-green FINGERPRINT
npm run check:local
```

The approval flags record the operator's already obtained approval; they do not replace asking for it. Source changes invalidate the fingerprint. Application validates the complete package first, saves `sources/command-center.json` and `command-center-report.json`, and advances manifest/version together only when generated game data changes. It does not publish skins, push branches or release production.

`check:local` rebuilds from the applied report's source mode. Until the first DB migration is applied, it verifies the existing PDF baseline offline. This is a read-only legacy check, not a PDF update route. Afterwards it rebuilds entirely from the saved DB snapshot and reviewed footprint mapping. `convert` defaults to DB input; direct writes to `Starcraft/` are blocked in favor of the audited wave command.

## PDF exception: base footprints only

The DB snapshot currently has no base-size field. Existing reviewed footprints are stored with PDF URL, page and hash in `command-center-mapping.json`. To fill missing sizes from downloaded official English P2P sheets:

```sh
npm run wave:bases -- --pdf-dir /absolute/path/official-pdfs
npm run wave:bases -- --pdf-dir /absolute/path/official-pdfs --apply
```

The base reader reads card identity and the printed footprint only. It does not read unit stats, weapons or ability text. It fills missing mappings, retains existing sizes and rejects conflicting matches. It makes no HTTP request. Acquire PDFs from the official publisher and keep their filenames. Flight stands retain the reviewed 100 mm convention.

## Wave 4 inventory, 2026-11-25

The captured DB has 59 units and 59 tactical cards. All 45 existing units match stable IDs; 14 are new. Their base sizes and selected models are still missing:

- Protoss: Alarak, Reaver, Scarab, Phasing Scarab, Solarite Scarab, Slayer (Stalker), Tal'darim Pylon.
- Terran: Firebat.
- Zerg: Stukov, Infested Goliath, Infested Marine, Infested Missile Turret, Infested Siege Tank, Infested Trooper.

Both official download indexes still list only base/W2/W3 sheets. The downloaded current base sheets from starcraft-tmg.com and the Archon sheets contain none of these 14 unit cards. Direct `StarCraft-FACTION-P2P-W4-Card-Sheets-A4_EN.pdf` requests to Archon returned 404. Do not invent sizes. Re-run the footprint reader when the official PDFs are available. Publisher product-page dimensions have not been substituted for the requested PDF evidence.

Reserve and token audits are prepared from DB wording, including Reaver/Scarab and Fire Wall references; they still need decisions on quantities, optional triggers, physical sizes and model assets. The user authorized required new tokens. Preserve existing native ExtraItems; do not create client patches. Finish these asset steps and the blue/green review before applying and publishing Wave 4 to Test. Promote to production only on a release request. See [releases](releases.md).
