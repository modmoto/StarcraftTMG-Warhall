# Native import extras

The maintained definitions are in src/warhall/extra-items.mjs. Test data version 151 removes the unconditional Cocoon reserve and preserves existing unit ExtraItems during PDF regeneration. Card options take their exact names from cards.json.

| Source | Native extras |
| --- | --- |
| Nova Assault Mode, Holo Decoy ability | Holo Decoy |
| Raven, Deploy Auto-Turret | Auto-Turret |
| Corpsers (Roach), Roachling Infestation | Three separate Roachling reserve units |
| Ravagers, Corrosive Bile | One Corrosive Bile token per imported squad |
| Nova Covert Ops, Griffin Support | Original card and Sabotage Drone |
| Raynor's Raiders, Rapid Ingress | Original card and Point Defense Drone |
| Khalai, Pylon Warp-In | Original card and Pylon |
| Kerrigan's Swarm, Omega Network | Original card and Omega Worm |

Unit extras live on WDSUnit.ExtraItems. Card extras use global Type 7 AddExtra options whose names match the cards. Each option includes its original card exactly once. Existing extras are merged with the required multiplicities. Regeneration is idempotent.

## Native client limits

ProcessExtraItems creates each referenced Unit using its DefaultFront and one rank. Roachling has DefaultFront 1, so three references create three individual reserve units. WDSExtraItem has only Type and Id, with no model count. The Corrosive Bile ability requires one marker per Ravager model, while native unit extras load once per imported squad. Additional markers remain available in the map tray.

Nova Stealth Mode has Tactical Stealth Suit, Head Shot and Operational Efficiency. Its maintained rules do not supply Holo Decoy, so it receives no extra.

Cocoon's Ravager Morph requires an eligible Roach unit. The native extra definition cannot express that roster condition. Cocoon therefore imports as an ordinary card without an automatic Ravager. Spawn Larva restores casualties through RESPAWN (2), using the active unit's own models.

Khalai and Omega Network require the summoned unit to be absent from the battlefield when activated. Their extras provide reserve stock. The importer cannot deduplicate that stock against an explicitly listed Pylon or Omega Worm. Repeated source entries intentionally request their extras again. Avoid adding the same reserves manually to a roster when relying on these extras.

The remaining audited rules reference existing tray markers or unavailable specialized assets. Bombard and Spawn Creep Tumor use the Bile Bomb and Creep Tumor tray stock. Faction Indicators also use tray stock. Deep Tunnel, Psionic Transfer, Gestate Dark Swarm, Force Field, Force Wall and the storm abilities mention markers that need separate asset/rules review before adding definitions. No template or replacement marker is invented by this mapping.

Placement uses Warhall's existing extra area. Card-level ExtraItems and PlacementOnImportType are not used.

## Validation

Package validation checks IDs, profiles, bases and manifest references. The native extra tests check preservation, idempotence, references, repeated entries and the absence of unconditional Cocoon and Nova Stealth extras. The maintained Terran New Recruit fixture exercises separate squads and repeated Barracks cards through the existing list planner.

These are data and importer-planning tests. A live import with an unmodified Warhall client, both players and repeated cards remains to be tested.
