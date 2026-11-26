---
name: warhall-profile-layout
description: Review and improve Warhall StarCraft unit profile layout, including weapon tables, keyword wrapping, spacing and clickable links.
---

# Warhall profile layout

Keep the weapon name, table and linked keywords visually together. Place keywords directly below their table. Wrap between complete keyword entries and use commas only between entries. Preserve separation before the next phase.

Inspect src/warhall/presentation.mjs and the generated profile rows. Warhall can add separators when grouping adjacent Imported text blocks. Review the maintained weapon layout tests and test both Immortal weapons in Warhall Test for spacing, wrapping, stray commas and links. Report local checks and in-client observations separately. Use warhall-unit-rules for decisions about colors, replacements and conditional values.

Specialist weapons use native ModifyItemOnSingle (Type 4), changing an existing soldier within the unit. Keep their full weapon details in the clickable selected-upgrade description; omit duplicate inline tables and the former collapsible Specialists group. Ordinary Goliath and Immortal replacements remain inline. Add the existing rule_keyword_specialist directly to that soldier so the custom rank badge matches only specialist models. Follow docs/specialists.md and warhall-model-extraction for option-specific TTS skins. Never use ExtraItems or AddSingle for these soldiers.

Only emit Shd in statlines whose base shield characteristic is positive. This is based on the unit definition, not its remaining shields during play.

Every SPECIALIST option, in every faction and wave, must have a blue (#2596be), underlined, clickable native Unit options label pointing to its weapon-description popup. This includes both Infested Missile Launcher variants as well as Marine weapons. Apply this generically from the SPECIALIST keyword in src/warhall/upgrades.mjs, never through a Marine-only name list. Keep the WDS option Id plain and stable for imports and skin bindings. Use a short popup ID to respect TMP link limits. src/warhall/validate.mjs rejects specialist option labels that do not satisfy this contract. Existing loaded units may retain their previously instantiated option objects; compare newly imported units after refreshing the dataset when checking a label change.

In the native unit-creation menu, group upgrade choices by native option type and sort alphabetically by visible name only within each type. Ordinary upgrades precede specialist Type-4 choices, which always form the bottom group. Preserve plain option IDs; strip rich-text tags only for name comparison. Maintain this in the generated modifiedunit/modifiedprofile link order, which the existing client reads in sequence, rather than changing client code or renaming options to force sorting. Verify Infested Marine and Marine choices and keep this rule for future waves.

For every race, emit native unit categories in this exact hierarchy order: Core, Elite, Support, Hero, Other. src/warhall/package.mjs reconstructs each faction's category object using unitCategories, rather than relying on the order in which units were encountered. Omit empty categories, preserve all existing category memberships, and keep the same ordering for future waves.

Whole-unit views must omit specialist weapon tables, but the specialist's own single-model profile must show its actual weapon table and linked keywords. Use Type-4 modifiedprofile references: explicit FOR notes replace the original weapon groups on that soldier; SIDEARM adds a separate weapon while retaining the rifle. Preserve unit-wide upgrade inheritance and do not create a collapsible Specialists menu. Unit-wide GetNewDefault ignores Type-4 modifiers, keeping the ordinary unit profile unchanged.

Requested profile order: ordinary selected upgrades, specialist links, then Assault Phase, without a Unit options heading. The current client hardcodes Type-4 option names at the bottom under that heading; WDS cannot remove or reposition this block. Also, LeadingModelMovement.UseIndividualModelInput causes InputManager.DoubleClick to return early, so the T9A double-click single-model info gesture is unavailable in that movement mode. These are client limitations, not data fixes; do not patch the client or change specialist types to work around them. Single-model weapon data must still be correct for native profile selection when available.

Omit Minerals: and Reinforced: lines from every unit Description. Keep Categories and Models / Supply. Implement in describeUnit, retaining source costs for other uses.
