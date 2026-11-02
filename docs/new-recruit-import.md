# New Recruit list import

## Current status

Warhall has two routes: pasted list text and its linked New Recruit account picker. The supplied Starcraft text export is supported by the **generic parser's unit/count syntax**; it is not the 40k GW App text format. Keep Starcraft's `ListParsingAlgorithm: 0`. The [40k reference configuration](https://github.com/RodriCas85/test/blob/main/40k/gameconfig.json) uses `3` (`Futuristic`), whose inspected unit-heading regex expects entries such as `Unit (100 pts)`, not `4x Marauders (410, 2S): ...`.

The user confirms that unit import actually works through the clipboard route, not merely that the prompt appears. The separate textbox route leaves Deploy buttons disabled. The clipboard prompt checks faction detection; textbox validation checks faction plus parsed units. An offline C# harness using the inspected generic parser's parse/header/count methods and the actual normalizer returned **eight units, 28 models and all supplied upgrade names** from the exact sample. It did not reproduce the disabled-button issue. The user's successful clipboard unit import establishes that the existing unit path is usable; the offline check does not establish exact live counts/upgrades or textbox behavior. Check event wiring, loaded hierarchy/configuration and exceptions in the textbox validation path without replacing the working unit parser.

The current linked-account client reads NR books from `systems[NrApi.sysver]`, with `sysver` initialized to the fixed string `5` in the inspected assembly. It does not select a Starcraft system from our WDS configuration. Setting the 40k parsing enum does not change this. Direct Starcraft account-list import needs client/API work: select the correct account system, support that system's export/list type and feed its text or structured roster into the common Starcraft import path. Do not infer support for BattleScribe-backed systems from the existing account login alone. No NR credentials are accessed by this repository.

## Repository-side import plan

```sh
npm run lists:parse -- --input my-list.txt --output import-plan.json
```

This is a **validated planning/export command, not a Warhall deployment API**. `src/lists/new-recruit.mjs` accepts the Starcraft NR text format and resolves exact case-insensitive names against current WDS records. It returns:

- Separate unit selections, model counts and mineral/supply values; repeated squads remain separate.
- Upgrades mapped to unit-scoped WDS option IDs and their linked rules. HP increases and weapon replacements use native modified-profile mappings; conditional abilities still require play decisions. See [import options](import-options.md).
- Tactical and faction card IDs, preserving duplicates such as two Barracks cards.
- Deployment candidates with their menu indices/template IDs and deployment-card IDs.
- Mission candidates with their scoring-card IDs.

Unknown units/cards/upgrades and inconsistent mineral/supply totals fail instead of being silently skipped. Gas/CP totals are retained from the heading; gas costs are not independently checked. The parser currently supports the shown English Starcraft text structure, not arbitrary NR files, JSON rosters or all possible export layouts.

The exact user sample is in `test/fixtures/lists/terran-anti-toss-ravager.txt`. Its expected plan is in `examples/new-recruit/terran-import-plan.json`:

- 8 unit selections / 28 models, 2,000 minerals, 200 gas, 11 supply, 7 CP.
- 6 tactical cards, including two Barracks, plus Terran Armed Forces as a faction card.
- Breach and Typhoon as two deployment candidates, with both deployment-card references.
- Divide and Conquer and Gather the Resources as two mission candidates.

Do not apply multiple deployment layouts or scoring missions simultaneously. Preserve the exported candidates, let the players choose the active scenario, and only then invoke the normal Battlefield deployment/scoring behavior. Mission import must not independently create board markers. Spawn the requested cards separately rather than pretending tactical cards are model units or attaching them to Jim Raynor.

## Warhall developer integration

1. Preserve the working generic clipboard unit parser. Route textbox validation/deployment through the same normalizer, faction lookup and parser with the same loaded game data. Extend the common result with the Starcraft card/scenario sections; a replacement unit parser is not established as necessary. The JS plan is a reference for these additional sections.
2. In `NewRecruitLogin.ValidateInputAsListCore`, validate the visible input's current text, report parser/load errors, and update both Deploy buttons together. Ensure the InputField change event invokes validation; clear `_startedValidation` reliably after success or failure. Show recognized faction, unit/model counts and unresolved entries instead of leaving a disabled button unexplained. Do not make invalid lists deployable by simply forcing the buttons enabled.
3. In `ListParserMono`, retain the Starcraft sections instead of only scanning for unit names. Convert the resolved units and their model counts into the normal `WDSArmy` pipeline; apply known upgrade references once and preserve the roster's selected upgrades. Existing WDS option/rule conversion needs live verification.
4. Use the ordinary card-spawn path for faction, tactical, deployment and mission cards, preserving duplicate counts. Present scenario candidates before changing the board; deployment selection owns markers/borders. Preserve the scoring-only meaning of missions.
5. Snapshot the whole import and apply it as one validated operation. If a required selection is unresolved, show the error and leave the previous army/board unchanged. Re-importing or double-clicking Deploy must not duplicate content accidentally.
6. Make the NR system/account picker game-aware. Prefer structured list data where the official API provides it; otherwise use the same text adapter. Do not log tokens/passwords. Confirm the NR API supports the Starcraft system/export before claiming linked-account support.

## Acceptance

The sample enables both Deploy buttons when pasted, deploys eight squads containing 28 models with their correct upgrade references, creates the seven faction/tactical card instances, and retains two deployment/two mission choices and their cards. Importing through the NR account picker yields the same result. The clipboard offer alone is not a successful import test.

## Ninth Age definition comparison

The actual Warhall Test Ninth Age source is [T9A-3e/WDS/gameconfig.json](https://github.com/WDS-Games-Admin/T9A-3e/blob/main/WDS/gameconfig.json), which selects ListParsingAlgorithm=1. This activates the client's built-in WdsUnitParserT9A (points-first, points-last and bracket-points formats). Starcraft selects 0 (generic); 40k selects 3 (GW App/Futuristic). These enums choose client code, not a configurable roster grammar.

Both Ninth Age and Starcraft define faction membership through hierarchy.json -> Factions and resolve imported text against WDS unit Name values. Clipboard text does not require changing our PDF-derived unit IDs to NR catalogue IDs. Starcraft's Terran/Marauders/Marines/Medics/Siege Tank/Jim Raynor definitions already resolve the supplied list. There is no observed additional WDS switch that separately enables the manual textbox while leaving clipboard import enabled. Do not change Starcraft to enum 1 or 3 merely to imitate another game.
