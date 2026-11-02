---
name: warhall-wave-release
description: Update Starcraft test data or publish a tested Starcraft-test folder to Starcraft and upload the required shared Warhall skins. No branch staging, GitHub Actions or GitHub releases.
---

# Starcraft folder publication

Work in StarcraftTMG-Warhall on main. Starcraft-test/ is the working copy; Starcraft/ is the live copy. Both use GitHub main URLs. The registered Test game is Starcraft-test; production is Starcraft. Do not use the old test branch, create GitHub releases/tags or reintroduce Actions. See docs/releases.md.

## Prepare and test

For “do wave N” or ordinary edits, update Starcraft-test only. Use the existing official PDF importer and New Recruit comparison; preserve reviewed poses, base sizes, transforms and temporary workarounds. All generators now default to Starcraft-test. Root model inputs/catalogue and immutable hash-named model-assets remain shared. Do not invent unavailable official content.

Run npm run check:local and review relevant images. Commit and push main without staging unrelated local files. Publish changed skins to Warhall Test using the existing publisher and saved login, then synchronize menu aliases. Use warhall-publish-skins for API details and resumable checkpoints. Stop for playtesting; a test upload does not authorize live publication.

## Publish the tested copy

The user's “release”, “publish live” or equivalent instruction authorizes copying and production upload. Confirm the working copy is the tested content, then:

1. Run npm run check:local.
2. Run npm run data:publish. It copies the whole Starcraft-test folder, including assets, to Starcraft, removes obsolete live files, changes owned data URLs to main/Starcraft, and advances both live version files. The test folder stays unchanged.
3. Review the diff, commit and push main before remote skins reference newly generated files.
4. Run npm run models:publish -- --server prod --apply --login --accept-publication-terms, then npm run models:menus -- --server prod --apply --login. The publisher reconciles existing owned defaults and uploads only missing/changed skins with thumbnails. Retain server-scoped checkpoints; do not clear them, force replacement of every model, or duplicate an uncertain request.
5. Validate Starcraft with node scripts/validate.mjs Starcraft and verify the API outcomes. Report the data version and any outstanding gameplay limitation. No GitHub release or tag is part of publication.

Production login/admin access is separate from test. Use private credential storage; never print credentials or request them in chat. Existing publication terms acceptance persists; supporting an API flag alone is not proof of acceptance. Production preflight should happen before pushing the live copy when credentials/admin access are uncertain.

Warhall Test should read main/Starcraft-test/manifest.json, production main/Starcraft/manifest.json. These are one-time project settings. The legacy UpdateGameDataPath endpoint has returned True without saving a path; read back the actual path before claiming a configuration change. Do not edit local caches or silently move either server to a different game.
