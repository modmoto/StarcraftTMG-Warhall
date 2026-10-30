# Unit rules and phase tables

Included in test data release 11 on October 30, 2026; release 12 removes duplicate weapon equipment links. Live Warhall Test layout and popup-click verification are pending. This release makes the changes available for testing; it does not establish visual verification.

## Unit panel

The primary unit-stat table remains first. Populated phase sections follow: Any Phase, Movement Phase, Assault Phase, then Melee Phase. The Melee heading refers to the official Combat Phase; gameplay references within rule effects retain the official wording. Empty sections are omitted.

Each section places its weapon rows before its clickable ability names. The weapon columns are:

| Weapon | Range | Target | RoA | Hit | Surge Type | Surge Dice | Damage | Keywords |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-14 Rifle | 12 | All | 2 | 3+ | Light | D3 | 1 | - |

This is a native WDS stat table, not a Markdown table embedded in a description. The leading name cell uses the client's existing statline title area. Weapon rows have no equipment child: the name and values appear once, without a repeated weapon link, expansion arrow or duplicate equipment popup. Abilities open their named descriptions with phase, activation type and cost on separate lines. Costs of zero, variable costs and CP/PE/BM resource types are retained.

For Marines the order is unit stats, Movement Phase / Stimpack, Assault Phase / C-14 Rifle table, and Melee Phase / Strike table. A unit with passive Any Phase abilities shows those once in an Any Phase section rather than assigning them to an incorrect turn.

## Gameplay wording and references

The current nine official English faction card PDFs supply unit ability wording and weapon values. The core rulebook's Part 11 supplies 76 shared keyword definitions. The default cards contain 175 separately named abilities; the upgrade faces supply 62 reference-only ability records. Upgrade records are not added to the default profile. Explicit references to an upgrade ability can open its definition without equipping it.

Descriptions use validated TextMeshPro `<link="recordId">text</link>` references, including Stimpack → Precision and references from one ability to another. The Marine and Marauder versions of Stimpack retain their different Precision values. A definition is linked at most once per description to limit clutter; self-links are omitted. Catalogue references do not replace PDF wording.

`rules-reference-report.json` compares the current New Recruit catalogue snapshot with the current cards. It records source hashes, catalogue IDs, phase/cost text and nested keyword relationships. Of the 45 official units, 31 have catalogue counterparts. Among the 175 default abilities, 108 effects match, three differ in wording/formatting and 64 have no counterpart. The three differences are punctuation for Zeratul's Shadow Strike, list formatting for Raynor's Orders, and “not Engaged” versus “Unengaged” for Viles' Burrow. Two additional catalogue activation/cost strings differ by spelling: “Reactive” versus “Reaction” and “Pasive” versus “Passive.” No numeric resource-cost difference was found among matched entries. There are no phase mismatches among matched entries.

Source pages and SHA-256 checksums, raw card text and parsed upgrades remain in import reports. Unit descriptions show neither source/provenance text nor base sizes, catalogue internals or manual-upgrade placeholders. The underlying base geometry is unchanged. Conditional effects, upgrade application and FAQ/errata reconciliation are not automated.

## Native client compatibility

Read-only inspection of the installed Mac Warhall Test assembly confirmed:

- `WDSDisplayable.StatlineHeaders` builds column headings from each statline's ordered attribute keys and starts a new heading row when those keys change or the display switches away from statlines.
- `WDSStatline` creates the native cells and optional per-row details container.
- Empty-type text items render section descriptions, so bold phase headings require no new client item type.
- `WDSUIElement.AppendToGroup` renders linked rule names; `ShowGroupHeader: false` suppresses the redundant generic Rule label.
- `WDSProfileLogicInstance.GetHealthPoints` only consumes the configured HP attribute. Weapon rows contain no HP and do not change unit wounds.
- `WDSItemPanel` and `RuleLinks` support the named popups and nested links.

No client executable or application cache was modified. Weapon rows use the existing fixed-width statline cells; verify wrapping and panel width with long weapon names and keyword lists in the live client before release. Unit, profile, unit-statline and equipment IDs are preserved. Named ability records, phase-heading records and weapon presentation rows have new IDs.

## Regeneration

Normal imports remain Node-only and can read the committed glossary snapshot offline:

```sh
npm run convert -- --offline
npm run check:local
```

To refresh and review the glossary after an official core-rulebook update:

```sh
npm run rules:update-keywords
```

To compare against a local New Recruit checkout after refreshing card PDFs:

```sh
npm run convert
npm run rules:compare -- /path/to/StarcraftTMG-NR
```

The comparison is informational and does not edit the catalogue or apply its values. The glossary updater validates its expected headings and fails on an incomplete extraction. Review glossary changes before publishing. Automated checks cover split abilities, costs, upgrade separation, nested links, source-specific values, primary HP, table columns and phase ordering.

Sources: [official downloads](https://archon-studio.com/downloads/starcraft-tabletop-miniatures-game), [official core rulebook](https://archon-studio.com/files/manuals/sc/StarCraft-TMG_EN.pdf), [New Recruit catalogue](https://github.com/modmoto/StarcraftTMG-NR).
