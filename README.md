# StarCraft TMG data for Warhall

Convert either the official printable unit cards (the **default**) or a local [StarcraftTMG-NR](https://github.com/modmoto/StarcraftTMG-NR) checkout into Warhall JSON, following the structure demonstrated by [ToW-WDS](https://github.com/christophcarstensen/ToW-WDS).

Requires **Node.js 22.13 or newer** (Node 24 recommended), with npm. The PDF path does not require Python, OCR, or a New Recruit checkout.

Repository text and generated JSON use UTF-8 with LF line endings on Windows, macOS and Linux. `.gitattributes` preserves LF during Git checkout, and `.editorconfig` and Prettier use the same convention.

## Generate from official PDFs (default)

From this repository:

```sh
npm ci
npm run convert
npm run validate
```

`npm run convert` discovers the English printable faction card sheets on the [official downloads page](https://archon-studio.com/downloads/starcraft-tabletop-miniatures-game), downloads every advertised wave, parses the cards and writes `Starcraft/`. At the inspected release this is nine PDFs, 77 pages and **45 unit profiles**, including Nova's two modes and summoned units. Tactical, mission and deployment pages are classified separately in the report and are not emitted as miniatures.

To explicitly select the PDF source, validate without changing the generated package, or use a staging directory:

```sh
npm run convert -- --source pdf --dry-run
npm run convert -- --source pdf --output /path/to/staging
```

Online runs re-download the official card set to pick up changed content. PDFs and a checksum manifest are cached in `.cache/pdf/` (ignored by Git). Dry runs may download/update that source cache but do not write the Warhall output.

To regenerate from exactly the last downloaded source set, without network access:

```sh
npm run convert -- --offline
```

To use official PDFs already downloaded to a folder:

```sh
npm run convert -- --pdf-dir /path/to/cards
```

Local filenames must retain the official English naming pattern, for example `StarCraft-Terran-P2P-Card-Sheets-A4_EN.pdf` and `StarCraft-Terran-P2P-W3-Card-Sheets-A4_EN.pdf`. Supply sheets for all three factions. `--cache-dir PATH` changes the download cache location. A download, checksum or parsing failure stops the conversion; it never silently switches to New Recruit.

## Generate from New Recruit instead

Clone the source repository beside this repository (or point to an existing checkout):

```sh
git clone https://github.com/modmoto/StarcraftTMG-NR.git ../StarcraftTMG-NR
npm run convert -- --source new-recruit
npm run convert -- --source new-recruit --nr-dir /path/to/StarcraftTMG-NR --output /path/to/staging
```

This reads local `.cat` and `.gst` files. It does not update the checkout automatically. The inspected checkout yields **31 units** and warns that the catalogues request game-system revision 13 while its `.gst` reports revision 12. Its content predates the newer official PDFs.

## Parsing and validation

The PDF parser reads text coordinates through PDF.js. It normalizes rotated card faces, removes duplicate text outlines, reconstructs split movement values, and reads weapon columns using their printed headings. Wrapped weapon names, surge types and keywords are retained. Default card weapons and phase-specific ability text are kept separate from the optional upgrade face. Phase blocks are split into named abilities with separate phase, activation and cost fields. Abilities remain descriptive rather than executable rules.

Missing or conflicting required stats, unreadable weapon tables, unknown unit layouts and duplicate unit cards fail before generated files are written. The parser supports the current A4 print-and-play template; it does not claim to understand arbitrary future layouts or scanned image-only cards. Source PDF filenames, URLs, SHA-256 hashes, page classifications and per-unit page/text provenance are recorded in `Starcraft/import-report.json`.

`npm run validate` checks file coverage, unique IDs, description-link targets, profile hierarchy, unit HP, weapon-table columns/values and positive round/oval dimensions. `npm test` exercises both source adapters, rotated/duplicated card text, wrapped weapons, invalid data and cache integrity. Tests run without network access; the three real New Recruit integration tests are skipped if that optional sibling checkout is absent. Other New Recruit tests use small synthetic fixtures. The PDF tests use text-position snapshots from seven actual official card pages; full binary PDF parsing was also exercised against all nine downloaded documents.

## Unit panel and named rules

Unit stats stay at the top of the panel. Below them, populated sections appear in this order: Any Phase, Movement Phase, Assault Phase and Melee Phase. Melee is the display name for the official Combat Phase. Each section shows native weapon-stat rows first, followed by the relevant clickable ability names.

Weapon rows are WDS `Statline` records with their own ordered columns: Range, Target, RoA, Hit, Surge Type, Surge Dice, Damage and Keywords. They contain no HP field and do not contribute wounds. The row's expand control links to the detailed weapon item and its nested keywords. Plain phase headings use WDS text records; no Markdown table or client binary patch is needed. Empty phases are omitted. Generic rule-group labels are disabled while table names remain visible.

Each ability has a separate record, so Stimpack's unit-specific Precision value is preserved. Popup descriptions show the phase, Active/Passive/Reaction type and resource cost on separate lines. Official keyword definitions live in global `rules.json`, with validated TextMeshPro links such as Stimpack → Precision. Explicit references to other abilities also link to their records. Upgrade abilities are available as reference targets but are not attached as default abilities. Upgrades are not automatically equipped.

Unit descriptions contain no source URLs, base sizes, implementation notes or manual-upgrade placeholders. Source pages, checksums, raw card text and upgrade details remain in `import-report.json`. Base geometry and unit HP are unchanged. Existing unit, profile, unit-statline and equipment IDs are retained; named abilities and presentation rows have new IDs.

The committed `rule-keywords.json` snapshot is extracted from the current official core-rulebook glossary. Card text is refreshed by normal PDF imports; refresh and review the glossary separately when the core rulebook changes:

```sh
npm run rules:update-keywords
npm run rules:compare -- /path/to/StarcraftTMG-NR
npm run convert -- --offline
npm run check:local
```

The comparison command reads cached official cards and a local New Recruit checkout without changing either. `rules-reference-report.json` records catalogue IDs, nested keyword references, costs/phases and wording differences. PDF wording wins; catalogue definitions are never substituted into the PDF import. The snapshot includes official source URLs and SHA-256 hashes. Parsing arbitrary future glossary layouts, reconciling FAQ/errata and applying upgrades automatically remain outside this cleanup.

Test data release 11 includes these changes. The native table/heading behavior was checked against the installed Warhall Test renderer; live visual checks and popup-click testing remain pending. See [rule cleanup notes](docs/unit-rules.md).

## Output and base sizes

`manifest.json` lists package files. `hierarchy.json` organizes factions and categories. Faction `units.json` records point to profiles, which reference bases, statlines, equipment and rules. HP is the configured wound attribute; shields stay separate. The original Marine unit/profile/stat IDs are preserved in both modes. Other records have source-specific IDs, so switching source can change IDs and should be tested before reusing saved games.

**PDF mode reads base dimensions and shape directly from each card.** It does not read `base-sizes.json`. A printed round diameter becomes a circular base; printed unequal axes become an oval. Hydralisks therefore use the printed 40 x 100 mm oval. Missing/unreadable footprints stop conversion instead of falling back to the map.

**Flight stands are the one explicit convention:** when a PDF says FLIGHT STAND without dimensions, use a provisional 100 mm round base, as requested by the user. This is not claimed as an official diameter.

**New Recruit mode uses base-sizes.json**, since the catalogues do not provide physical base dimensions. Unit overrides win over the defaults (32 mm, or 40 mm for Hero-category units). A number sets a round diameter; an object sets an oval, for example:

```json
{ "shape": "oval", "widthMm": 40, "lengthMm": 100 }
```

Warhall curved bases use `Shape: 1`; the axes are equal for circles and unequal for ovals. The import report records the applied footprint and its source. PDF reports include a base-size policy and per-card footprint provenance; New Recruit reports include the mapping used.

The converter preserves existing game configuration, tokens, terrain, objectives, deployments and version settings, except for setting WoundsAttribute to HP. Generated faction data, bases, hierarchy, global placeholder lists and manifest are replaced. Release version numbers remain maintainer-controlled.

For a release, increment `Starcraft/manifest.json`'s `version`. Conversion copies that number to `version.json`, which points Warhall to the published manifest for updates.

Run `npm run check:local` for a read-only offline check after conversion. It rebuilds from the cached official PDFs in memory, compares every generated file byte for byte (including LF endings), checks release metadata and references, runs tests, and checks formatting. A fresh checkout needs `npm ci` and one online `npm run convert` to populate the ignored PDF cache first. This verifies the data package; loading units and rendering models in Warhall is a separate client check.

## Deployment migration and updates

```sh
npm run deployments:update                 # Download current official rulebook and all faction waves
npm run deployments:update -- --dry-run    # Parse/validate without changing generated output
npm run deployments:update -- --offline    # Reuse checksum-verified downloads
npm run deployments:check                  # Read-only offline byte-for-byte check
```

This updates the 7 standard 54x36 layouts in `Starcraft/deployments.json`, existing Warhall red, blue and green markers in `Starcraft/terrains.json`, and their placement in `Starcraft/gameconfig.json`. Unrelated manually maintained entries are preserved. Run this after updating the unit cards; the unit converter preserves these files. It does not automatically change the release version. A fresh checkout needs `npm ci`, `npm run convert`, and `npm run deployments:update` before the offline checks.

The script reads PDF text, vector marker symbols, table boundaries and influence-zone artwork, handles upside-down cards, and reconciles repeated copies across factions. Current card artwork is approximate: coordinates are resolved on the printed 3-inch measurement grid and checked against printed edge measurements. All current coordinates have regression coverage. An unsupported grid, changed rule measurements/affinities, missing symbols or conflicting copies stops the migration before output is written. Review new or changed cards using `docs/deployments.html` and its source-page links; `deployment-report.json` retains source hashes and page numbers. A changed PDF design can require parser maintenance.

The rules use red markers for 1/3, blue for 2/4 and green neutral for 5. The game uses existing Warhall ExcaliburRed/Blue/Green assets as terrain, keeping their native sizes. No custom PNGs, meshes or range rings are created. Marker coordinates come from the official cards; activation and control remain manual. Selecting a deployment places its markers and grey entry-edge segments together. The objective dropdown is reserved for scoring missions. Markers follow the Battlefield > Lock terrain switch. The current Warhall Test client explicitly unlocks terrain when a deployment creates it and exposes no WDS option to relock it automatically; automatic locking requires the client to call `SetTerrainLock(true)` after `PanelBattlefield.TerrainInDeployments`.

Deployment outlines use the separate Warhall DeploymentDB. Close the test client, then install them with backups:

```sh
node scripts/install-warhall-deployment-cache.mjs /path/to/WarhallTest --apply
node scripts/install-warhall-marker-cache.mjs /path/to/WarhallTest/Database --apply
node scripts/install-warhall-data.mjs /path/to/WarhallTest --apply --local-source
```

The local-source option points the test client's Starcraft game-version entry to the workspace manifest, so opening a room does not overwrite local edits with the published release. It backs up GetGameVersions and the WDS files in the printed directory. Restore those backup files to return to the published source. Shared deployment template refreshes can overwrite locally installed outlines; the template adapter can be reapplied. The marker adapter associates the three existing native skins with Starcraft terrain IDs in the local catalogue; it creates no skins or assets and backs up both changed cache files. Shared catalogue registration is required for other machines.

## Current scope

### Hosted model pose selections

The installed Warhall Test client reads model URLs from its separate skin catalogue, not from WDS profiles or the game manifest. For a local CDN rendering test without creating skins in the UI, close Warhall Test and run:

```sh
node scripts/install-warhall-model-cache.mjs /path/to/WarhallTest/Database --dry-run
node scripts/install-warhall-model-cache.mjs /path/to/WarhallTest/Database --apply
```

The adapter backs up five catalogue cache files under `.cache/warhall-model-backup-TIMESTAMP/` before installing 41 complete model mappings. Restart Warhall Test afterwards. Meshes and textures are fetched from their TTS CDN URLs by Warhall itself; the mappings do not use local preview assets. This is a machine-local test adapter, not a shared catalogue deployment. A Warhall catalogue refresh can replace the mappings. To undo the local test, close Warhall Test and copy the five files from the printed backup directory back to the same `Database` directory. The shared catalogue requires a Warhall-side import; adding these links to the WDS manifest alone has no effect on skin loading in this client build.

`model-selections.json` records visually reviewed Steam CDN mesh/texture pairs for all 45 generated units. Prefer aiming/firing/casting poses for ranged units and charging/striking poses for melee units. Where those poses are unavailable, the entry describes the closest available stance. It is a source mapping, not an asserted Warhall model schema, and the converter does not yet attach these references to profiles.

All 45 units now have selected CDN references. Complete TTS prefabs cover Adepts, Jim Raynor, Nova Assault, Vile and the emerged Omega Worm; Zeratul includes his separate psi blade. Zerglings use the actual leaping zergling, and the tank uses its deployed siege pose. `model-adjustments.json` records the measured size, rotation and centering overrides separately from the original TTS transforms. These adjustments still require visual verification in Warhall Test.

`scripts/prepare-warhall-textures.py` can prepare compatible PNG textures in the local Warhall Test texture cache, including blue Terran, purple Zerg and gold Protoss accents. It requires Pillow, numpy and the downloaded preview inventory. Pass the client's `TextureCache` directory to preview, and add `--apply` to back up and write the textures while the client is closed. This fixes unsupported WebP source textures locally; shared deployment still requires compatible hosted textures and Warhall catalogue registration. A WDS manifest version bump alone does not install these model mappings.

To repeat the review from a local TTS Workshop cache containing the main table and faction saves:

```sh
node scripts/extract-tts-models.mjs /path/to/Workshop/Starcraft
node scripts/download-tts-previews.mjs
python -m venv .cache/model-preview-env
# Windows; install numpy and pillow in this optional preview environment:
.cache/model-preview-env/Scripts/python.exe -m pip install numpy pillow
.cache/model-preview-env/Scripts/python.exe scripts/render-tts-previews.py
node scripts/select-tts-models.mjs
.cache/model-preview-env/Scripts/python.exe scripts/render-tts-previews.py --selected
```

The software renderer uses two views and approximate diffuse texture colors to review geometry and poses. The downloaded assets and preview sheets stay in ignored `.cache/tts-preview/`; game data contains no local model dependencies. Selection candidate IDs are local review identifiers; the exported mapping stores the full mesh and texture URLs. Preserve the preview inventory when repeating selections, as it maintains those IDs.

- Manual army placement, with no 3D models or roster import.
- Default stats, weapons and abilities. Upgrade descriptions and weapon replacement notes are retained, but changes are applied manually. New Recruit conditional modifiers/legality are not evaluated.
- Shields are displayed separately; their loss and restoration are manual.
- The PDF option reads unit cards, not the separate cost tables, FAQ/errata or keyword glossary. It does not reconcile conflicting documents or automate combat. PDF costs are not filled from New Recruit or invented.
- All variants, modes and summoned units are selectable; eligibility and alternate-mode switching are manual.
- The JSON package has local integrity tests. Loading and rendering in the Warhall client remain unverified.

## Code layout

The command-line scripts are thin entry points. Both source readers return the same plain unit model; the Warhall builder handles the output. The PDF path does not create intermediate New Recruit/XML objects.

```text
scripts/
  convert.mjs                 Convert command
  validate.mjs                Validation command
src/
  cli.mjs                     Arguments and command orchestration
  convert.mjs                 Source selection and package building
  io.mjs                      JSON files and checksums
  paths.mjs                   Default directories
  sources/
    new-recruit.mjs           XML loading, references and normalization
    pdf/
      index.mjs               PDF document loading
      downloads.mjs           Discovery, downloads and cache
      layout.mjs              Text positions and duplicate outlines
      card-parser.mjs         Unit stats, abilities and printed bases
      weapons.mjs             Weapon tables and wrapped rows
      names.mjs               Text normalization and unit names
      adapter.mjs             Cards into the shared unit model
  warhall/
    package.mjs               Warhall records and file output
    bases.mjs                 PDF footprints and New Recruit mapping
    descriptions.mjs          Display text
    report.mjs                Source provenance and limitations
    validate.mjs              Package integrity checks
```

Formatting uses Prettier with two-space indentation, single quotes and a 100-column target. Generated game data and raw PDF fixtures are excluded from formatting.

```sh
npm run format
npm run format:check
npm test
```

## Standard terrain maps

`npm run terrain:update` downloads the TTS terrain meshes and textures for inspection, computes Warhall footprints and regenerates `Starcraft/maps.json`, terrain records and CDN model mappings. `--offline` reuses the local cache; `npm run terrain:check` verifies the generated files without changing them. Model binaries stay out of Git.

The five presets are official PDF maps 1-5 (rulebook PDF pages 118-122), using the corresponding saved TTS memory-bag placements: 30 pieces on maps 1-4 and 32 on map 5, including the high-ground ramps. Refresh `terrain-sources.json` from the Workshop save with `node scripts/extract-tts-terrain.mjs /path/to/3662791369.json`. Source URLs, hashes, scale limitations and page references are retained in `terrain-report.json`.

Select the map first under Create > Battlefield, then select the deployment. Warhall clears all terrain when loading a map, including deployment markers; after changing maps, select None and then the desired deployment to restore its markers. Map loading locks terrain automatically; deployment-marker creation requires the manual Lock terrain switch in this client. The local model-cache adapter also installs `terrain-models.json`; shared use requires Warhall catalogue registration, as with unit models. Warhall remote skins expose uniform scale, so nonuniform TTS scales prioritize the horizontal footprint; model and collider dimensions match the rendered uniform scale.

## Board cards and handoff

See [TODO.md](TODO.md) for the remaining work and macOS setup. Board cards include 49 tactical/faction/creep cards, seven standard deployments and seven scoring missions. Unit cards are intentionally excluded. Card faces are lossless PNG crops rendered at 360 dpi from the official PDF sources; descriptions omit copyright/version metadata and retain structured headings. Regenerate with `python scripts/update-cards.py` after refreshing the PDFs. Python requires Pillow and pypdf; Poppler's `pdftoppm` must be on PATH. The generator owns only its hash-named images under `Starcraft/assets/cards` and removes obsolete generated faces.

Use `--local-source --local-assets` with the test-data installer to preview unpublished card images. This uses a local snapshot, so reapply after changing generated data. The L-shaped Wall Sets 4/5 use compensated skin/base rotations; all other footprint orientations remain unchanged.

### Shared model URLs

[`model-catalogue.json`](model-catalogue.json) defines models, textures, transforms and unit/terrain assignments for shared publication. Run `npm run models:publish` for a dry run. See [the publication guide](docs/model-publication.md) for authentication, resumable publication and current cross-platform limits. Local cache installers do not publish these mappings for other players.
