---
name: warhall-profile-layout
description: Review and improve Warhall StarCraft unit profile layout, including weapon tables, keyword wrapping, spacing and clickable links.
---

# Warhall profile layout

Keep the weapon name, table and linked keywords visually together. Place keywords directly below their table. Wrap between complete keyword entries and use commas only between entries. Preserve separation before the next phase.

Inspect src/warhall/presentation.mjs and the generated profile rows. Warhall can add separators when grouping adjacent Imported text blocks. Use the weapon layout entry in TODO.md and test both Immortal weapons in Warhall Test for spacing, wrapping, stray commas and links. Report local checks and in-client observations separately. Use warhall-unit-rules for decisions about colors, replacements and conditional values.
