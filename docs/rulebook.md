# Searchable gameplay rules

`npm run rules:update-book` downloads the current official English core rulebook and updates `rulebook.json` and `rule-keywords.json`. `-- --offline` uses the cached PDF. Then run `npm run convert -- --offline` and `npm run check:local` to rebuild the test package.

The importer includes Parts 2–8 and 10: core concepts, dice, measuring/movement, cards, supply, battlefield rules, the game sequence and advanced abilities. It checks the numbered headings against the PDF contents. The 100 numbered entries keep their section numbers, including `8.7.7 Charge`; parent entries link to their subsections. Part 11 links to the 76 existing individual keyword definitions.

Excluded: the introductory battle report, Part 9 army building/preparation, Part 12 quick reference/army lists, map layouts, repeated summary tables, illustration captions and italic advice sidebars. Figures are not reproduced. Each chapter gives its printed PDF page for checking diagrams. The attack-resolution heading also lists Hit, Surge, Armour, Evade and Damage so searching Surge finds its governing chapter.

Descriptions link named keywords and core rules, and explicit Part/Section/Chapter references link to the numbered section. Existing links are preserved without nested markup or repeated changes on regeneration. Ambiguous generic names are not guessed across different unit abilities.

Previously every unit and upgrade generated its own named ability record. Identical name/text entries now share a canonical ID, with profile children and nested references remapped. Different costs or effects remain separate and their names identify the applicable units. This avoids merging genuinely different versions just because their names match. Empty-name profile layout records are deliberately retained.

Changes build into `Starcraft-test/`; publishing to `Starcraft/` remains a separate user-requested step.
