# Board card artwork and text

Run `npm run cards:update`, then `npm run convert -- --offline` and `npm run check:local`. The renderer needs Python with Pillow/pypdf and Poppler; `WARHALL_PYTHON` selects the Python executable.

All 63 non-unit cards are rebuilt from official PDF vector artwork. TTS's checked deployment images were lower-resolution JPEG redraws (810×540); its scenario atlas cells were 824×1415. Official artwork was retained for sharper text and current printed wording. Crops now use actual PDF bleed rectangles inset by exactly 3 mm, instead of assuming every page uses the same grid offset. This fixes shifted mixed-layout pages. Source pages render at 600 DPI and faces are exported as 2048-pixel lossless RGBA PNGs, with transparent rounded corners and removal of white edge strips. Readable filenames include the faction/card name, face and a short content hash; stable WDS IDs are unchanged.

Card titles include resource values, such as Khalai (PE: 1). Descriptions omit the repeated card name. Each ability has a bold heading with its phase and lowercase activation type, a new line before its effect, and a blank line before the next ability. Missing PDF activation-label text is recorded in card-text-overrides.json after checking the printed face; effects and costs are not inferred.

## White disc and transparency

The unwanted white disc was not in the artwork. `Card.ApplyColor2AndBorder` enables SecondaryColor whenever Color2 is nonempty. Both the card records and DefaultCardConfig now leave Color2 empty, hiding that overlay.

PNG faces retain transparent corners. Native rendering depends on the client material; WDS card data has no shader setting.

## DB cards without downloadable artwork

Command Center card merging preserves official front/back images. Cards without official artwork receive a generated, named placeholder on both faces through src/cards/placeholder.mjs, using the faction accent and an explicit ARTWORK PENDING label. Placeholder files are hash-named and reproducible; replace them with reviewed official artwork when available. Full rule text remains in the card description. Do not use ShowInitials as a full-name replacement.

A white native back face is not proof of a missing source image: check ImageURLBack, the hosted resource and actual image pixels first. Do not discard working official artwork or replace every back with a dummy to hide a client texture/material issue.
