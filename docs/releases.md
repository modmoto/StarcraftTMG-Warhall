# Wave releases

## Current workflow override — November 2, 2026

The user has temporarily suspended staging/promotion and requested direct commits and pushes to `main`, with generated URLs targeting `main`. Keep the release scripts available, but do not run them or automatically switch to `test` until the user re-enables that workflow. Production/test project configuration will be reconciled separately by the user; a Git push does not authorize changing Warhall server settings or publishing production skins. The staged process below is retained for later use.

Use `test` for development and Warhall Test, and `main` for approved Warhall production. Both games are named Starcraft and both branches keep the Starcraft folder. Main is never updated automatically after a playtest; the user's “release wave N” instruction is the approval.

The user-facing workflow is “do wave 4” → test the prerelease → “release wave 4”. The wave-release skill handles official content updates, model selection/review, release notes and these commands:

```sh
npm run release:context -- --since v3.0
npm run release:stage -- --version 4.0 --apply
npm run release:promote -- --version 4.0 --apply
```

Without --apply, stage/promote describe their target and do not mutate remote state. Prepared content and releases/4.0.md must be committed first. The command increments the WDS data version separately from the public 4.0 release version. A new candidate after a published tag uses a patch version; published tags are never moved.

The release-notes skill translates commits and verified content changes into concise player-facing releases/VERSION.md. GitHub Actions validates, renders those notes with the beta/stable status, and creates/updates the GitHub release with Starcraft.zip and release-metadata.json. It deliberately uses reviewed wording instead of dumping internal commit titles. No extra AI-provider token is required. The local staging command uploads a test-publication.json receipt only after test skin/menu publication and the GitHub Action succeed.

Promotion reads that receipt and merges the commit pinned by the prerelease tag, not the latest development head. The tag keeps identifying the tested candidate. The stable Starcraft.zip and release-metadata.json are rebuilt from main, with production URLs and the exact production source commit. Updating a tag's prerelease status does not move the tag.

Generated update/image/model URLs follow the branch in Starcraft/version.json. channel:prepare rewrites this repository's tracked game/catalogue JSON URLs for main or test. Generators use that channel for future assets. Promotion resets URLs to main before publishing; do not merge a test channel into main and skip this step.

Warhall Test uses:
https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/test/Starcraft/manifest.json

Production uses:
https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/main/Starcraft/manifest.json

The release command verifies administration and uses Warhall's UpdateGameDataPath API to set/read back the selected server's manifest. Skin IDs, publication receipts and credentials stay separate between servers. Publishing to test cannot update production. Release upload checkpoints are .cache/release-publication-test.json and .cache/release-publication-prod.json; do not delete them after an uncertain request.

One-time prerequisites are a working Git/GitHub CLI login and a private saved Warhall login for each target. Existing macOS Keychain and Windows DPAPI enrollment are used. Production enrollment is `npm run models:credentials -- --server prod` in your own terminal; never send the password in chat. The Starcraft game and administrator access must already exist on that server. Preflight failures stop before main is changed. A fresh Windows checkout may need GitHub CLI installed/authenticated in addition to Git Credential Manager.

If the test Action fails, inspect it before dispatching another release. If production publishing fails after main was pushed, the release stays a prerelease until the remaining steps finish. Check shared API readback and publication checkpoints; do not claim that GitHub release status alone proves a successful Warhall deployment. Full imported-terrain collision, menu previews and other client TODOs remain client limitations.
