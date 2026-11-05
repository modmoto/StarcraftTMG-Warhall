---
name: warhall-test-setup
description: Recreate the Starcraft-test game after a Warhall Test server reset, verify its manifest and administrator access, and restore shared skins and menus through the official API.
---

# Restore Warhall Test

Use this skill when the Test server has been reset or Starcraft-test is missing. Use the existing Starcraft-test folder on GitHub main. The Test game name is exactly Starcraft-test. Resolve its game ID from the server every time. The November 5 reset left a separate Starcraft game with no modmoto administrator rights; creating Starcraft-test restored administrator access for its creator.

## Commands

Run the read-only preflight first.

~~~sh
npm run test:setup -- --login
~~~

When recreation and skin publication are authorized, run:

~~~sh
npm run test:setup -- --apply --login --restore-skins --accept-publication-terms
~~~

Existing explicit acceptance of Warhall publication terms persists. When acceptance is absent, ask before publishing skins. Saved credentials belong to the Test server; never print passwords, cookies or tokens. See warhall-publish-skins for credential enrollment and publication details.

The script pins https://apptest.warhall.eu, checks the published manifest against the local Test manifest before creation, gets the next available game ID, and calls the official wizard endpoint /AddNewGame/. It creates a game using the existing manifest URL without uploading wizard starter files to GitHub. Do not run the wizard's GitHub upload step: it can overwrite the maintained package.

After creation it verifies the exact game, /IsAdmin/<id>, and the active LTS manifest path in /GetGameVersions. That endpoint uses a 1L4HR4W prefix followed by base64 JSON. Require the path to equal https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/refs/heads/main/Starcraft-test/manifest.json. The legacy UpdateGameDataPath endpoint has returned success without saving the change; stop and inspect any mismatch.

## Resume and checkpoints

.cache/test-environment.json records the verified game and a separate publication checkpoint for that restoration. Retain it and all old checkpoints. A server reset may reuse game IDs for different games; matching numeric IDs alone does not validate an old checkpoint.

The restoration publishes through the existing model publisher with the receipt's checkpoint, then verifies the menu bindings. Once complete it backs up the canonical Test checkpoint before copying in the new verified state so ordinary Test publication resumes correctly. Production checkpoints are separate.

If creation times out, do not blindly repeat the POST. The script records creating=true before creation and blocks another attempt while that outcome is uncertain. Inspect GetGamesWeb first. If the exact new game exists, the script can verify and resume. If it is absent, establish that the previous request failed before changing the receipt.

For partial skin publication, rerun the same command and checkpoint. Follow publisher uncertain-request handling. Avoid --replace for a whole restoration; create only missing skins and reconcile current assignments.

## Verification

Verify the manifest URL and admin rights through the API, validate Starcraft-test, and verify all shared defaults and menu aliases. Restart Warhall Test, choose Starcraft-test, and check a unit and a battlefield map. Distinguish API verification from visible client verification. A normal restored catalogue does not include experimental collider or flat-terrain prototypes; publish those separately if requested.
