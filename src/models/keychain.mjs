import { spawn } from 'node:child_process';
import { servers } from './servers.mjs';

export const defaultUsername = () => process.env.WARHALL_USERNAME?.trim() || 'modmoto';

export function credentialIdentity(serverUrl, username = defaultUsername()) {
  const server = new URL(serverUrl).origin;
  if (!Object.values(servers).includes(server)) throw new Error('Unsupported credential server');
  if (!username.trim() || /[\r\n\0]/.test(username)) throw new Error('Invalid credential username');
  return { server, username: username.trim(), service: `eu.warhall.publisher:${server}` };
}

export function runPrivate(file, args, { interactive = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      stdio: interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
    const chunks = [];
    if (!interactive) {
      child.stdout.on('data', chunk => chunks.push(chunk));
      child.stderr.resume();
    }
    child.once('error', () => reject(new Error('Could not start macOS Keychain access')));
    child.once('close', code => resolve({ code, output: Buffer.concat(chunks).toString('utf8') }));
  });
}

export async function hasSavedPassword(
  serverUrl,
  username,
  { runner = runPrivate, platform = process.platform } = {},
) {
  const identity = credentialIdentity(serverUrl, username);
  if (platform !== 'darwin') return false;
  const result = await runner('/usr/bin/security', [
    'find-generic-password',
    '-s',
    identity.service,
    '-a',
    identity.username,
  ]);
  return result.code === 0;
}

export async function readSavedPassword(
  serverUrl,
  username,
  { runner = runPrivate, platform = process.platform } = {},
) {
  const identity = credentialIdentity(serverUrl, username);
  if (!(await hasSavedPassword(identity.server, identity.username, { runner, platform })))
    return null;
  const result = await runner('/usr/bin/security', [
    'find-generic-password',
    '-s',
    identity.service,
    '-a',
    identity.username,
    '-w',
  ]);
  if (result.code !== 0)
    throw new Error(
      'Keychain access was denied. Unlock your keychain or use --login --manual-login in your terminal.',
    );
  const password = result.output.replace(/\r?\n$/, '');
  if (!password)
    throw new Error('The saved password is empty. Run npm run models:credentials to update it.');
  return password;
}

export async function savePassword(
  serverUrl,
  username,
  { runner = runPrivate, platform = process.platform } = {},
) {
  if (platform !== 'darwin') throw new Error('Saved credentials require macOS Keychain');
  const identity = credentialIdentity(serverUrl, username);
  const result = await runner(
    '/usr/bin/security',
    [
      'add-generic-password',
      '-U',
      '-s',
      identity.service,
      '-a',
      identity.username,
      '-l',
      `Warhall ${new URL(identity.server).hostname} — ${identity.username}`,
      '-T',
      '/usr/bin/security',
      '-w',
    ],
    { interactive: true },
  );
  if (result.code !== 0) throw new Error('The password was not saved to Keychain');
}
