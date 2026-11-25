---
name: warhall-importer-reserve-models
description: Audit StarCraft unit rules, upgrades and cards for reserve models, and maintain their native WDS ExtraItems definitions.
---

# StarCraft importer reserve models

Review Command Center DB unit abilities, selected upgrades and tactical/faction cards on every wave, plus maintained relevant mission cards. This DB-only source policy was explicitly requested on 2026-11-25; general rules remain local and PDFs supply only missing base footprints. Use wave:update's reserveReview/tokenReview as a search index, then read each full DB rule and compare generated faction rules/cards.json. Search for SUMMON, SPAWN, SET, replacements, status markers, Faction Indicators and templates. A reference to an existing unit or a move from Reserves does not create a new model. Flag missing template dimensions or ambiguous quantities; do not invent them.

Maintain the mapping in src/warhall/extra-items.mjs. Units use ExtraItems directly. Cards use native AddExtra options (Type 7) with the exact card name and ExtraItems containing both the Card and the reserve Unit. Warhall ProcessExtraItems consumes these during normal list import. Use stable unit, rule, option and card IDs and resolve assets through normal Warhall creation APIs. The parser handles text and layout. Reserve creation belongs to native WDS data. Scale reserve model counts by the parsed roster. Keep spawned models off the battlefield in the import staging area, outside the roster and its points and supply. Count models already supplied by the roster before adding reserve stock. Use selected upgrades and cards as triggers. Verify with real New Recruit list fixtures and a local Warhall Test import.

Faction indicators and existing generic markers remain available through the token menu; maps automatically load only activation stacks. The user explicitly requested Corrosive Bile as a native Ravager ExtraItem and Bile Bomb as a native Bile Launcher ExtraItem. The native unit extra is per unit, not per model. WDSExtraItem has only Id and Type. Repeated unit references create separate units, and there is no conditional deduplication against roster selections.

## Audit baseline

| Trigger | Additional load |
| --- | --- |
| Corpser Roaches, Roachling Infestation | Three separate one-model Roachling reserve units per source unit |
| Bile Launcher, Bombard | One Bile Bomb token per imported unit |
| Ravagers, Corrosive Bile | One Corrosive Bile token per imported squad |
| Raven, Deploy Auto-Turret | Reserve Auto-Turret |
| Nova Assault Mode, Holo Decoy | Reserve Holo Decoy |
| Raynor's Raiders, Rapid Ingress | Reserve Point Defense Drone |
| Nova Covert Ops, Griffin Support | Reserve Sabotage Drone |
| Khalai, Pylon Warp-In | Reserve Pylon; native roster deduplication is unavailable |
| Kerrigan's Swarm, Omega Network | Reserve Omega Worm; native roster deduplication is unavailable |

Cocoon's Spawn Larva uses RESPAWN (2) on the active unit. Use that unit's casualties or spare models. Cocoon's separate Ravager Morph can require one reserve Ravager for a roster with an eligible Roach unit. Recheck this baseline against the current wave before adding mappings.

Read docs/native-extra-items.md for the supported mappings, native quantity behavior and unresolved conditions. Cocoon must remain an ordinary card until its roster condition can be expressed accurately.
