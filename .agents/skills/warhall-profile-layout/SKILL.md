---
name: warhall-profile-layout
description: Review and improve Warhall StarCraft unit profile layout, including weapon tables, keyword wrapping, spacing and clickable links.
---

# Warhall profile layout

Keep the weapon name, table and linked keywords visually together. Place keywords directly below their table. Wrap between complete keyword entries and use commas only between entries. Preserve separation before the next phase.

Inspect src/warhall/presentation.mjs and the generated profile rows. Warhall can add separators when grouping adjacent Imported text blocks. Review the maintained weapon layout tests and test both Immortal weapons in Warhall Test for spacing, wrapping, stray commas and links. Report local checks and in-client observations separately. Use warhall-unit-rules for decisions about colors, replacements and conditional values.

Keep internal specialist weapon grouping IDs short and deterministic. The client wraps Profile IDs in TMP link tags even when their displayed name is empty; long source-derived IDs can exceed TMP's rich-text tag buffer and expose raw link markup. Use the hashed container IDs from upgrades.mjs, while preserving canonical weapon/rule IDs and real keyword links. Validate effective specialist table/keyword blocks and the generated container-tag length.

Only weapons explicitly marked SPECIALIST belong in one native collapsible Specialists group per unit. Use a named Equipment container (not Profile, which the client renders inline), added only by selected specialist options. Keep each weapon's table and keywords together inside it. Ordinary weapon profiles and replacements, including Goliath and Immortal weapons, remain inline. Preserve short deterministic container IDs and do not create an empty Specialists menu on units without a selected specialist.
