---
name: warhall-profile-layout
description: Review and improve Warhall StarCraft unit profile layout, including weapon tables, keyword wrapping, spacing and clickable links.
---

# Warhall profile layout

Keep the weapon name, table and linked keywords visually together. Place keywords directly below their table. Wrap between complete keyword entries and use commas only between entries. Preserve separation before the next phase.

Inspect src/warhall/presentation.mjs and the generated profile rows. Warhall can add separators when grouping adjacent Imported text blocks. Review the maintained weapon layout tests and test both Immortal weapons in Warhall Test for spacing, wrapping, stray commas and links. Report local checks and in-client observations separately. Use warhall-unit-rules for decisions about colors, replacements and conditional values.

Specialist weapons use native ModifyItemOnSingle (Type 4), changing an existing soldier within the unit. Keep their full weapon details in the clickable selected-upgrade description; omit duplicate inline tables and the former collapsible Specialists group. Ordinary Goliath and Immortal replacements remain inline. Add the existing rule_keyword_specialist directly to that soldier so the custom rank badge matches only specialist models. Follow docs/specialists.md and warhall-model-extraction for option-specific TTS skins. Never use ExtraItems or AddSingle for these soldiers.

Only emit Shd in statlines whose base shield characteristic is positive. This is based on the unit definition, not its remaining shields during play.
