# Wave 4 profile display review

Source snapshot: `1aef1f80be49f60f04a51f724303aff0587b1803c4f19d467d39215f94bfdae6`. General rulebook and glossary remain unchanged.

## Passive changes (blue)

### 1. Protoss — Adepts: GLAIVE STRIKE

Affected: Combat Weapon. Display: replacement weapon; changed fields blue.

Current:
```json
{
  "Rng": "E",
  "Tgt": "Ground",
  "RoA": "1",
  "Hit": "4+",
  "Surge": "Light",
  "S.Die": "D3",
  "Dmg": "1",
  "Keyword": "PIERCE Light (2)",
  "Notes": "\u2191 FOR STRIKE"
}
```

Proposed:
```json
{
  "Rng": "E",
  "Tgt": "Ground",
  "RoA": "1",
  "Hit": "4+",
  "Dmg": "1",
  "Surge": "Light",
  "S.Die": "D3",
  "Keyword": "PIERCE Light (2)",
  "Notes": "FOR Strike"
}
```

Original source rule/choice target: `pdf_Protoss_equipment_adepts_upgrade_1_choice`.

### 2. Zerg — Defiler: CANCEROUS BITE

Affected: Combat Weapon. Display: replacement weapon; changed fields blue.

Current:
```json
{
  "Rng": "E",
  "Tgt": "Ground",
  "RoA": "2",
  "Hit": "3+",
  "Surge": "-",
  "S.Die": "-",
  "Dmg": "2",
  "Keyword": "CRITICAL HIT (1), SIDEARM"
}
```

Proposed:
```json
{
  "Rng": "E",
  "Tgt": "Ground",
  "RoA": "2",
  "Hit": "3+",
  "Dmg": "2",
  "Surge": "-",
  "S.Die": "-",
  "Keyword": "CRITICAL HIT (1), SIDEARM"
}
```

Original source rule/choice target: `pdf_Zerg_equipment_defiler_upgrade_2_choice`.

### 3. Terran — Goliath: Ares-Class Targeting System

Affected: Ability. Display: permanent weapon change; blue: AUTOCANNON; permanent weapon change; blue: UNDERBELLY MACHINE GUN.

Current:
```json
{
  "Phase": "Any Phase",
  "Type": "Passive",
  "Effect": "This Unit's Autocannon and Underbelly Machine Gun weapons gain PRECISION (1)."
}
```

Proposed:
```json
{
  "Phase": "Any Phase",
  "Type": "Passive",
  "Effect": "This Unit\u2019s Autocannon and Underbelly Machine Gun weapons gain PRECISION (1)."
}
```

Original source rule/choice target: `pdf_Terran_rule_goliath_upgrade_any_phase_ares_class_targeting_system`.

### 4. Terran — Goliath: SCATTER MISSILES

Affected: Assault Weapon. Display: replacement weapon; changed fields blue.

Current:
```json
{
  "Rng": "18",
  "Tgt": "Ground",
  "RoA": "6",
  "Hit": "5+",
  "Surge": "Light",
  "S.Die": "D3",
  "Dmg": "1",
  "Keyword": "INDIRECT FIRE, LOCKED IN (6), LONG RANGE (24\"), SIDEARM",
  "Notes": "\u2191 FOR HELLFIRE MISSILES"
}
```

Proposed:
```json
{
  "Rng": "18",
  "Tgt": "Ground",
  "RoA": "6",
  "Hit": "5+",
  "Dmg": "1",
  "Surge": "Light",
  "S.Die": "D3",
  "Keyword": "INDIRECT FIRE, LOCKED IN (6), LONG RANGE (24\"), SIDEARM",
  "Notes": "FOR Hellfire Missiles"
}
```

Original source rule/choice target: `pdf_Terran_equipment_goliath_upgrade_1_choice`.

### 5. Terran — Goliath: HAYWIRE MISSILES

Affected: Assault Weapon. Display: replacement weapon; changed fields blue.

Current:
```json
{
  "Rng": "12",
  "Tgt": "Ground",
  "RoA": "3",
  "Hit": "3+",
  "Surge": "Armoured",
  "S.Die": "D3",
  "Dmg": "1",
  "Keyword": "PIERCE Armoured (3), SIDEARM",
  "Notes": "\u2191 FOR HELLFIRE MISSILES"
}
```

Proposed:
```json
{
  "Rng": "12",
  "Tgt": "Ground",
  "RoA": "3",
  "Hit": "3+",
  "Dmg": "1",
  "Surge": "Armoured",
  "S.Die": "D3",
  "Keyword": "PIERCE Armoured (3), SIDEARM",
  "Notes": "FOR Hellfire Missiles"
}
```

Original source rule/choice target: `pdf_Terran_equipment_goliath_upgrade_2_choice`.

### 6. Protoss — Immortal: LEFT PHASE DISRUPTOR

Affected: Assault Weapon. Display: replacement weapon; changed fields blue.

Current:
```json
{
  "Rng": "12",
  "Tgt": "Ground",
  "RoA": "4",
  "Hit": "3+",
  "Surge": "Armoured",
  "S.Die": "D3",
  "Dmg": "1",
  "Keyword": "PIERCE Armoured (3)"
}
```

Proposed:
```json
{
  "Rng": "12",
  "Tgt": "Ground",
  "RoA": "4",
  "Hit": "3+",
  "Dmg": "1",
  "Surge": "Armoured",
  "S.Die": "D3",
  "Keyword": "PIERCE Armoured (3)",
  "Notes": "FOR Left Photon Disruptor"
}
```

Original source rule/choice target: `pdf_Protoss_equipment_immortal_upgrade_1_choice`.

### 7. Protoss — Immortal: RIGHT PHASE DISRUPTOR

Affected: Assault Weapon. Display: replacement weapon; changed fields blue.

Current:
```json
{
  "Rng": "12",
  "Tgt": "Ground",
  "RoA": "4",
  "Hit": "3+",
  "Surge": "Armoured",
  "S.Die": "D3",
  "Dmg": "1",
  "Keyword": "PIERCE Armoured (3), SIDEARM"
}
```

Proposed:
```json
{
  "Rng": "12",
  "Tgt": "Ground",
  "RoA": "4",
  "Hit": "3+",
  "Dmg": "1",
  "Surge": "Armoured",
  "S.Die": "D3",
  "Keyword": "PIERCE Armoured (3), SIDEARM",
  "Notes": "FOR Right Photon Disruptor"
}
```

Original source rule/choice target: `pdf_Protoss_equipment_immortal_upgrade_2_choice`.

### 8. Zerg — Infested Goliath: Ares-Class Targeting System

Affected: Ability. Display: permanent weapon change; blue: Autocannon; permanent weapon change; blue: Underbelly Machine Gun.

Current:
```json
null
```

Proposed:
```json
{
  "Phase": "Any Phase",
  "Type": "Passive",
  "Effect": "This Unit\u2019s Autocannon and Underbelly Machine Gun weapons gain PRECISION (1)."
}
```

Original source rule/choice target: `pdf_Zerg_rule_infested_goliath_upgrade_any_phase_ares_class_targeting_system`.

### 9. Zerg — Infested Goliath: Scatter Missiles

Affected: Assault Weapon. Display: replacement weapon; changed fields blue.

Current:
```json
null
```

Proposed:
```json
{
  "Rng": "18",
  "Tgt": "Ground",
  "RoA": "6",
  "Hit": "5+",
  "Dmg": "1",
  "Surge": "Light",
  "S.Die": "D3",
  "Keyword": "INDIRECT FIRE, LOCKED IN (6), LONG RANGE (24\"), SIDEARM",
  "Notes": "FOR Hellfire Missiles"
}
```

Original source rule/choice target: `pdf_Zerg_equipment_infested_goliath_upgrade_weapon_assault_phase_scatter_missiles_choice`.

### 10. Zerg — Infested Goliath: Haywire Missiles

Affected: Assault Weapon. Display: replacement weapon; changed fields blue.

Current:
```json
null
```

Proposed:
```json
{
  "Rng": "12",
  "Tgt": "Ground",
  "RoA": "3",
  "Hit": "3+",
  "Dmg": "1",
  "Surge": "Armoured",
  "S.Die": "D3",
  "Keyword": "PIERCE Armoured (3), SIDEARM",
  "Notes": "FOR Hellfire Missiles"
}
```

Original source rule/choice target: `pdf_Zerg_equipment_infested_goliath_upgrade_weapon_assault_phase_haywire_missiles_choice`.

### 11. Zerg — Infested Marine: Infested Missile Launcher - Acid Blast

Affected: Assault Weapon. Display: additional specialist weapon.

Current:
```json
null
```

Proposed:
```json
{
  "Rng": "6",
  "Tgt": "All",
  "RoA": "3",
  "Hit": "3+",
  "Dmg": "1",
  "Surge": "-",
  "S.Die": "-",
  "Keyword": "CRITICAL HIT (1), LONG RANGE (12\"), PIERCE Armoured (2), SPECIALIST",
  "Notes": "FOR Infested C-14 Rifle"
}
```

Original source rule/choice target: `pdf_Zerg_equipment_infested_marine_upgrade_weapon_assault_phase_infested_missile_launcher_acid_blast_choice`.

### 12. Zerg — Infested Marine: Infested Missile Launcher - Scourgeshot

Affected: Assault Weapon. Display: additional specialist weapon.

Current:
```json
null
```

Proposed:
```json
{
  "Rng": "12",
  "Tgt": "All",
  "RoA": "3",
  "Hit": "3+",
  "Dmg": "1",
  "Surge": "-",
  "S.Die": "-",
  "Keyword": "BURST FIRE 6\" (2), SPECIALIST",
  "Notes": "FOR Infested C-14 Rifle"
}
```

Original source rule/choice target: `pdf_Zerg_equipment_infested_marine_upgrade_weapon_assault_phase_infested_missile_launcher_scourgeshot_choice`.

### 13. Zerg — Infested Marine: Wild Mutation

Affected: Combat Weapon. Display: replacement weapon; changed fields blue.

Current:
```json
null
```

Proposed:
```json
{
  "Rng": "E",
  "Tgt": "Ground",
  "RoA": "2",
  "Hit": "3+",
  "Dmg": "1",
  "Surge": "Armoured",
  "S.Die": "D3+1",
  "Keyword": "-",
  "Notes": "FOR Infested C-14 Rifle"
}
```

Original source rule/choice target: `pdf_Zerg_equipment_infested_marine_upgrade_weapon_combat_phase_wild_mutation_choice`.

### 14. Terran — Jim Raynor: C-14 RIFLE

Affected: Assault Weapon. Display: replacement weapon; changed fields blue.

Current:
```json
{
  "Rng": "12",
  "Tgt": "All",
  "RoA": "6",
  "Hit": "3+",
  "Surge": "Light",
  "S.Die": "D3+1",
  "Dmg": "1",
  "Keyword": "BURST FIRE 8\" (3)",
  "Notes": "\u2191 FOR COMMANDO RIFLE"
}
```

Proposed:
```json
{
  "Rng": "12",
  "Tgt": "All",
  "RoA": "6",
  "Hit": "3+",
  "Dmg": "1",
  "Surge": "Light",
  "S.Die": "D3+1",
  "Keyword": "BURST FIRE 8\" (3)",
  "Notes": "FOR Commando Rifle"
}
```

Original source rule/choice target: `pdf_Terran_equipment_jim_raynor_upgrade_0_choice`.

### 15. Terran — Marauders: Laser Targeting Systems

Affected: Ability. Display: permanent weapon change; blue: QUAD K12.

Current:
```json
{
  "Phase": "Assault Phase",
  "Type": "Passive",
  "Effect": "This Unit's Quad K12 weapon gains LONG RANGE (16\")."
}
```

Proposed:
```json
{
  "Phase": "Assault Phase",
  "Type": "Passive",
  "Effect": "This Unit\u2019s Quad K12 weapon gains LONG RANGE (16\")."
}
```

Original source rule/choice target: `pdf_Terran_rule_marauders_upgrade_assault_phase_laser_targeting_systems`.

### 16. Terran — Marines: AGG-12

Affected: Assault Weapon. Display: additional specialist weapon.

Current:
```json
{
  "Rng": "12",
  "Tgt": "Ground",
  "RoA": "2",
  "Hit": "3+",
  "Surge": "Armoured",
  "S.Die": "D3",
  "Dmg": "1",
  "Keyword": "LONG RANGE (18\"), SPECIALIST",
  "Notes": "\u2191 FOR C-14 RIFFLE"
}
```

Proposed:
```json
{
  "Rng": "12",
  "Tgt": "Ground",
  "RoA": "2",
  "Hit": "3+",
  "Dmg": "1",
  "Surge": "Armoured",
  "S.Die": "D3",
  "Keyword": "LONG RANGE (18\"), SPECIALIST",
  "Notes": "FOR C-14 Rifle"
}
```

Original source rule/choice target: `pdf_Terran_equipment_marines_upgrade_1_choice`.

### 17. Terran — Marines: ROCKET LAUNCHER

Affected: Assault Weapon. Display: additional specialist weapon.

Current:
```json
{
  "Rng": "12",
  "Tgt": "Ground",
  "RoA": "4",
  "Hit": "3+",
  "Surge": "-",
  "S.Die": "-",
  "Dmg": "1",
  "Keyword": "INDIRECT FIRE, LONG RANGE (18\"), SIDEARM, SPECIALIST"
}
```

Proposed:
```json
{
  "Rng": "12",
  "Tgt": "Ground",
  "RoA": "4",
  "Hit": "3+",
  "Dmg": "1",
  "Surge": "-",
  "S.Die": "-",
  "Keyword": "INDIRECT FIRE, LONG RANGE (18\"), SIDEARM, SPECIALIST"
}
```

Original source rule/choice target: `pdf_Terran_equipment_marines_upgrade_2_choice`.

### 18. Terran — Marines: BAYONET

Affected: Combat Weapon. Display: replacement weapon; changed fields blue.

Current:
```json
{
  "Rng": "E",
  "Tgt": "Ground",
  "RoA": "2",
  "Hit": "5+",
  "Surge": "-",
  "S.Die": "-",
  "Dmg": "1",
  "Keyword": "-",
  "Notes": "\u2191 FOR STRIKE"
}
```

Proposed:
```json
{
  "Rng": "E",
  "Tgt": "Ground",
  "RoA": "2",
  "Hit": "5+",
  "Dmg": "1",
  "Surge": "-",
  "S.Die": "-",
  "Keyword": "-",
  "Notes": "FOR Strike"
}
```

Original source rule/choice target: `pdf_Terran_equipment_marines_upgrade_4_choice`.

### 19. Zerg — Raptors (Zergling): SHREDDING CLAWS

Affected: Combat Weapon. Display: replacement weapon; changed fields blue.

Current:
```json
{
  "Rng": "E",
  "Tgt": "Ground",
  "RoA": "2",
  "Hit": "4+",
  "Surge": "Light, Armoured",
  "S.Die": "D3",
  "Dmg": "1",
  "Keyword": "-",
  "Notes": "\u2191 FOR CLAWS"
}
```

Proposed:
```json
{
  "Rng": "E",
  "Tgt": "Ground",
  "RoA": "2",
  "Hit": "4+",
  "Dmg": "1",
  "Surge": "Light, Armoured",
  "S.Die": "D3",
  "Keyword": "-",
  "Notes": "FOR Claws"
}
```

Original source rule/choice target: `pdf_Zerg_equipment_raptors_zergling_upgrade_1_choice`.

### 20. Zerg — Raptors (Zergling): Adrenal Glands

Affected: Ability. Display: permanent; blue: CLAWS.

Current:
```json
{
  "Phase": "Combat Phase",
  "Type": "Passive",
  "Effect": "This Unit's Claws and Shredding Claws weapons gain PRECISION (2)."
}
```

Proposed:
```json
{
  "Phase": "Combat Phase",
  "Type": "Passive",
  "Effect": "This Unit\u2019s Claws and Shredding Claws weapons gain PRECISION (2)."
}
```

Original source rule/choice target: `pdf_Zerg_rule_raptors_zergling_upgrade_combat_phase_adrenal_glands`.

### 21. Zerg — Zerglings: SHREDDING CLAWS

Affected: Combat Weapon. Display: replacement weapon; changed fields blue.

Current:
```json
{
  "Rng": "E",
  "Tgt": "Ground",
  "RoA": "2",
  "Hit": "4+",
  "Surge": "Light, Armoured",
  "S.Die": "D3",
  "Dmg": "1",
  "Keyword": "-",
  "Notes": "\u2191 FOR CLAWS"
}
```

Proposed:
```json
{
  "Rng": "E",
  "Tgt": "Ground",
  "RoA": "2",
  "Hit": "4+",
  "Dmg": "1",
  "Surge": "Light, Armoured",
  "S.Die": "D3",
  "Keyword": "-",
  "Notes": "FOR Claws"
}
```

Original source rule/choice target: `pdf_Zerg_equipment_zerglings_upgrade_1_choice`.

### 22. Zerg — Zerglings: Adrenal Glands

Affected: Ability. Display: permanent; blue: CLAWS.

Current:
```json
{
  "Phase": "Combat Phase",
  "Type": "Passive",
  "Effect": "This Unit's Claws and Shredding Claws weapons gain PRECISION (2)."
}
```

Proposed:
```json
{
  "Phase": "Combat Phase",
  "Type": "Passive",
  "Effect": "This Unit\u2019s Claws and Shredding Claws weapons gain PRECISION (2)."
}
```

Original source rule/choice target: `pdf_Zerg_rule_zerglings_upgrade_combat_phase_adrenal_glands`.

## Conditional changes (green)

### 1. Protoss — Adepts: Resonating Glaives

Affected: Ability. Display: conditional RoA; green: GLAIVE CANNON.

Current:
```json
null
```

Proposed:
```json
{
  "Phase": "Assault Phase",
  "Type": "Active",
  "Cost": "1 PE",
  "Effect": "This Unit's Glaive Cannon gains BUFF RoA (1)."
}
```

Original source rule/choice target: `pdf_Protoss_rule_adepts_upgrade_assault_phase_resonating_glaives`.

### 2. Protoss — Immortal: Fury Unyielding

Affected: Ability. Display: conditional; green: LEFT PHOTON DISRUPTOR; conditional; green: RIGHT PHOTON DISRUPTOR.

Current:
```json
{
  "Phase": "Assault Phase",
  "Type": "Passive",
  "Upgrade": "FOR RIGHT PHOTON DISRUPTOR",
  "Effect": "While this Unit is Within 3\" of a Mission Marker, its Ranged Weapons gain CRITICAL HIT (1) when targeting an Enemy Unit that is also Within 3\" of that same Mission Marker."
}
```

Proposed:
```json
{
  "Phase": "Assault Phase",
  "Type": "Passive",
  "Effect": "While this Unit is Within 3\" of a Mission Marker, its Ranged Weapons gain CRITICAL HIT (1) when targeting an Enemy Unit that is also Within 3\" of that same Mission Marker."
}
```

Original source rule/choice target: `pdf_Protoss_rule_immortal_upgrade_assault_phase_fury_unyielding`.

### 3. Terran — Marines: Grenades - Frag

Affected: Ability. Display: conditional surge; green: C-14 RIFLE.

Current:
```json
{
  "Phase": "Assault Phase",
  "Type": "Passive",
  "Effect": "When this Unit makes a Ranged Attack with a C-14 Rifle and the target is Within 8\", that weapon's S Dice is replaced by D6."
}
```

Proposed:
```json
{
  "Phase": "Assault Phase",
  "Type": "Passive",
  "Effect": "When this Unit makes a Ranged Attack with a C-14 Rifle and the target is Within 8\", that weapon\u2019s S Dice is replaced by D6."
}
```

Original source rule/choice target: `pdf_Terran_rule_marines_upgrade_assault_phase_grenades_frag`.

## Unchanged and rule-only effects

21 other changed/new options retain only their clickable source rule. Baseline unit rules and weapon values follow the DB; no general rules are imported.

## Source and display conflicts

[]

## Composition check

118 option pairs checked in both orders: 116 are order-independent. The only collisions are Haywire Missiles versus Scatter Missiles on Goliath and Infested Goliath; these replace the same default weapon and are alternative choices. Existing regression tests also cover passive HP and conditional effects. Full results: wave4-composition-report.json.

## Application and remaining client checks

The user authorized continuation after the separate blue/green review. Both lists were applied for the fingerprint above. Preserving the established Resonating Glaves identity reduces the final audit to 22 blue and 2 green differences; the existing approved conditional display remains intact. Version 163 contains 59 DB units and 59 tactical cards. General rulebook and glossary are unchanged. New tactical cards without existing card art use their DB text. Reaver includes all three Scarab reserve variants as native off-roster ExtraItems; deploy only the variant allowed by selected upgrades. Fire Wall is a 32 mm reminder token, not a physical wall template. Native client rendering and template placement remain manual verification steps.
