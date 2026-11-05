import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectRoot } from '../src/paths.mjs';
import { promptLogin } from '../src/models/login.mjs';

const { values } = parseArgs({
  options: {
    apply: { type: 'boolean', default: false },
    login: { type: 'boolean', default: false },
    'restore-skins': { type: 'boolean', default: false },
    'accept-publication-terms': { type: 'boolean', default: false },
  },
});
if (values['restore-skins']) {
  assert.ok(values.apply, '--restore-skins requires --apply');
  assert.ok(values['accept-publication-terms'], 'Accept publication terms before restoring skins');
}
const server = 'https://apptest.warhall.eu';
const gameName = 'Starcraft-test';
const dataPath =
  'https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/refs/heads/main/Starcraft-test/manifest.json';
const receiptFile = path.join(projectRoot, '.cache', 'test-environment.json');
const cookie = values.login ? await promptLogin(server) : process.env.WARHALL_COOKIE;
assert.ok(cookie, 'Use --login or explicitly supply WARHALL_COOKIE');

async function request(endpoint, body) {
  const response = await fetch(server + endpoint, {
    method: body ? 'POST' : 'GET',
    headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',
    signal: AbortSignal.timeout(60000),
  });
  assert.ok(response.ok, endpoint + ': HTTP ' + response.status);
  const text = await response.text();
  const result = JSON.parse(
    text.startsWith('1L4HR4W') ? Buffer.from(text.slice(7), 'base64').toString('utf8') : text,
  );
  assert.ok(
    result.success !== false && (result.error === undefined || result.error === 0),
    endpoint + ': request rejected',
  );
  return result;
}
async function findGame() {
  const listing = await request('/GetGamesWeb/');
  assert.ok(listing.success && Array.isArray(listing.games), 'Invalid game list');
  const matches = listing.games.filter(game => game.GameName === gameName);
  assert.ok(matches.length <= 1, 'Duplicate Test registrations. Reconcile before continuing.');
  return matches[0];
}
let game = await findGame();
if (!game) {
  const local = JSON.parse(
    await readFile(path.join(projectRoot, 'Starcraft-test', 'manifest.json'), 'utf8'),
  );
  const response = await fetch(dataPath, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  assert.ok(response.ok, 'Test manifest is not published');
  const remote = await response.json();
  assert.equal(remote.version, local.version, 'Publish Test data before registration');
  assert.deepEqual(remote.files, local.files, 'Remote Test manifest differs');
  const next = await request('/NextGameId/');
  assert.ok(next.success && Number.isSafeInteger(next.nextId), 'Invalid next game ID');
  if (!values.apply) {
    console.log(
      JSON.stringify(
        { server, gameName, dataPath, nextGameId: next.nextId, action: 'create', dryRun: true },
        null,
        2,
      ),
    );
    process.exit(0);
  }
  let receipt;
  try {
    receipt = JSON.parse(await readFile(receiptFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  assert.ok(
    !receipt?.creating,
    'An earlier creation outcome is uncertain. Inspect the server before retrying.',
  );
  await mkdir(path.dirname(receiptFile), { recursive: true });
  await writeFile(
    receiptFile,
    JSON.stringify(
      { server, gameName, dataPath, creating: true, requestedId: next.nextId },
      null,
      2,
    ) + '\n',
  );
  // This is the official wizard request, without its separate starter-file GitHub upload.
  await request('/AddNewGame/', {
    idGame: next.nextId,
    gameName,
    gameAvailability: 1,
    gameVersionLTS: 1,
    dataPath,
  });
  game = await findGame();
  assert.ok(game, 'Creation returned success but Test game is absent. Inspect before retrying.');
}
const admin = await request('/IsAdmin/' + game.IdGame);
assert.equal(Number(admin?.[0]?.IsAdmin), 1, 'Current account is not a Test game administrator');
const versions = await request('/GetGameVersions');
assert.ok(Array.isArray(versions), 'Invalid game version list');
const active = versions.filter(
  version =>
    Number(version.GameVersionIdGame) === Number(game.IdGame) &&
    Number(version.GameVersionStatus) === 1 &&
    Number(version.GameVersionLTS) === 1,
);
assert.equal(active.length, 1, 'Expected one active Test data path');
assert.equal(
  active[0].GameVersionDataPath,
  dataPath,
  'Stored Test manifest path differs. Inspect project settings before changing it.',
);
let previous;
try {
  previous = JSON.parse(await readFile(receiptFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const publicationState =
  previous?.gameId === game.IdGame && previous.publicationState
    ? previous.publicationState
    : path.join(projectRoot, '.cache', `model-publication-starcraft-test-reset-${Date.now()}.json`);
const result = {
  server,
  gameName,
  gameId: game.IdGame,
  dataPath,
  publicationState,
  administrator: true,
  verified: true,
};
if (values.apply) await writeFile(receiptFile, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));

if (values['restore-skins']) {
  assert.ok(values.apply, '--restore-skins requires --apply');
  assert.ok(
    values['accept-publication-terms'],
    'Publication terms must be accepted before restoring skins',
  );
  const auth = values.login ? ['--login'] : [];
  for (const args of [
    [
      'scripts/publish-model-catalogue.mjs',
      '--server',
      'test',
      '--state',
      publicationState,
      '--apply',
      ...auth,
      '--accept-publication-terms',
    ],
    ['scripts/sync-menu-bindings.mjs', '--server', 'test', '--apply', ...auth],
  ]) {
    const run = spawnSync(process.execPath, args, { cwd: projectRoot, stdio: 'inherit' });
    if (run.error) throw run.error;
    assert.equal(run.status, 0, 'Test restoration stopped. Retain the checkpoint and resume.');
  }
  const canonical = path.join(projectRoot, '.cache', 'model-publication-starcraft-test.json');
  try {
    await copyFile(canonical, canonical + '.before-reset-' + Date.now());
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await copyFile(publicationState, canonical);
  result.skinsRestored = true;
  await writeFile(receiptFile, JSON.stringify(result, null, 2) + '\n');
  console.log('Test skins and menus restored. Previous checkpoints were preserved.');
}
