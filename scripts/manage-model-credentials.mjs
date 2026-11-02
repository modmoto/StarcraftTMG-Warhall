import { parseArgs } from 'node:util';
import { publicationTarget, servers } from '../src/models/servers.mjs';
import {
  defaultUsername,
  credentialIdentity,
  hasSavedPassword,
  savePassword,
  forgetPassword,
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
if (!['darwin', 'win32'].includes(process.platform))
  throw new Error(
    'This credential manager requires macOS or Windows. Other platforms can use manual login.',
  );
if (values.status) {
  console.log(
    JSON.stringify({ server, username, saved: await hasSavedPassword(server, username) }, null, 2),
  );
} else if (values.forget) {
  await forgetPassword(server, username);
  console.log(`Removed saved credential for ${username} on ${server}.`);
} else {
  if (!process.stdin.isTTY)
    throw new Error('Save credentials in your own terminal: npm run models:credentials');
  console.log(`Save the Warhall password for ${username} on ${server} in the OS credential store.`);
  console.log('The next OS prompt hides the password; it is not passed in command arguments.');
  await savePassword(server, username);
  console.log(
    'Saved. Future --login commands use the OS credential store without printing the password.',
  );
}
