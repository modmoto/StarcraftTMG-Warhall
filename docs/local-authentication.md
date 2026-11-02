# Local authentication for publishing and Git

Warhall commands default to username `modmoto`. Use `--username NAME` on publishing, transform repair or credential setup, or set `WARHALL_USERNAME` to change it. Test and production credentials are separate Keychain entries.

## One-time setup on macOS or Windows

Run these in your own terminal from the repository:

```sh
npm run auth:setup
```

On macOS, setup invokes `security` with a hidden interactive password prompt and saves a Keychain generic-password item. On Windows, PowerShell prompts with `Read-Host -AsSecureString` and saves a DPAPI-encrypted value under `%LOCALAPPDATA%/WarhallPublisher/Credentials`. It can be decrypted only in the enrolled Windows user context on that machine. Test and production accounts have distinct entries. Passwords are not passed in command arguments or stored as plaintext in JSON, environment files, the repository or Git. Enrollment must be run in your own terminal.

Windows GitHub setup uses Git for Windows Credential Manager and its browser sign-in. An existing working Git credential helper need not be re-enrolled. The GitHub CLI setup below describes macOS.

It then prepares GitHub's official CLI, verifies its release checksum, and opens GitHub's browser/device authorization flow. Approve it yourself. The setup requires GitHub CLI to report OS Keychain storage before configuring this repository's credential helper. It resolves the actual signed-in GitHub username rather than assuming that it matches the Warhall username. The GitHub CLI's normal OS credential/configuration settings are used. Do not choose insecure token storage.

GitHub access and Warhall access are distinct. A browser session in Warhall does not authenticate the Node API, and a WebStorm login does not automatically authenticate Git outside WebStorm.

## Afterwards

The assistant can run `git push origin main` and the normal publisher/repair commands with `--login`. Git's helper obtains its GitHub credential internally. The uploader obtains the saved Warhall password through a private subprocess pipe, signs in, and uses an in-memory session cookie. Neither command prints the credentials. Passwords necessarily exist briefly in the processes performing authentication; this is not a claim that an assistant with arbitrary local execution can never inspect process memory or a trusted credential reader. The workflow is designed to avoid exposing secrets in tool output, logs or chat.

This implementation uses macOS Keychain's ordinary access policy. It does **not** promise a Touch ID prompt on each upload. A native Touch ID helper was investigated but could not reliably launch from the agent runner, so it is not part of the supported flow. Keychain may require macOS approval or unlocking. Do not weaken the Keychain's protections to avoid that prompt.

Enrollment and GitHub approval must be completed by the user. Never ask for a password or token in chat, and never run a command that prints the Keychain password or `gh auth token` output.

## Manage saved credentials

```sh
npm run models:credentials -- --status
npm run models:credentials -- --server prod
npm run models:credentials -- --forget
npm run models:publish -- --apply --login --manual-login
```

Status shows only the host, username and whether an entry exists. Re-run enrollment after a password change. `--forget` removes only the selected Warhall host/account entry. Cancelling or denying a saved-credential read fails the operation; it does not silently switch authentication methods. `--manual-login` explicitly bypasses saved credentials and prompts for a hidden password in an interactive terminal on either platform. The Windows reader returns decrypted bytes only through the publisher's private pipe; never run its `read` mode directly in a terminal or tool call.
