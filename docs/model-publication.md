# Shared model publication

`model-catalogue.json` is the publisher input. The WDS manifest does not register shared skins. Maintain source selections and overrides, then rebuild the catalogue with `npm run models:catalogue`. Preserve reviewed transforms and the token bundle overrides; preview GLBs must not replace tested Unity bundles.

## Targets and authentication

Test is https://apptest.warhall.eu; production is https://www.warhall.eu. Both registered games are exactly `Starcraft`. Resolve game IDs from GetGamesWeb and verify administrator access. Native/server-local skin IDs and publication checkpoints are not interchangeable between servers.

Use the saved OS credential with `--login`; see [local authentication](local-authentication.md). Do not print passwords, cookies or identity tokens. Existing acceptance of publication terms persists. If an interactive login challenge appears, complete it through the ordinary login flow.

## Publish and verify

Push all referenced immutable assets to main before registration. Preview or apply the selected catalogue:

```sh
npm run models:publish -- --server test
npm run models:publish -- --server test --apply --login --accept-publication-terms
npm run models:menus -- --server test --apply --login
```

Use `--kind unit|terrain|marker|deployment|token` or `--catalogue PATH` to limit work. Use `--state PATH` for an existing checkpoint scoped to the actual target game. Never clear checkpoints or use `--replace` merely to retry an uncertain request. A changed definition or thumbnail already triggers reconciliation. If a create outcome is uncertain, inspect the catalogue before retrying.

The maintained adapter uses the website's observed endpoints:

- Create-and-link skin (single or multipart), with a real generated or reviewed thumbnail.
- AssignCatalogueSkin for canonical defaults and exact-name menu aliases.
- GetMySkinUsages and SelectSkinParts for readback.
- UpdateSkinLayerTransforms for verified transform repairs.

For replacements, assign the new skin and its menu alias before deleting an obsolete owned skin. Retain skins referenced by another game. Do not delete native or other users' skins. Raw metadata fingerprints are not proof of equal geometry: compare model resources and transforms when reconciling manually.

Retired current-game bindings can be removed through RemoveSkinUsage using itemInstanceId, skinId and costumeDefault, followed by readback. DeleteMySkin is only for an owned obsolete skin after its remaining assignments have been checked.

After publication, verify defaults, aliases, model resources and thumbnail URLs. Actual rendering, native interactions and multiplayer behavior require a client check. A WDS version bump is needed for changed game data, not a shared-skin-only correction.

## Local data to retain

Keep the ignored Test and production publication receipts, current game scope and successful progress. Test's default checkpoint is `.cache/model-publication.json`; production uses `.cache/model-publication-prod.json`. Do not reuse a checkpoint from a retired game. Thumbnails and render fingerprints are in `.cache/model-thumbnails/`; manual thumbnails without render metadata are intentionally preserved.

Model/image URLs are HTTPS. Model assets remain hash-named under main so existing live and release references remain valid. See [releases](releases.md) before promoting production.
