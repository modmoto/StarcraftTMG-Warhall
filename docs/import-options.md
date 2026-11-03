# Selected unit upgrades

Test data 61 includes native WDS options for the upgrade abilities and weapon profiles printed on the unit-card upgrade faces. Default units keep their original rules, attributes and weapons.

The option IDs deliberately equal their readable names, such as `Kinetic Foam` and `C-14 Rifle`. Warhall's generic WdsUnitParser builds its FullOptions dictionary using IDs, so opaque generated IDs fail to match exported option names. A single root option definition is shared when names match; modifiedunit/modifiedprofile records scope the effect to the actual unit and profile. No parser or client-cache patch is installed.

## Display and effects

- Selected upgrade names appear table-header blue (#2596be) below default rules and before weapon phases. Weapon names keep their existing colours. Values and keywords that differ from the original weapon are blue; unchanged values remain white.
- Kinetic Foam replaces the Marauder's top stat row with HP 6. Its default row remains HP 5 when unselected. The 6 is blue. The native wounds reader receives an invisible zero-size `(6)` annotation because it parses numeric expressions without stripping rich-text tags; the visible value and parser annotation are validated to agree. This is one HP row, not an additive +1 row.
- Jim Raynor's C-14 Rifle replaces Commando Rifle while retaining the revolver and bayonet.
- Goliath's Scatter Missiles or Haywire Missiles replace Hellfire Missiles in its Assault phase. Applying another alternative removes the previous weapon presentation.
- Immortal's Left/Right Phase Disruptors replace only the corresponding Photon Disruptor. Fury Unyielding adds its passive ability and preserves both weapons.
- Conditional alternatives appear in green brackets in linked notes beside the affected profile or below its weapon. Veteran of Tarsonis shows Armour 4+ [3+] while keeping the real Armour at 4+ until its positional condition applies. Spending resources and resolving active/reaction timing remain manual.

Empty layout containers keep the stat row, selected rules and individual weapon slots in stable positions. Native WDSRef.Ref additions/removals target those containers. Shared skin profile IDs stay unchanged, so model uploads are unnecessary.

Printed replacement notes are authoritative. Where the PDF omits a repeated note, a unique same-phase weapon, explicit left/right side, or unique weapon-name suffix resolves the slot. Ambiguous replacements fail during generation. The New Recruit catalogue's named choices were compared for Raynor, Goliath and Immortal.

`applyProfileOptions` provides a read-only preview using the inspected native reference operations. Regression checks cover combinations/order, real HP values, retained weapons, table-header blue (#2596be) selected names and shared Marine/Raider Stimpack. Marines and Raynor's Raiders use Stimpack (Marines); Marauders use Stimpack (Marauders).

After refreshing the game data, re-import the list or create fresh units to resolve the new WDS options. Previously spawned fallback rule references are not retroactively converted into option selections. Live client import/layout testing is still needed; passing adapter checks is not proof of a played-room test.

Presentation groups use the native Profile type to render inline, without collapsible summaries. Weapon table headers remain plain text; rule descriptions retain keyword links.

Each weapon is rendered as one text block: its phase heading (for the first weapon), name, table and linked keywords use single line breaks. Separate phases retain native block spacing. Blue weapon choices state which original weapon is replaced and repeat the selected profile and keywords in the rule popup.


## Reviewed Wave 3 upgrade effects

The official unit/upgrade cards remain authoritative. The New Recruit references agree on Guidance, Kinetic Foam, Laser Targeting Systems and Grooved Spines; apostrophe variants are normalized. New Recruit spells Resonating Glaives with an extra `i`, while the PDF importer reads Resonating Glaves. Both identify the active 1 PE RoA buff; selecting it does not apply it automatically.

| Upgrade | Profile display |
| --- | --- |
| Guidance | Glaive Cannon ANTI-EVADE (2), blue; RoA unchanged |
| Kinetic Foam | HP 6, blue; native wound count 6 |
| Laser Targeting Systems / Grooved Spines | LONG RANGE (16") added in blue; printed base range retained |
| Ares-Class Targeting System | PRECISION (1), blue on Autocannon and Underbelly Machine Gun |
| Hydriodic Bile | Acid Saliva Surge Light (D3+1), blue |
| Adrenal Glands | Blue PRECISION (2) below Claws or selected Shredding Claws |
| Fury of the Nerazim / We Stand As One | Green conditional INSTANT / PRECISION (2) on the affected weapon |
| Fury Unyielding / For the Ancients | Separate green conditional CRITICAL HIT (1) / PRECISION (1) on both ranged weapons, including replacements |
| Slugthrower / Grenades - Frag | Green C-14-only ANTI-EVADE (1) / alternate Light (D6) Surge; normal Surge retained |
| Veteran of Tarsonis / Creep Speed | Green conditional Armour / Speed alternatives; base values unchanged |
| Ancillary Carapace / Lurking | Green conditional TOUGH / Evade notes |
| My Life for Aiur | Blue incremented IMPACT dice in the profile summary |
| A-13 Flash Grenade Launcher / Bloated Bile Ducts | Selected Optical Flare range 16" / Corrosive Bile area 2" definition, changed value blue |
| Advanced Medic Facilities / Stabilizer Medpacks | Blue Supply-Pool-only 0 / +1 model for calculating healing effects |
| Explosive Shrapnel Shells | Raven summary shows blue spawned Auto-Turret Surge Light (D3+1); a separately spawned turret does not inherit its parent's selected options automatically |
| Potent Bile | Blue DEBUFF Armour (1) note for Corrosive Bile's target |
| Paid or reactive upgrades, including Resonating Glaves | Blue selected name and Upgrade/type/cost popup; no automatic profile change |
| Burrow Ambush, Tunneling Claws, Internal Tech Module, Corvid Reactor | Rules retained; these change deployment, permissions or resource use rather than a fixed profile value |

`import-report.json` records the display treatment of every upgrade under each unit's `upgradeDisplay`. Conditional notes link back to the full original rule, including its exact condition. Independent effect containers preserve simultaneous bonuses across weapon swaps and option order; numeric stat effects and conditional notes compose without resetting each other. No runtime condition detector or client-cache patch is installed.
