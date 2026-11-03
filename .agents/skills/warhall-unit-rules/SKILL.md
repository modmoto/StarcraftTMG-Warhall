---
name: warhall-unit-rules
description: Import StarCraft unit and upgrade rules from official PDFs into Warhall, audit passive and conditional profile displays, and get separate approval for blue and green changes.
---

# Warhall unit rules

Use the current official English unit card and upgrade face for names, stats, affected weapons, timing, cost, and exact conditions. Use New Recruit to cross-check option names and aliases. Preserve existing import IDs and refer to the PDF on disagreements. Keep complete source text in the clickable rule. Consolidate same-name rules with equivalent wording while preserving distinct effects, values, or timing.

## Approval before edits

Audit sources, generator logic, and generated data first. Present two independent approval lists, **Passive changes (blue)** and **Conditional changes (green)**. For each proposal give unit, exact option name, relevant source wording, affected field or keyword, current display, proposed display, and where a click goes. Identify unchanged rules and unresolved conflicts separately. Show how simultaneous upgrades compose in either selection order. Ask for explicit approval of each list and wait before applying that list. A correction updates the proposal. Silence and approval of the other list leave it pending.

Record each explicit decision in this skill under Approved precedents with date, rule or policy, and any exceptions. Use approved precedents when proposing future changes. Get fresh approval for the actual passive and conditional change lists each time. Read-only audits can proceed before approval.

## Proposed display policy

- Blue #2596be marks the selected option label and the actual permanent change it grants. A passive source label alone does not make an effect permanent. Preserve normal colors for unchanged values and keywords. A true replacement compares only to the replaced weapon. A SPECIALIST adds a separate weapon with normal stats and keywords alongside the original, and multiple selected specialists coexist.
- Green #65c879 marks only the conditional result. Show it only if the source option is selected, and keep the ordinary value visible. Display numeric alternatives in the affected cell with round parentheses, such as RoA 2 (3), Armour 4+ (3+), and Light (D3) (D6). Underline and link the green part directly to the original named upgrade. Treat a paid or reaction effect as a preview, with activation and resolution left to the player.
- Associate short conditional keyword labels with the affected weapon. Link directly to the granting upgrade with its full trigger and cost. Avoid duplicate keyword-named popup rules, repeated trigger text, and standalone summary lines when the original option link suffices.
- For an effect that changes deployment, resources, or another unit, prefer the original rule link. Propose any extra display only when it conveys actionable information in the affected profile. Preserve PDF weapon and upgrade names.
- If Warhall's whole-row replacements cannot compose, show the collision and available display choices in the approval list. Give permanent stat changes priority over conditional previews when both cannot fit or compose reliably. Keep the conditional source rule clickable and omit the redundant preview when the user has approved that fallback.

## Audit and verification

Read the source and display mapping in Starcraft-test/import-report.json. Trace src/warhall/upgrade-effects.mjs, upgrades.mjs, presentation.mjs, and rule-index.mjs to the generated profile, modifier, statline, and rule records. Treat the import report as an audit index and verify the actual records. Check baseline, each selected option, and interacting options in both orders with src/lists/apply-options.mjs and the rule and upgrade tests. Check that no green value leaks into an unselected profile, and that every link targets its original rule. Verify labels and clicks in Warhall Test when accessible. Report precisely what was checked in-game. Use the Starcraft-test package and the existing Test publication workflow after approval.

## Approved precedents

- 2026-11-03. Permanent stat changes take precedence over conditional previews when the display cannot represent both reliably. Marauders keep Kinetic Foam's blue HP 6. Veteran of Tarsonis remains clickable, with no separate Armour preview. This decision does not approve other passive or conditional changes.

- 2026-11-03. Stabilizer Medpacks uses only its clickable upgrade label. Omit the extra Life Support / Medpack summary.

- 2026-11-03. Keep the useful linked green (4+) in the Hydralisk Evade cell when Lurking is selected. Omit the separate Evade eligible summary. The original Lurking popup retains the full conditions.

- 2026-11-03. Marines and Raynor's Raiders share one Stimpack rule. Keep Marauder Stimpack separate because it affects different weapons and gives a different Precision value.
- 2026-11-03. Restoration is one searchable rule for Medics, Sentries, and Queen. The shared effect and timing are identical. The cost line maps 1 CP to Medics, 1 PE to Sentries, and 1 BM to Queen. Apply this cost-only merge to other rules only after approval.
- 2026-11-03. Keep original PDF names, including AGG-12, Slugthrower, and Grenades - Frag. Use normal stat and keyword colors for additional specialist weapons. The Marine C-14, AGG-12, and Rocket Launcher can all be shown together.

- 2026-11-03. Advanced Medic Facilities and Potent Bile use only their clickable upgrade labels. A value used only for a resource calculation or applied to another unit does not need a duplicate profile line when the source popup explains it.
- 2026-11-03. My Life For Aiur replaces the displayed Devastating Charge entry with its upgraded IMPACT dice count in blue. For a permanent change to a named ability, prefer updating that ability in place when the original can be removed cleanly. Keep the source upgrade clickable and avoid a second summary line.

- 2026-11-03. Approved the green previews for Resonating Glaves, Grenades - Frag, and Creep Speed as examples of a general rule. For a selected upgrade, identify the affected field and scope from the source, then compute the alternative from the current base profile for a relative bonus or use the source value for an explicit replacement. Keep the base value visible and put the green alternative in the affected cell, linked to the original rule. Selection enables the preview. The rule still controls when the effect applies and what it costs. Derive values and targets from source data rather than carrying the example numbers or unit names into future decisions. If the target or resulting value is ambiguous, flag it for review.

## Pending review

- **Green.** Review the remaining previews as a separate batch. Adept RoA, Marine Surge, Hydralisk Evade, and Queen Speed are approved inline alternatives. Stalker, Zealot, Immortal, and Marine conditional weapon keywords link to their original rules. Ancillary Carapace has a linked Tough (1) label. The Marauder omission and Hydralisk Evade decisions above are settled.
