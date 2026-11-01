# Weapon table layout

Warhall's current WDSStatline renderer uses fixed-height rows and fixed-width columns. Newlines inside Name or Attributes do not increase the row height. UIConfig offers no statline row-height setting.

Release 27 renders each wrapped line as a separate Statline record with identical columns. Only the first record contains range, target, rate of attack, hit and damage. Following records contain the remaining weapon name, surge dice and keywords; unused cells are empty. Consecutive rows share a single native table header. KW is the short keyword heading. No rule popup or duplicate equipment child is introduced.

Comparison sources: the ToW-WDS TOW/equipment.json uses ordinary multiline equipment descriptions; the test catalogue's [40k Astra Militarum equipment](https://github.com/RodriCas85/test/blob/main/40k/Astra%20Militarum/equipment.json) references weapon statlines and separate rule records. Neither supplies an adjustable multiline statline row height. The continuation rows retain Starcraft's requested table presentation without relying on unsupported layout fields.

Source gameplay profiles remain unchanged. Tests require single-line cells, complete wrapped content and empty repeated-statistic cells. A fresh Warhall client profile check is still necessary to confirm the live layout.
