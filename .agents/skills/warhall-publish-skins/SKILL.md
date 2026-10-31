---
name: warhall-publish-skins
description: Publish Starcraft model and texture URLs to Warhall Test through its skin API, assign shared unit or terrain defaults, and resume next-wave imports without duplicate skins.
---

# Warhall skin publication

Use the StarcraftTMG-Warhall repository's Node publisher. Locate the checkout from the current workspace or saved projects; the original checkout was `repositories/StarcraftTMG-Warhall`. This skill describes the workflow; executable code and the maintained catalogue live in that repository.

Read `docs/model-publication.md`, `model-catalogue.json`, and the publisher's current CLI before mutation. Do not confuse a WDS data-version release with shared skin registration.

## Prepare a wave

- Add visually selected model and texture URLs to `model-selections.json` (units) or `terrain-models.json` (terrain), using the actual WDS profile/terrain IDs. Run `npm run models:catalogue` and inspect its changes. Keep existing entries and `model-publication-overrides.json` so known skin IDs are reused.
- Default target is `https://apptest.warhall.eu` (`--server test`). Production is `https://www.warhall.eu` (`--server prod`). The literal URLs are accepted too. Publish only to the target the user requested; supporting production does not authorize publishing there. Target game is `Starcraft` with exact case. There is also a distinct lowercase `starcraft` game. Resolve the game ID through `/GetGamesWeb/`, never infer it from the name or a local cache.
- User preference as of October 31, 2026: skip scale calibration. Use `--default-scale` for new uploads unless asked to change that. Do not alter existing skin scales. Default-scale import omits transforms; do not claim multipart layout accuracy or cross-platform bundle compatibility from registration alone.
- Preview `npm run --silent models:publish -- --default-scale`. The initial catalogue contains 45 units, 17 terrain assemblies and three existing marker skins; counts change with future waves. Marine skin 12999 is already published.

## Authenticate and publish

The browser login is not a Node session. Use an explicitly supplied `WARHALL_COOKIE`, or have the user run the interactive terminal login. Do not collect secrets in chat or read browser cookies/cache/auth storage.

```sh
npm run models:publish -- --apply --login --default-scale --accept-publication-terms
```

`--login` prompts locally for username/email and a hidden password for the selected target. It follows the website's Firebase password sign-in and `/sessionLogin` flow. Credentials and session cookies stay in memory. If MFA, CAPTCHA, denied access or an interactive challenge blocks login, stop and hand off the required authentication action rather than bypassing it.

Publication requires Starcraft administrator access and agreement to Warhall's public-content terms. A command flag is not evidence that the human accepted them. Check existing session authorization; ask at the actual acceptance step only if acceptance is not already authorized. Do not infer asset ownership from their availability in TTS or GitHub.

The publisher uses:

- `POST /api/tripo/create-and-link-skin`: `model_url`, `texture_url`, `skin_name`, `model_size`, `transforms`, `is_public: 1`, optional thumbnail.
- `POST /api/tripo/create-and-link-skin-multipart`: `skin_name`, `parts` containing independent model/texture URLs and transforms, `is_public: 1`.
- `POST /AssignCatalogueSkin`: returned `skinId`, WDS `profileId`, resolved `gameId`, `costumeDefault: 1`, `selectedOptions: []`, `mode: 'add'`.

These are observed frontend endpoints, not a stable documented public API. Verify response shapes if the site changes. The Marine was originally published through the website UI; do not describe that as an already validated Node API upload.

## Resume and verify

Retain ignored `.cache/model-publication.json` for test and `.cache/model-publication-prod.json` for production between runs and publisher machines. Server-local existing skin IDs are not reused across targets; native marker references without verified target IDs are excluded. It records server/game scope, definition fingerprints, skin IDs and assignment completion, with no credentials. Do not run concurrent publishers. When a creation outcome is uncertain, reconcile it in the catalogue before retrying: the existing script deliberately stops rather than risk creating a duplicate. Changed fingerprints also require review. Do not clear the whole state to force retries.

The publisher checks `/GetMySkinUsages` before assigning a known skin ID; exact game/profile/default matches are recorded as completed instead of posted again. Existing skin IDs avoid creation but still require correct shared assignment. Inspect conflicts instead of silently replacing another skin. Keep successful progress when another entry fails. Report registered, assigned, skipped and failed entries from actual responses/state; prepared payloads and passing mock tests are not proof of publication.

Verify shared defaults in the website and refresh Warhall Test's catalogue, then add fresh units/terrain. A WDS version bump is only needed for game data changes. UnityFS asset bundles may be platform-specific; successful API registration does not establish Mac rendering. Do not modify application caches to pretend shared publication succeeded.

## Catalogue previews

The current Node publisher supplies no thumbnail (`thumbnail_data_url: null`). Successful registration therefore does not imply a visible catalogue preview. The website generates a snapshot with `captureSnapshot(512,512)` and includes its data URL in skin creation. Inspect or extend preview generation before claiming a wave is preview-complete. No supported thumbnail-update endpoint for existing skins has been identified; do not invent one or recreate existing skins merely to obtain previews. The first API batch created and assigned 27 skins (13000–13026) before encountering Marine's existing assignment. Resume the same checkpoint after the reconciliation fix; never restart from an empty state.
