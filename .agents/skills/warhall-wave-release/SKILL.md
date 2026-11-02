---
name: warhall-wave-release
description: Update a Starcraft miniature-game wave, publish a playable Warhall Test prerelease, or promote the exact tested wave to production after the user's explicit release instruction.
---

# Wave release workflow

## Active user override (November 2, 2026)

The user explicitly suspended the release process and requested direct work/pushes on main, with generated URLs pointing to main. Do not switch to test or run staging/promotion unless the user re-enables it. Retain these scripts for later. The user will reconcile prod/test project configuration separately; do not change server manifest paths or publish production skins based on this Git-only override. This instruction supersedes the default branch workflow below.

The user wants to say “do wave 4”, test the result, then say “release wave 4”. Handle the intermediate work autonomously. Keep the game named exactly Starcraft on both servers. `test` is the development branch and Warhall Test; `main` is approved production. Keep the single Starcraft folder. See docs/releases.md for commands, environment setup and recovery.

## “Do wave N”: stage only

1. Pull and work on test, preserving unrelated local files. Update the current official PDFs and New Recruit comparison, profiles, linked rules and cards. Research missing models/terrain and visually review actual selections. Preserve existing model poses, base rules, calibrations, colours and approved temporary workarounds. Do not invent unreleased wave data or silently use a generic wrong model. If essential official content or assets are unavailable, finish independent work and explain that precise blocker.
2. Use the repository's existing import/build commands. Update all required data/model references. Run the checks and inspect relevant previews. Keep TODO client limitations honest; updating WDS cannot repair Warhall client code.
3. Use warhall-release-notes to write releases/N.0.md from the changes since the previous release. Commit the prepared content and notes. A later candidate for an already-tagged version needs a patch version, for example 4.0.1; never move published tags.
4. Run `npm run release:stage -- --version N.0 --apply`. It checks credentials before mutations, prepares test URLs/data version, checks/pushes test, publishes shared test skins and menu aliases, sets Warhall Test's manifest path, runs the release Action and uploads a completed test-publication receipt. Publishing uses the private saved login. Do not expose credentials or store them in GitHub Actions. See warhall-publish-skins for rights/terms and uncertain-request recovery.
5. Confirm the GitHub prerelease and actual API results. Tell the user what to test and stop for their playtest. Do not update main or production just because staging succeeded.

## “Release wave N”: promote after playtest

The user's explicit instruction to release/promote the tested wave is the production authorization. Do not ask again merely because the script writes production. Never infer approval from silence, elapsed time, a successful test job or an available production login.

Run `npm run release:promote -- --version N.0 --apply` from a clean test checkout. It validates the receipt against the published prerelease tag, preflights the production account/admin role, merges that tested commit into main, prepares main URLs and an increasing WDS data version, checks/pushes main, publishes production skins and menu aliases, sets the production manifest, marks the GitHub release stable and returns to test. It does not release later untested commits from the test branch.

Review and resolve real merge conflicts using the tested release and any deliberate main hotfixes; do not blindly discard either. If an upload or workflow fails, inspect its checkpoint/run and continue the incomplete step. Do not re-create an uncertain upload, clear checkpoints, force-push branches or retag a published release. Never mark production complete until shared assignments and the GitHub stable release both succeed.

Production needs a separately enrolled local login and Starcraft administrator access. If absent, prepare all permitted work and ask for that one-time private enrollment, explaining the exact missing prerequisite. The script refuses before switching/pushing main. GitHub release creation is not itself a Warhall production deployment.
