# Selected unit upgrades

Test data 61 includes native WDS options for the upgrade abilities and weapon profiles printed on the unit-card upgrade faces. Default units keep their original rules, attributes and weapons.

The option IDs deliberately equal their readable names, such as `Kinetic Foam` and `C-14 Rifle`. Warhall's generic WdsUnitParser builds its FullOptions dictionary using IDs, so opaque generated IDs fail to match exported option names. A single root option definition is shared when names match; modifiedunit/modifiedprofile records scope the effect to the actual unit and profile. No parser or client-cache patch is installed.

## Display and effects

- Selected upgrade names appear table-header blue (#2596be) below default rules and before weapon phases. Weapon names/stat values keep their existing colours.
- Kinetic Foam replaces the Marauder's top stat row with HP 6. Its default row remains HP 5 when unselected. This updates the profile's real HP, including the native wound calculation; it is not a second +1 stat row.
- Jim Raynor's C-14 Rifle replaces Commando Rifle while retaining the revolver and bayonet.
- Goliath's Scatter Missiles or Haywire Missiles replace Hellfire Missiles in its Assault phase. Applying another alternative removes the previous weapon presentation.
- Immortal's Left/Right Phase Disruptors replace only the corresponding Photon Disruptor. Fury Unyielding adds its passive ability and preserves both weapons.
- Conditional effects, resource spending and active/reaction timing remain manual. Veteran of Tarsonis does not permanently change Armour simply because it was selected.

Empty layout containers keep the stat row, selected rules and individual weapon slots in stable positions. Native WDSRef.Ref additions/removals target those containers. Shared skin profile IDs stay unchanged, so model uploads are unnecessary.

Printed replacement notes are authoritative. Where the PDF omits a repeated note, a unique same-phase weapon, explicit left/right side, or unique weapon-name suffix resolves the slot. Ambiguous replacements fail during generation. The New Recruit catalogue's named choices were compared for Raynor, Goliath and Immortal.

`applyProfileOptions` provides a read-only preview using the inspected native reference operations. Regression checks cover combinations/order, real HP values, retained weapons, table-header blue (#2596be) selected names and shared Marine/Raider Stimpack. Marines and Raynor's Raiders use Stimpack (Marines); Marauders use Stimpack (Marauders).

After refreshing the game data, re-import the list or create fresh units to resolve the new WDS options. Previously spawned fallback rule references are not retroactively converted into option selections. Live client import/layout testing is still needed; passing adapter checks is not proof of a played-room test.

Presentation groups use the native Profile type to render inline, without collapsible summaries. Weapon table headers remain plain text; rule descriptions retain keyword links.

Each weapon is rendered as one text block: its phase heading (for the first weapon), name, table and linked keywords use single line breaks. Separate phases retain native block spacing. Blue weapon choices state which original weapon is replaced and repeat the selected profile and keywords in the rule popup.
