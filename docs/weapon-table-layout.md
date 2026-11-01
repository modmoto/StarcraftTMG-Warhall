# Weapon table layout

Release 31 shows the unit's name once, followed by categories, unit statistics and clickable abilities. Release 32 restores Models / Supply directly below Categories in the unit description; Supply remains omitted from the displayed statline. Native statline name headers are disabled, and the unit statline has an empty name. Profile names remain available to the creation menu.

Each weapon uses a full-width heading, a left-aligned six-column text table, and a horizontal line of clickable keywords. Headings are RNG, Target, RoA, Hit, Surge and D. Target values are Ground, Air and All. Surge values use one line, for example Armored (D3), Light (D3+1), or L&A (D3+1). There are no continuation rows or empty weapon-name columns.

Warhall's native WDSStatline prefab gives every attribute the same fixed width and reserves a title column. Weapon tables therefore use ordinary auto-height text records with the client's TextMeshPro position and no-break tags. Column positions are percentages of the full text width: 0, 14, 32, 46, 59 and 94. This gives Surge more space while preserving alignment between headings and values. See [Unity's horizontal-position documentation](https://docs.unity.cn/Packages/com.unity.textmeshpro@4.0/manual/RichTextPos.html). The native unit statline remains intact for HP tracking.

Phase sections contain only weapons. Empty phases, including Any Phase, are omitted. Abilities precede weapon sections; Devastating Charge labels include the unit-specific IMPACT parameter and hit roll. Popup descriptions retain complete gameplay wording. Weapon source values are validated before formatting, and glossary links preserve complete keyword parameters.

Tests cover profile order, absence of duplicate statline names and table Supply, full Target labels, single-line surge values, complete clickable keywords, valid weapon values, and unit-specific charge summaries. A fresh Warhall profile check is still necessary to verify live rendering.
