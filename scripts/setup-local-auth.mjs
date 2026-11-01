import { spawn } from 'node:child_process';
import path from 'node:path';
import { projectRoot } from '../src/paths.mjs';
import { hasSavedPassword, defaultUsername } from '../src/models/keychain.mjs';
import { servers } from '../src/models/servers.mjs';

if (!process.stdin.isTTY) throw new Error('Run npm run auth:setup once in your own terminal.');
const username = defaultUsername();
async function run(script) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(projectRoot, 'scripts', script)], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    child.once('error', () => reject(new Error('Could not start authentication setup')));
    child.once('close', resolve);
  });
  if (code !== 0) throw new Error('Authentication setup was not completed');
}
if (!(await hasSavedPassword(servers.test, username))) await run('manage-model-credentials.mjs');
else console.log(`Warhall Test already has a Keychain credential for ${username}.`);
await run('setup-github-auth.mjs');
console.log('Setup complete. The assistant can now test Git push and Warhall upload access.');
