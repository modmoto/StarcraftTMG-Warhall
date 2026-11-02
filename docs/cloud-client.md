# Use the published cloud data

Normal play uses the HTTPS WDS manifest and Warhall's shared catalogue. Do not run the legacy `install-warhall-*-cache.mjs`, `install-warhall-data.mjs --local-source`, or texture-patching helpers for normal play. They create machine-local overrides and can hide shared updates.

To retire an old local preview, close Warhall Test and run:

```sh
node scripts/reset-warhall-cloud.mjs /path/to/WarhallTest --dry-run
node scripts/reset-warhall-cloud.mjs /path/to/WarhallTest --apply
```

The reset moves the patched catalogue, its version stamps, Starcraft WDS data, deployment templates, and downloaded model/texture caches into a timestamped `.cloud-reset-backups` folder inside the client data directory. It also disables this checkout's `.cache/warhall-preview`. It never restores old catalogue snapshots over current cloud data. Saved games, login settings, other WDS games and publication checkpoints are untouched. The client must be closed while applying; start it online afterward and let catalogue downloads finish before creating a fresh Starcraft room.

Ordinary downloaded caches will reappear: those are cloud copies, not local overrides. Repeatedly deleting them is unnecessary. Development source PDFs, review images and publication progress under the repository's ignored `.cache` remain available without influencing the game. The legacy installers remain available only for deliberate unpublished development tests.
