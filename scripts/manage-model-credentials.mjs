import { parseArgs } from 'node:util';
import { publicationTarget, servers } from '../src/models/servers.mjs';
import {
  defaultUsername,
  credentialIdentity,
  hasSavedPassword,
  savePassword,
  runPrivate,
} from '../src/models/keychain.mjs';

const { values } = parseArgs({
  options: {
    server: { type: 'string', default: 'test' },
    username: { type: 'string' },
    status: { type: 'boolean', default: false },
    forget: { type: 'boolean', default: false },
  },
});
const server = publicationTarget({ serverUrl: servers.test, entries: [] }, values.server).catalogue
  .serverUrl;
const username = values.username ?? defaultUsername();
const identity = credentialIdentity(server, username);
if (process.platform !== 'darwin')
  throw new Error(
    'This credential manager requires macOS. Other platforms can use --login with a hidden password.',
  );
if (values.status) {
  console.log(
    JSON.stringify({ server, username, saved: await hasSavedPassword(server, username) }, null, 2),
  );
} else if (values.forget) {
  const result = await runPrivate('/usr/bin/security', [
    'delete-generic-password',
    '-s',
    identity.service,
    '-a',
    identity.username,
  ]);
  if (result.code !== 0 && (await hasSavedPassword(server, username)))
    throw new Error('Could not remove the saved credential');
  console.log(`Removed saved credential for ${username} on ${server}.`);
} else {
  if (!process.stdin.isTTY)
    throw new Error('Save credentials in your own terminal: npm run models:credentials');
  console.log(`Save the Warhall password for ${username} on ${server} in macOS Keychain.`);
  console.log(
    'The next prompt is from macOS security; the password is hidden and is not passed in command arguments.',
  );
  await savePassword(server, username);
  console.log('Saved. Future --login commands use Keychain without printing the password.');
}
