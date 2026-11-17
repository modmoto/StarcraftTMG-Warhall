---
name: warhall-wave-release
description: Validate Starcraft on main, publish Test assets, and promote tested main commits to the release branch for production with required shared skins.
---

# Starcraft branch publication

Work directly on main. Both main (Test) and release (production) use the single Starcraft/ dataset. Generators default there. Do not restore a separate Test folder or copy between dataset folders. Read docs/releases.md for exact URLs and native version metadata behavior. Do not create client patches, GitHub release artifacts, Actions or tags.

## Prepare and test

Preserve reviewed models, transforms, footprints, native ExtraItems and approved rule presentation. Run npm run check:local; review relevant visuals and increment manifest/version together for data changes. Commit and push authorized changes directly to main. Publish requested missing or changed shared skins to Warhall Test using warhall-publish-skins and saved login, then synchronize menu aliases. Both servers use the exact game name Starcraft; resolve IDs separately. Do not target the retired second Test registration. Keep server-scoped checkpoints and reuse working skins.

## Release

A user request to release authorizes the complete operation: push main and required assets, promote tested main to release, publish missing/changed production skins and verify their default/menu assignments. Git push alone is not the complete release. Do not request an extra approval for these already authorized steps.

1. Run npm run check:local and finish any required validation. Commit and push all release files to main.
2. Run npm run release:promote -- --apply. It creates or fast-forwards release to main's exact commit, with no folder copy, URL-rewrite commit or forced history rewrite. Independent release-only commits require reconciliation before promotion. Do not rebase main onto release.
3. Publish matching production skins with npm run models:publish -- --server prod --apply --login --accept-publication-terms, then npm run models:menus -- --server prod --apply --login. Upload only missing/changed assets; retain resume checkpoints and verify outcomes. Existing publication-terms acceptance persists.
4. Verify hosted manifest/version and the actual server data paths: Test main/Starcraft/manifest.json, production release/Starcraft/manifest.json. Native successful downloads save their source URL into local version metadata; no relative-version-URL assumption is needed. Shared content-addressed media stays on main and historical hashes remain available.
5. Report the data version, branch commit, asset results and remaining client checks.

Production authentication is separate. Never print credentials or replace local client caches to simulate publication. The old UpdateGameDataPath endpoint has returned success without saving settings: read back GetGameVersions and report any administrator action still required. Do not claim that branch creation changed the server setting.
