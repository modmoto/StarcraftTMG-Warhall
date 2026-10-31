# Shared model catalogue

`model-catalogue.json` defines the HTTPS mesh and texture URLs, scale, position, rotation and target profile ID for 45 units and 17 terrain assemblies. Three mission markers reuse existing Warhall skins. Attachments have independent transforms. This is a publisher input, not a file the Warhall WDS manifest consumes.

The initial catalogue is generated from the visually reviewed `model-selections.json` and `terrain-models.json`:

```sh
npm run models:catalogue
```

Edit `model-catalogue.json` to change a remote URL or transform. Regenerating replaces those edits; update the source selections instead if the change should survive regeneration. GitHub raw HTTPS URLs and the current TTS CDN URLs are supported. No local asset paths are allowed.

Preview the requests without logging in or changing the server (create `.cache` first if it does not exist):

```sh
npm run --silent models:publish > .cache/model-publication-preview.json
```

## Publish

Sign in to https://apptest.warhall.eu and confirm that your account is an administrator for Starcraft: Model Creator's category selector should offer **Assign as default skin**. Review the public-skin rights, platform hosting licence and takedown confirmations there. The command requires your explicit acceptance of those same terms; it does not establish that third-party assets are licensed for redistribution.

The test frontend has no documented API-token flow. This adapter uses its existing authenticated endpoints. Supply your own session Cookie header through the `WARHALL_COOKIE` environment variable, using your shell's secret input or session environment. Never put it in JSON, command arguments, Git, or chat. It is sent only to the configured server; redirects are rejected. Unset the variable after publishing.

```sh
npm run models:publish -- --apply --accept-publication-terms
```

The script resolves the game ID by name, checks admin access, creates public skins from URLs and adds shared default assignments. New assignments use add mode; authorized replacements override the selected profile after creating its new skin. Server-generated skin IDs and progress are saved to ignored `.cache/model-publication.json`; retain that file between runs and across publisher machines. Unchanged completed entries are reused, manually deleted uploads are recreated, and failed assignments reuse their created skin.

If a create request times out or its outcome is uncertain, the script stops retries for that entry. Check the web catalogue before reconciling its saved state: set `skinId` to the created ID and remove `creating`, or remove the entry only after confirming no skin was created. A changed model definition or screenshot triggers replacement of an owned skin, with the old skin retained until the new assignment succeeds. Do not delete the whole state file to retry: that can create duplicates. Avoid simultaneous publisher runs.

`--catalogue PATH` and `--state PATH` select alternate files. The state is scoped to the server and game; production needs its own verified catalogue and state.

## Current limits

The API adapter follows the test site's current frontend and has automated mock tests, but has not been published through an authenticated account. Shared defaults and multipart transforms still need a live client check. Some selected URLs contain Unity asset bundles; those must be converted to a portable format before Mac compatibility can be promised. Texture colours patched only in a Windows cache are also not reproduced by registration alone.

This publisher registers models and terrain appearances. It does not publish custom deployment templates, change gameplay JSON, upload binary assets, or replace the remaining portability work. After publishing, refresh the shared catalogue in Warhall Test and check units and terrain on both platforms.

## Marine calibration

The shared Marine skin is 12999 (layer 33205). Its initial nonlegacy normalized scale was 1.1811023622, corresponding to approximately 80 mm maximum dimension. The catalogue editor was used to halve it on October 31, 2026; the model now fits within the 32 mm reference base in the web preview. In-game verification is pending. `model-publication-overrides.json` records its existing skin ID and approximately 0.5905511811 scale so regeneration retains this calibration and publication does not create another Marine skin. The publisher reuses existing skin IDs; it does not edit their transforms. Subsequent shared scale changes must be saved in the catalogue editor as well as recorded in the override. Existing local-test legacy scales are not interchangeable with new normalized web-import scales.

## Next waves and default-scale import

The reusable `$warhall-publish-skins` skill is installed in `~/.codex/skills/warhall-publish-skins`, with a repository copy under `.agents/skills/warhall-publish-skins`. It describes selection, creation, shared assignment and resume handling.

To skip scale/transform calibration for new models and authenticate interactively:

```sh
npm run models:publish -- --apply --login --default-scale --accept-publication-terms
```

The local terminal asks for username/email and a hidden password. It uses the same Firebase password sign-in and `/sessionLogin` exchange as the website. No credentials or session cookies are saved. The public Firebase configuration is read from the test site's frontend. Interactive MFA/CAPTCHA or login policy restrictions require using the website or an explicitly supplied session; the command does not bypass them. Browser login alone does not authenticate this CLI.

`--default-scale` sends `model_size: 1` and no transforms for new skins. It also omits multipart offsets/rotations; geometric arrangement and final size are deferred. Existing skins, including Marine 12999, retain their saved appearance. Use the same mode when resuming so fingerprints match.

## Test and production targets

`--server test` (the default) targets `https://apptest.warhall.eu`. `--server prod` targets `https://www.warhall.eu`. The literal HTTPS URLs are accepted as well. Preview production without writes:

```sh
npm run models:publish -- --server prod --default-scale
```

Add `--apply --login --accept-publication-terms` only when publication to that target is intended. Production uses `.cache/model-publication-prod.json`; test retains `.cache/model-publication.json`. Existing skin IDs are local to a server: the test Marine ID is not reused in production, and three native markers without verified production IDs are excluded. The publisher queries `/GetMySkinUsages` and skips a verified existing game/profile/default assignment, including the previously published Marine.

The first batch omitted thumbnails. New skin creation now requires a prepared snapshot and sends it as `thumbnail_data_url`; see below. Updating thumbnails on the 27 already-created skins still needs a supported update operation; none has yet been identified in the inspected frontend.

## Thumbnail images

Missing previews render automatically from the selected textured geometry as 512 × 512 PNG images under `.cache/model-thumbnails/<profileId>.png`. JPEG and WebP are also accepted. The upload command sends these bytes as `thumbnail_data_url` for both single-part and multipart skins. OBJ previews render in Node. Unity asset bundles use the included Python decoder for prefab transforms, skinning and materials. The renderer also resolves secondary TTS material bundles from `tts-model-sources.json` when required.

Use `--thumbnails-dir PATH` for another folder, or add `thumbnailFile` to an entry in `model-catalogue.json`:

```json
{ "profileId": "prof_marine", "thumbnailFile": "previews/prof_marine.png" }
```

This example shows the additional field, not a complete catalogue entry. A corresponding `thumbnailFile` override in `model-publication-overrides.json` survives catalogue regeneration. PNG, JPEG and WebP signatures are recognized; images must be nonempty and at most 5 MiB. Missing images are generated before login. Rendering failures are listed in dry-run output. Apply checks them for every selected model/terrain assembly before asking for credentials or making changes. There is no fallback to publishing a null thumbnail.

Native marker skins need no snapshot. Uploaded model/terrain assemblies need snapshot files even when previously published, so image changes and deleted server data can be reconciled. Thumbnail paths do not invalidate saved model fingerprints. This avoids duplicate creation, but does not backfill previews for earlier uploads. Visual verification and a supported existing-thumbnail update operation remain separate.

## Fresh replacement

The command generates missing snapshots automatically. To force fresh skin uploads, use:

```sh
npm run models:publish -- --apply --login --default-scale --replace --accept-publication-terms
```

The importer reads the owned server catalogue to reconcile checkpoint IDs. It recreates manually deleted uploads instead of trusting an old assigned flag. In ordinary mode, changed model definitions or screenshot bytes also trigger replacement; `--replace` forces it even for unchanged inputs.

Each replacement creates the new skin with its snapshot, assigns it with override mode, then deletes the old owned skin through `/DeleteMySkin`. Native marker references are reused. Other users' skins are never deleted; an old skin referenced by another game/profile is retained and reported. A failed assignment leaves the old skin intact; failed deletion resumes cleanup without recreating the replacement. An incomplete replacement batch is resumed on retry; invoking `--replace` after completion intentionally starts a new full replacement. Keep the progress file.

The supported way to refresh a screenshot here is replacing the owned skin, rather than an unverified thumbnail-update endpoint. This changes the skin ID and can affect saved games referencing the old ID. The replacement behaviour is tested with a simulated API; live replacement has not yet been verified.

## Automatic thumbnail generation

`npm run models:thumbnails` generates or validates all cached previews without logging in or publishing. Use `-- --profile PROFILE_ID` for one model, `-- --force` to regenerate images, or `-- --use-transforms` to include configured scales in preview geometry. The publisher generates missing previews automatically with its selected scale mode.

Generated images have a `.render.json` sidecar fingerprint. Source/transform or renderer changes regenerate those images; manually supplied images without metadata are preserved. Network source files and decoded bundle geometry are cached under `.cache/thumbnail-assets`. The renderer uses real mesh geometry, UV textures, triangle depth testing and automatic framing. It produces a catalogue image, not a guarantee of matching Unity's lighting or final in-game rendering.

Node and the cross-platform sharp dependency handle OBJ geometry, texture decoding and rasterization. Unity bundles additionally require Python 3.10+ available as `python3` on macOS or `python` on Windows. Set `WARHALL_PYTHON` to select another interpreter. On first use, the script installs pinned UnityPy and NumPy into the ignored asset cache. This helper only decodes downloaded model assets; it does not read Warhall credentials or application caches.
