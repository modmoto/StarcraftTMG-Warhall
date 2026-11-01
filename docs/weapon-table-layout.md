# Weapon table layout

Release 28 shows the unit statline first, followed by its clickable abilities and effects. Devastating Charge labels include the unit's printed IMPACT parameter and hit roll, for example `Devastating Charge IMPACT (4) 3+`. The popup keeps the complete gameplay text. These summaries are derived from each imported rule, not a shared hard-coded value.

Phase sections below the abilities contain only weapons. Empty phases are omitted, including Any Phase. Each weapon has a full-width bold name above its six-column RNG/T/RoA/Hit/Surge/D stat table. Complete keywords appear left to right in a full-width text row immediately below the weapon. Each keyword, including its parameters, links to the matching glossary rule and is underlined. Ordinary full-width text can wrap to the panel width without splitting words into a narrow keyword column. Weapons without keywords omit that row.

Warhall's WDSStatline renderer has fixed-height rows and fixed-width columns. Embedded newlines cannot increase the row height, and UIConfig offers no statline row-height setting. Surge dice therefore occupy a separate continuation row with empty repeated statistics. Armoured is abbreviated Arm. to fit the native column; Light and L&A retain their existing forms. Full weapon names and keywords are outside these constrained cells.

Comparison sources: ToW-WDS TOW/equipment.json uses ordinary multiline equipment descriptions; the test catalogue's [40k Astra Militarum equipment](https://github.com/RodriCas85/test/blob/main/40k/Astra%20Militarum/equipment.json) references weapon statlines and separate rule records. Neither supplies an adjustable multiline statline row height.

Tests cover profile order, absence of empty phase headings, complete clickable keyword labels and parameters, separate surge rows, and unit-specific charge summaries. A fresh Warhall profile check remains necessary to verify live rendering.
