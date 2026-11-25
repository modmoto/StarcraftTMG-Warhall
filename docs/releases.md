# Test and production branches

Use `main` for development and Warhall Test; `release` is the tested production snapshot. Both branches contain one dataset, `Starcraft/`. Generators and local checks always use that folder. The former folder-copy publisher has been removed.

The intended game name is exactly `Starcraft` on each server, resolved independently. Do not select the retired second Test registration or reuse server-local skin IDs between servers.

## One-time Warhall configuration

Ask the Warhall administrators to set and verify these active manifest paths:

- Test: https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/refs/heads/main/Starcraft/manifest.json
- Production: https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/refs/heads/release/Starcraft/manifest.json

Creating branches does not change server settings. Read back `/GetGameVersions`; the old UpdateGameDataPath endpoint returned success without persisting a change. Existing local installations may initially check their previous URL; choosing the game with the corrected server registration must establish the new download path. Do not silently rewrite application caches.

## Development and release

Wave updates now use `npm run wave:update` and a saved Command Center DB snapshot. The general rulebook/glossary remain local; PDFs supply only missing base footprints. Review `command-center-report.json` and the applied `Starcraft/import-report.json`; a candidate under `.cache/wave-update` has not been published. See [DB wave updates](command-center-updates.md). Do not regenerate release unit data with the legacy PDF converter.

1. Work, commit and push directly to `main`. Advance `Starcraft/manifest.json` and `Starcraft/version.json` together when game data changes. Shared-skin-only changes do not need a WDS version bump.
2. Run `npm run check:local`. Publish requested changed skins to Test and check the client. Preserve saved publication checkpoints, working skins and menu aliases.
3. On an authorized release, commit and push all required files to main, then run `npm run release:promote -- --apply`. This creates or fast-forwards remote `release` to the exact main commit, without dataset copying, a second generated snapshot, extra URL commits or force pushing. Both branches must have the same history; if release contains independent commits, reconcile them first rather than silently rewriting it.
4. Publish required missing or changed shared skins with `npm run models:publish -- --server prod --apply --login --accept-publication-terms`, then verify/synchronize aliases with `npm run models:menus -- --server prod --apply --login`. Reuse working skins; branch promotion alone does not update shared skin assignments.
5. Verify the hosted release manifest/version, server registration and shared bindings. A successful API upload does not prove native rendering or gameplay.

The user's description of rebasing release onto main means bringing the production pointer up to tested main. With no release-only commits this is a fast-forward; no rebase or force push is necessary. No GitHub Actions, tags or GitHub release downloads are part of this workflow.

## Absolute URLs and native version metadata

GitHub Raw URLs require a branch or commit. The inspected native `WDSDownload` implementation downloads manifest files relative to the selected server's manifest URL and, after a successful install/update, writes its own local `version.json` with that download URL. It does not keep the URL embedded in the downloaded repository copy. Therefore the same repository version metadata can be promoted unchanged: the production registration supplies `release`, Test supplies `main`. Relative version URLs are not assumed supported. This was checked by reading the existing loader inspection, without modifying or building client code; verify the active URLs in a fresh client after the administrators switch them.

Hash-named card art, faction icons and model assets remain shared HTTPS resources on main. Keep historical immutable files available when publishing new hashes. Gameplay JSON is isolated by the branch-specific manifest, while already-released media remains available under its original hash. Do not overwrite a hash-named asset. A future requirement for entirely independent media hosting would require a separate URL strategy; it is not needed to replace the old folder split.
