# Warhall Test handoff

Release 10: `npm run check:local` passed (23 tests passed, 3 optional catalogue tests skipped). Windows Warhall Test loaded version 10, Official Map 5 with complete raised platform assemblies, and the regenerated Acropolis card. Full card readability/flip checks and Mac verification remain below.

Release 11 includes the unit-rule cleanup, phase weapon tables and JSON model publisher for testing. Shared catalogue publication is separate: the Marine was submitted through Model Creator; the remaining model/terrain mappings, portable Unity-bundle replacements and custom deployment templates still require publication or verification.

Release 12 removes the equipment child from each weapon stat row, eliminating the repeated weapon link and its redundant popup. Live layout verification remains pending.

## Next work

- [ ] Verify release 33 native Tokens menu: 16 separate single-face tokens, activation arrow/crosshair, blue/red lightning buffs, inverted faction palettes, status artwork and 25 mm size. Verify decorated scenario marker centres after refreshing the shared skins.
- [x] Implement local unit-rule cleanup from current official PDFs: individually named abilities, clear phases/costs, nested keyword links and the New Recruit reference comparison. Unit descriptions omit provenance, base sizes and manual-upgrade placeholders. Native weapon tables appear under phase headings. See [the implementation notes](docs/unit-rules.md). Included in test data release 11.
- [ ] Verify release 31 profile layout in Warhall Test: no duplicate statline name or table Supply, Supply below Categories, left-aligned full-width weapon tables, full Target labels, single-line Surge, horizontal clickable keywords and unit-specific Devastating Charge summaries.
- [ ] Verify the current PDF-grid terrain calibration and L-shaped Wall Set 4/5 footprints on both clients. See `docs/terrain-calibration.md`; the old Windows ±25° workaround is superseded.
- [ ] Verify sharp tactical, faction, creep, deployment and mission cards in Warhall Test, including flip behavior and readable descriptions. Unit cards are intentionally removed; unit data will be presented on units later.
- [ ] Verify scoring missions change no board objects. Deployment selection alone owns markers and border segments. Select the map before the deployment: loading a map clears terrain, including deployment markers.

## Requires Warhall client/catalogue support (priority order)

1. [ ] Fix ramp/platform collision: enable mesh colliders on imported raised terrain using `ElevatedGround`, as native Ninth Age hills do (the user confirmed standing on Hill snow works). Imported OBJ geometry currently has collider generation disabled; the WDS Height field only sizes its selection box. Units cannot yet stand on the imported ramps/platforms.

2. [ ] Fix native token preview URLs: AllSkinData emits relative Thumbnail paths while TokenPanel expects absolute HTTPS URLs. Confirm the token panel activation path and make preview failures show a fallback button. See [the investigation](docs/token-menu-client-issue.md). Native prefab previews use AssetUIConfig.UISprite; support a custom preview route or repair cloud thumbnail loading without changing custom artwork.

3. [ ] Fix 32 mm mission-marker measurement: markers currently use round Terrain records, but measurement starts from a corner of the terrain footprint. Support measuring from the circular 32 mm edge (16 mm radius), rather than the rectangular corner or token center. Preserve the decorative control ring independently of the measurement footprint.

4. [ ] Add a per-terrain hide-base option that hides both base renderers while preserving selection/elevation colliders. The existing global switch affects unit bases too. See [the exact client findings and proposed changes](docs/warhall-client-terrain-support.md).

5. [ ] Fix terrain locking/unlocking when loading maps and deployments: map loading ends with SetTerrainLock(true), but deployment helpers call CreateTerrain, which globally calls SetTerrainLock(false). Preserve/restore the lock while loading helpers so loading order does not unexpectedly unlock the board. Keep manual Lock terrain/Unlock terrain usable and verify both loading orders; the WDS schema has no per-placement lock flag.

6. [ ] Make TerrainPanel's addressable-prefab lookup null-safe for hosted GLB/OBJ skins before loading thumbnails. Comparison confirmed by the user: native Hill snow appears in the menu and supports units standing on top; our hosted ramp does neither. Hill snow uses the installed Frozen Tundra/Hill_FT prefab and can use its embedded AssetUIConfig.UISprite; the ramp is a GLB URL. Add the menu button even without an installed prefab, then load the cloud thumbnail with a fallback. Keep shared profile IDs and existing map/deployment references intact. The temporary hill reference was removed in release 48.

7. [ ] Fix **Flip map**: rotate terrain positions and orientations together by 180 degrees so asymmetric walls and ramps retain their layout. Verify two flips restore the original layout. See [the client findings](docs/warhall-flip-limitations.md).

8. [ ] Fix **Flip deployment**: include shared deployment overlays and mission markers, preserving the flip when switching/reloading deployments. See [the client findings](docs/warhall-flip-limitations.md).

9. [ ] Fix editor preservation of custom token/terrain IDs. Its release-34 export omitted all 16 tokens; adding a reference terrain replaced all 30 existing terrain records. Never upload an unchecked editor draft. Use `scripts/compare-wds-export.py` and see `docs/wds-editor-compatibility.md`.

Deployment border objects are implemented in red/blue; switching and flipping still require verification as part of the deployment-flip item.

- [x] Move normal play to published WDS data and shared skin assignments. Built-in deployment template 12 plus shared overlays replaces custom local deployment templates. Legacy cache installers are not required; see `docs/cloud-client.md`.

## Start on the Mac

1. Pull `main` from this repository and run `npm ci` (Node 22 recommended).
2. Run `npm run convert` to download/cache the official PDFs, then `npm run deployments:update` and `npm run terrain:update`. Do not bump versions merely for local regeneration.
3. Run `npm run check:local`. Three New Recruit integration tests are skipped unless a suitable catalogue fixture is installed. The official-PDF tests remain active.
4. Card regeneration additionally needs Python 3, Pillow, pypdf and Poppler's `pdftoppm` on PATH (`brew install poppler`, then install the Python packages in a virtual environment). Run `python scripts/update-cards.py`; it renders lossless PNG faces from the source PDFs. Generated images are committed, so this step is unnecessary just to play or inspect the current release.
5. Start Warhall Test online and use the published Starcraft game and shared skins. No local cache installation is needed. To retire an older machine-local preview, use [the cloud reset instructions](docs/cloud-client.md). Do not restore old local catalogue backups over cloud data.

## Rules research already gathered

- Old World example: https://github.com/christophcarstensen/ToW-WDS (release branch, TOW directory).
- StarCraft New Recruit: https://github.com/modmoto/StarcraftTMG-NR.
- Warhall `RuleLinks` accepts TextMeshPro `<link="recordId">text</link>` references and opens the matching WDS item. Validate every generated target ID. Do not replace official PDF values with potentially older catalogue values.

No client executable has been modified. Temporary downloads, previews and local cache backups are ignored by Git.
