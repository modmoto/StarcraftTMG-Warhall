---
name: warhall-publish-skins
description: Publish Starcraft model, texture and thumbnail images through the Warhall test or production skin API, assign shared defaults, and resume next-wave imports without duplicates.
---

# Warhall skin publication

Use the StarcraftTMG-Warhall repository's Node publisher. Locate the checkout from the current workspace or saved projects; the original checkout was `repositories/StarcraftTMG-Warhall`. This skill describes the workflow; executable code and the maintained catalogue live in that repository.

Read `docs/model-publication.md`, `model-catalogue.json`, and the publisher's current CLI before mutation. Do not confuse a WDS data-version release with shared skin registration.

## Prepare a wave

- Add visually selected model and texture URLs to `model-selections.json` (units) or `terrain-models.json` (terrain), using the actual WDS profile/terrain IDs. Run `npm run models:catalogue` and inspect its changes. Keep existing entries and `model-publication-overrides.json` so known skin IDs are reused.
- Default target is `https://apptest.warhall.eu` (`--server test`). Production is `https://www.warhall.eu` (`--server prod`). The literal URLs are accepted too. Publish only to the target the user requested; supporting production does not authorize publishing there. Target game is `Starcraft` with exact case. There is also a distinct lowercase `starcraft` game. Resolve the game ID through `/GetGamesWeb/`, never infer it from the name or a local cache.
- Unit baseline: retain the working Windows-cache layouts. Release 21 explicitly recalibrates terrain against the PDF grid; use `docs/terrain-calibration.md` for terrain. Run `models:catalogue` to prepare equivalent shared-API transforms; read `docs/model-calibration.md`. Do not fit meshes to bases or reset rotations/positions. Prepared `windows-cache-v1` catalogue entries ignore the old `--default-scale` reset. Normal commands now omit that flag.
- Missing previews render automatically as described under Catalogue previews; inspect them and preview `npm run --silent models:publish --`. The initial catalogue contains 45 units, 17 terrain assemblies and three custom marker skins; counts change with future waves. Marine skin 12999 is already published.

## Authenticate and publish

The browser login is not a Node session. Use an explicitly supplied `WARHALL_COOKIE`, or have the user run the interactive terminal login. Do not collect secrets in chat or read browser cookies/cache/auth storage.

```sh
npm run models:publish -- --apply --login --accept-publication-terms
```

`--login` prompts locally for username/email and a hidden password for the selected target. It follows the website's Firebase password sign-in and `/sessionLogin` flow. Credentials and session cookies stay in memory. If MFA, CAPTCHA, denied access or an interactive challenge blocks login, stop and hand off the required authentication action rather than bypassing it.

Publication requires Starcraft administrator access and agreement to Warhall's public-content terms. A command flag is not evidence that the human accepted them. Check existing session authorization; ask at the actual acceptance step only if acceptance is not already authorized. Do not infer asset ownership from their availability in TTS or GitHub.

The publisher uses:

- `POST /api/tripo/create-and-link-skin`: `model_url`, `texture_url`, `skin_name`, `model_size`, `transforms`, `is_public: 1`, optional thumbnail.
- `POST /api/tripo/create-and-link-skin-multipart`: `skin_name`, `parts` containing independent model/texture URLs and transforms, `is_public: 1`.
- `POST /AssignCatalogueSkin`: returned `skinId`, WDS `profileId`, resolved `gameId`, `costumeDefault: 1`, `selectedOptions: []`, `mode: 'add'`.

These are observed frontend endpoints, not a stable documented public API. Verify response shapes if the site changes. The Marine was originally published through the website UI; do not describe that as an already validated Node API upload.

## Resume and verify

Retain ignored `.cache/model-publication.json` for test and `.cache/model-publication-prod.json` for production between runs and publisher machines. Server-local existing skin IDs are not reused across targets; native marker references without verified target IDs are excluded. It records server/game scope, definition fingerprints, skin IDs and assignment completion, with no credentials. Do not run concurrent publishers. When a creation outcome is uncertain, reconcile it in the catalogue before retrying: the script stops rather than risk creating a duplicate. Changed model fingerprints or screenshot hashes trigger replacement of an owned upload. Do not clear the whole state to force retries.

The publisher checks `/GetMySkinUsages` before assigning a known skin ID; exact game/profile/default matches are recorded as completed instead of posted again. Existing skin IDs are reconciled against the live owned catalogue and shared assignments; a deleted model is recreated rather than skipped because of its checkpoint. Inspect conflicts instead of silently replacing another skin. Keep successful progress when another entry fails. Report registered, assigned, skipped and failed entries from actual responses/state; prepared payloads and passing mock tests are not proof of publication.

Verify shared defaults in the website and refresh Warhall Test's catalogue, then add fresh units/terrain. A WDS version bump is only needed for game data changes. UnityFS asset bundles may be platform-specific; successful API registration does not establish Mac rendering. Do not modify application caches to pretend shared publication succeeded.

## Catalogue previews

Missing previews are generated automatically by the Node publisher from the selected meshes and textures, including multipart assemblies. It rasterizes real geometry to a textured 512 × 512 PNG; it does not use generic icons or texture atlases as previews. Preview framing and model orientation are independent of in-game scale calibration. OBJ rendering runs in Node; Unity bundles use a Python decoder that reads prefab transforms, skinning and embedded materials, including the TTS secondary material bundle when needed.

Generated snapshots are cached as `.cache/model-thumbnails/<profileId>.png`. To use a manual snapshot, save it at that location (also accepts `.jpg`, `.jpeg` and `.webp`), or use `--thumbnails-dir PATH`. Alternatively set an entry's `thumbnailFile` to a project-relative snapshot path. Put persistent paths in `model-publication-overrides.json` so `models:catalogue` retains them. The same snapshot is portable between test and production; skin IDs and progress are not.

Before login or any create request, the CLI loads or generates snapshots for selected model/terrain assemblies. Generated previews have a `.render.json` fingerprint; changed source URLs, transforms or renderer versions regenerate them. Manual images without renderer metadata are preserved. Native skin references need no snapshot. A dry run reports `missingThumbnails` only for rendering failures; apply stops on those failures. It detects the image MIME type, enforces a nonempty image and 5 MiB maximum, base64-encodes the bytes and supplies the resulting data URL as `thumbnail_data_url` to both single-part and multipart creation endpoints. There is no null-thumbnail fallback. Missing/invalid files fail before marking a create request as uncertain.

Adding `thumbnailFile` does not change the model fingerprint; the image content is tracked separately by SHA-256. Sending a snapshot at creation does not establish that Warhall displayed it: verify catalogue previews after upload.

The first API batch created and assigned 27 skins (13000–13026) without previews. The user subsequently deleted uploads and authorized fresh replacement. Keep checkpoint reconciliation; do not blindly mark the old IDs as current.

## Replace uploads and screenshots

Use `--replace` when the user requests a fresh upload of all selected models, even if input URLs are unchanged:

```sh
npm run models:publish -- --apply --login --replace --accept-publication-terms
```

The importer reads the paginated owned catalogue using `/GetCatalogueSkins?viewMode=mine...`. A missing uploaded skin is recreated even when the saved checkpoint says assigned. For normal subsequent runs, changed model definitions or snapshot bytes also trigger replacement.

Replacement order is create the new skin with its screenshot, assign the returned ID to the profile using `mode: 'override'`, then call `POST /DeleteMySkin` with the old owned skin ID. Cleanup happens only after assignment succeeds. Do not broaden this to delete unrelated uploads, native marker skins, or other users' skins. An old skin referenced by another game/profile is retained and reported.

Creation, assignment and old-skin cleanup have separate checkpoint progress. Failed assignments preserve the old skin; failed cleanup resumes without creating another replacement. Retrying an incomplete `--replace` batch resumes the same batch. Running `--replace` after a completed batch intentionally starts another full replacement. These endpoints are observed frontend APIs; mocked lifecycle tests do not prove a live replacement succeeded.

There is still no verified operation to update an existing skin's thumbnail in place. The authorized replacement flow supplies a fresh screenshot as part of new skin creation, then removes the obsolete owned skin. No manual preparation is required for supported OBJ and Unity sources. Run `npm run models:thumbnails` to generate/review all previews without publication, or `npm run models:thumbnails -- --force` to rebuild generated previews. Unity thumbnails require Python 3.10+ (`WARHALL_PYTHON` can select it); the helper installs pinned UnityPy and NumPy into the ignored thumbnail cache on first use. Node uses sharp for PNG/texture decoding on Mac and Windows. Unsupported or invalid geometry must produce an explicit failure rather than a placeholder.

## Windows-equivalent sizes and portable assets

Read `docs/model-calibration.md` before changing model transforms. The working source is the original layout data consumed by `install-warhall-model-cache.mjs`, not the earlier website/default-scale uploads. Single OBJ API scales compensate for the client’s nonlegacy normalization; multipart scales, rotations and translations retain their authored values. Never replace this conversion with uniform sizing or base-fitting heuristics unless the user requests new physical sizes.

The five Unity-prefab sources are converted into textured static GLBs under `model-assets/`; `model-calibration-report.json` records the source/API dimensions. Push these content-addressed assets before running the authenticated publisher. Apply verifies that their GitHub URLs are live first. Passing glTF validation and transform tests does not replace a live Adept/wall check in Warhall Test. No WDS version bump is needed for a shared-skin-only correction.

## Repair missing offsets or rotations in existing skins

Read `docs/model-calibration.md` when multipart geometry or wall angles differ despite matching source JSON. The live creation API stored exact zero vector components as null; the client drops the entire vector if any component is null. `wirePayload` encodes zero position/rotation components as `1e-7` on create/update requests. Keep this transport adapter in the publishing path; source/catalogue transforms stay unchanged.

Use `npm run models:repair -- --apply --login --profile PROFILE_ID` for an existing shared skin. Omit `--profile` only when repairing the whole selected catalogue is requested. Default server is test, with the same `--server` choices as publishing. This targets `/UpdateSkinLayerTransforms` and verifies `/SelectSkinParts` readback instead of reuploading or deleting models. No new content-licensing acceptance is needed for an already-authorized transform correction. Ask the user to authenticate only if a usable explicit API session is unavailable; never extract browser cookies. A successful readback must have all numeric components and the intended values. Refresh the client catalogue and reload spawned terrain to verify the visual repair.

## Mission marker skins

The three `kind: marker` entries combine a 32 mm central disc with the TTS objective chevron artwork in one collider-free GLB. The control range extends three inches from the disc edge (184.4 mm overall diameter). WDS Width/Length remain 3.2 cm; do not enlarge them to the decorative ring. The client minimum-distance calculation uses the base edge. Manual ruler modes and live selection still require a client check.

Push generated `model-assets/` files and version 18 WDS data before publishing. To publish only these three skins, including their generated screenshots:

```sh
npm run models:publish -- --kind marker --apply --login --replace --accept-publication-terms
```

`--kind unit|terrain|marker|deployment` limits the batch. Test marker entries explicitly replace the profile assignments for native IDs 6201–6203; those shared native assets must never be deleted. Production does not reuse test-local native IDs. Preserve the existing profile IDs and deployment placements. Release 19 uses built-in template 12 plus shared deployment overlays; see `docs/shared-deployments.md`.

## Deployment entry lines and grid

Release 19 restores the original border-only entry lines through shared GLB skins, using built-in deployment template 12 with X=0,Y=0 for all eight menu entries. Duplicate native template IDs are intentional; indices select the matching `DeploymentTerrains` record. Do not revert to unavailable custom DeploymentDB IDs or fill the influence zones. `deployment-templates.json` retains the authored line coordinates and stable overlay identifiers; `models:catalogue` generates `kind: deployment` assets with centimeter calibration.

After pushing assets, run `npm run models:publish -- --kind deployment --apply --login --accept-publication-terms`. This uploads eight overlays and generated thumbnails without touching unit skins. Existing marker publication remains separate. Verify a 54×36 fresh room, all deployment names, border lines, switching/flipping, marker positions and the grid. These overlays are spawned decorative terrain rather than native deployment-line objects; do not promise native line-toggle behavior or a completed live test from mock tests alone.

## PDF-grid terrain (release 21)

The user explicitly requested new terrain sizing and precise grid placement, superseding the earlier Windows-size preservation rule for terrain only. Preserve the unit baseline. `terrain-calibration.json` owns reviewed footprint measurements and map poses; `terrain:update` composes nonuniform parent/child XYZ transforms and bakes complete terrain into single GLBs. Do not return to largest-axis uniform scaling, split the ramp/platform assembly, or reintroduce guessed ±25° wall compensation. Read `docs/terrain-calibration.md`; PDF dimensions are raster estimates and heights remain source-authored.

Run `terrain:update`, `models:catalogue`, `terrain:review` and local checks, inspect all six grid/base-outline views, then push the hosted assets and version 21 data. Publish only terrain with `npm run models:publish -- --kind terrain --apply --login --replace --accept-publication-terms`. This includes fresh thumbnails. Do not republish unchanged units, mission markers or deployment overlays. Confirm fresh live maps after catalogue refresh; a correct offline render is not proof of client behavior. Terrain GLBs use centimeter geometry and API scale 1/2.54.
