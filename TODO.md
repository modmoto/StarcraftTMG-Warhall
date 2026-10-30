# Mac handoff

Release 10: `npm run check:local` passed (23 tests passed, 3 optional catalogue tests skipped). Windows Warhall Test loaded version 10, Official Map 5 with complete raised platform assemblies, and the regenerated Acropolis card. Full card readability/flip checks and Mac verification remain below.

## Next work

- [ ] Clean up unit rules. Split phase-wide text into individually named abilities, format costs/phases clearly, remove UI provenance and manual-upgrade placeholders, and link nested keywords such as Stimpack → Precision. Use the current official PDFs for gameplay wording and compare the New Recruit catalogue's references. No rule cleanup has been released yet.
- [ ] Verify the final L-shaped Wall Set 4/5 footprints in Warhall Test on macOS. Their skin rotation and map rotation compensate each other, preserving world placements. Other wall bases must retain their current orientation.
- [ ] Verify sharp tactical, faction, creep, deployment and mission cards in Warhall Test, including flip behavior and readable descriptions. Unit cards are intentionally removed; unit data will be presented on units later.
- [ ] Verify scoring missions change no board objects. Deployment selection alone owns markers and border segments. Select the map before the deployment: loading a map clears terrain, including deployment markers.

## Requires Warhall client/catalogue support

- [ ] Enable mesh colliders on imported raised terrain using `ElevatedGround`, as native Ninth Age hills do. Imported OBJ geometry currently has collider generation disabled; the WDS Height field only sizes its selection box. Units cannot yet stand on the imported ramps/platforms.
- [ ] Add a per-terrain hide-base option that hides both base renderers while preserving selection/elevation colliders. The existing global switch affects unit bases too. See [the exact client findings and proposed changes](docs/warhall-client-terrain-support.md).
- [ ] Relock terrain after deployment markers spawn. This client explicitly unlocks terrain on creation; the data format has no relock flag. Markers already use terrain and obey Battlefield > Lock terrain.
- [ ] Register deployment templates and CDN skin/item associations in Warhall's shared catalogue. Current cache adapters only install them on the test machine; a GitHub manifest/version bump alone does not register them for another computer.
- [ ] Check grass alpha rendering and any nonuniform TTS scale differences. The current remote-skin format exposes uniform scale.

## Start on the Mac

1. Pull `main` from this repository and run `npm ci` (Node 22 recommended).
2. Run `npm run convert` to download/cache the official PDFs, then `npm run deployments:update` and `npm run terrain:update`. Do not bump versions merely for local regeneration.
3. Run `npm run check:local`. Three New Recruit integration tests are skipped unless a suitable catalogue fixture is installed. The official-PDF tests remain active.
4. Card regeneration additionally needs Python 3, Pillow, pypdf and Poppler's `pdftoppm` on PATH (`brew install poppler`, then install the Python packages in a virtual environment). Run `python scripts/update-cards.py`; it renders lossless PNG faces from the source PDFs. Generated images are committed, so this step is unnecessary just to play or inspect the current release.
5. Locate the Mac Warhall Test data directory. Close the client and back it up before using the adapters below; they validate the final directory name/schema and refuse unexpected paths. The Windows cache itself is not in Git.

```sh
node scripts/install-warhall-deployment-cache.mjs /path/to/WarhallTest --apply
node scripts/install-warhall-marker-cache.mjs /path/to/WarhallTest/Database --apply
node scripts/install-warhall-model-cache.mjs /path/to/WarhallTest/Database --apply
node scripts/install-warhall-data.mjs /path/to/WarhallTest --apply --local-source --local-assets
```

`--local-source --local-assets` creates a machine-local preview snapshot under `.cache/warhall-preview`, including file URLs for card images, and points the test client's game-version cache there. Reapply the installer after changing data, then restart Warhall Test. Backups are printed by each adapter. Restore the backed-up GetGameVersions and cache files to return to the published/shared catalogue. These adapters were exercised on Windows; verify the Mac client's cache format before applying them.

## Rules research already gathered

- Old World example: https://github.com/christophcarstensen/ToW-WDS (release branch, TOW directory).
- StarCraft New Recruit: https://github.com/modmoto/StarcraftTMG-NR.
- Warhall `RuleLinks` accepts TextMeshPro `<link="recordId">text</link>` references and opens the matching WDS item. Validate every generated target ID. Do not replace official PDF values with potentially older catalogue values.

No client executable has been modified. Temporary downloads, previews and local cache backups are ignored by Git.
