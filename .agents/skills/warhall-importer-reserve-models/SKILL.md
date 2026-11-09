---
name: warhall-importer-reserve-models
description: Audit StarCraft unit rules, upgrades and cards for reserve models, and maintain their explicit mappings in the Warhall list importer patch.
---

# StarCraft importer reserve models

Review the official unit sheets, selected upgrade rules, faction cards, tactical cards and relevant mission cards on every wave. Compare them with the generated faction rules and cards.json. Search for SUMMON, SPAWN, SET, replacements, status markers, Faction Indicators and templates, then read each full rule. A reference to an existing unit or a move from Reserves does not create a new model. Check printed template sizes and summon quantities against the official source.

Keep a small explicit mapping in the StarCraft importer patch. Use stable unit, rule, option and card IDs and resolve assets through normal Warhall creation APIs. Run it after resolving the imported army and cards. Scale reserve model counts by the parsed roster. Keep spawned models off the battlefield in the import staging area, outside the roster and its points and supply. Count models already supplied by the roster before adding reserve stock. Use selected upgrades and cards as triggers. Verify with real New Recruit list fixtures and a local Warhall Test import.

Automatic reserve loads contain models only. The map tray already supplies faction indicators and other markers.

## Audit baseline

| Trigger | Additional load |
| --- | --- |
| Corpser Roaches, Roachling Infestation | One reserve group of three Roachlings per source unit, subject to the current summon profile |
| Raven, Deploy Auto-Turret | Reserve Auto-Turret |
| Nova Assault Mode, Holo Decoy | Reserve Holo Decoy |
| Raynor's Raiders, Rapid Ingress | Reserve Point Defense Drone |
| Nova Covert Ops, Griffin Support | Reserve Sabotage Drone |
| Khalai, Pylon Warp-In | Reserve Pylon when one is not already available |
| Kerrigan's Swarm, Omega Network | Reserve Omega Worm when one is not already available |

Cocoon's Spawn Larva uses RESPAWN (2) on the active unit. Use that unit's casualties or spare models. Cocoon's separate Ravager Morph can require one reserve Ravager for a roster with an eligible Roach unit. Recheck this baseline against the current wave before adding mappings.
