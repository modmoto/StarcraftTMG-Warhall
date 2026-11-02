# Test and live data

Use main for all work. There are no GitHub Actions, GitHub releases or branch promotions.

- `Starcraft-test/` is the working copy. Importers, card/terrain/token generators and local checks use this folder.
- `Starcraft/` is the live snapshot. Normal builds leave it unchanged.
- Root model inputs, `model-catalogue.json` and hash-named `model-assets/` are shared. Existing assets remain available when new ones are added.

Both Warhall games are named Starcraft. Their manifest settings should be:

- Test: https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/main/Starcraft-test/manifest.json
- Production: https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/main/Starcraft/manifest.json

The old UpdateGameDataPath API returned success without changing the stored URL. Verify the actual project setting; creating a folder does not change the server setting automatically.

## Work and playtest

Run the normal import/build commands, `npm run check:local`, then commit/push main. Publish changed models to Test with the existing model publisher and synchronize menu aliases. This does not update the live folder.

## Publish live

Tell the assistant to publish the tested copy. The warhall-wave-release skill runs:

```sh
npm run check:local
npm run data:publish
node scripts/validate.mjs Starcraft
# Review, commit and push main before uploads.
npm run models:publish -- --server prod --apply --login --accept-publication-terms
npm run models:menus -- --server prod --apply --login
```

The copy includes every data file and asset, removes obsolete live files, changes owned card/icon/manifest URLs to the live folder, and increments the live data version above both copies. It validates before replacing the live snapshot. Starcraft-test is left unchanged.

The publisher uploads missing or changed skins and thumbnails and reuses verified existing defaults. Keep publication checkpoints. Use the separately enrolled production login and administrator access; see [authentication](local-authentication.md) and [model publication](model-publication.md). No Dropbox upload is involved.
