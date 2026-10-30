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

The script resolves the game ID by name, checks admin access, creates public skins from URLs and adds shared default assignments. Existing assignments are not overwritten. Server-generated skin IDs and progress are saved to ignored `.cache/model-publication.json`; retain that file between runs and across publisher machines. Completed entries are skipped, and failed assignments reuse their created skin.

If a create request times out or its outcome is uncertain, the script stops retries for that entry. Check the web catalogue before reconciling its saved state: set `skinId` to the created ID and remove `creating`, or remove the entry only after confirming no skin was created. A definition change also stops publication until its saved record has been reviewed. Do not delete the whole state file to retry: that can create duplicates. Avoid simultaneous publisher runs.

`--catalogue PATH` and `--state PATH` select alternate files. The state is scoped to the server and game; production needs its own verified catalogue and state.

## Current limits

The API adapter follows the test site's current frontend and has automated mock tests, but has not been published through an authenticated account. Shared defaults and multipart transforms still need a live client check. Some selected URLs contain Unity asset bundles; those must be converted to a portable format before Mac compatibility can be promised. Texture colours patched only in a Windows cache are also not reproduced by registration alone.

This publisher registers models and terrain appearances. It does not publish custom deployment templates, change gameplay JSON, upload binary assets, or replace the remaining portability work. After publishing, refresh the shared catalogue in Warhall Test and check units and terrain on both platforms.
