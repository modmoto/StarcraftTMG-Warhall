import test from 'node:test';
import assert from 'node:assert/strict';
import {
  credentialIdentity,
  hasSavedPassword,
  readSavedPassword,
  savePassword,
  runPrivate,
} from '../src/models/keychain.mjs';

const testServer = 'https://apptest.warhall.eu';
test('Keychain identities default to modmoto and isolate test from production', () => {
  const identity = credentialIdentity(testServer, 'modmoto');
  assert.equal(identity.username, 'modmoto');
  assert.notEqual(
    identity.service,
    credentialIdentity('https://www.warhall.eu', 'modmoto').service,
  );
  assert.throws(() => credentialIdentity('https://example.com', 'modmoto'), /Unsupported/);
});
test('enrollment gives macOS an interactive password prompt without any password argument', async () => {
  let call;
  await savePassword(testServer, 'modmoto', {
    platform: 'darwin',
    runner: async (...args) => {
      call = args;
      return { code: 0, output: '' };
    },
  });
  assert.equal(call[0], '/usr/bin/security');
  assert.equal(call[1].at(-1), '-w');
  assert.ok(!call[1].includes('-A'));
  assert.deepEqual(call[2], { interactive: true });
  assert.equal(call[1][call[1].indexOf('-T') + 1], '/usr/bin/security');
});
test('saved credentials are read privately and preserve leading/trailing password spaces', async () => {
  const calls = [];
  const result = await readSavedPassword(testServer, 'modmoto', {
    platform: 'darwin',
    runner: async (file, args) => {
      calls.push(args);
      return { code: 0, output: args.includes('-w') ? ' fixture secret \n' : '' };
    },
  });
  assert.equal(result, ' fixture secret ');
  assert.equal(calls.length, 2);
  assert.ok(!calls[0].includes('-w'));
  assert.ok(calls[1].includes('-w'));
});
test('denied Keychain access does not leak captured output or fall back silently', async () => {
  await assert.rejects(
    readSavedPassword(testServer, 'modmoto', {
      platform: 'darwin',
      runner: async (_, args) => ({
        code: args.includes('-w') ? 1 : 0,
        output: 'sensitive diagnostic',
      }),
    }),
    error => {
      assert.match(error.message, /Keychain access was denied/);
      assert.ok(!error.message.includes('sensitive'));
      return true;
    },
  );
  assert.equal(
    await hasSavedPassword(testServer, 'modmoto', {
      platform: 'win32',
      runner: () => {
        throw new Error('must not launch');
      },
    }),
    false,
  );
});
test('the private process wrapper suppresses subprocess error details', async () => {
  await assert.rejects(runPrivate('/missing/fixture-program', []), {
    message: 'Could not start macOS Keychain access',
  });
});
