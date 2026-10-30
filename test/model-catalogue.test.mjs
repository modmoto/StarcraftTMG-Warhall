import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  publishCatalogue,
  skinRequest,
  transforms,
  validateCatalogue,
} from '../src/models/catalogue.mjs';

const entry = {
  profileId: 'marine',
  name: 'Marine',
  parts: [{ modelUrl: 'https://example.com/marine.obj', transforms: transforms() }],
};
const catalogue = {
  schemaVersion: 1,
  serverUrl: 'https://apptest.warhall.eu',
  gameName: 'Starcraft',
  entries: [entry],
};
const respond = async endpoint => {
  if (endpoint === '/GetGamesWeb/')
    return { success: true, games: [{ GameName: 'Starcraft', IdGame: 16 }] };
  if (endpoint === '/IsAdmin/16') return [{ IsAdmin: 1 }];
  if (endpoint === '/AssignCatalogueSkin') return { error: 0 };
  return { error: 0, result: { skin_id: 123 } };
};

test('catalogue covers all selected units, terrain and existing markers', async () => {
  const actual = validateCatalogue(
    JSON.parse(await readFile(new URL('../model-catalogue.json', import.meta.url))),
  );
  assert.equal(actual.entries.filter(e => e.kind === 'unit').length, 45);
  assert.equal(actual.entries.filter(e => e.kind === 'terrain' && e.parts).length, 17);
  assert.equal(actual.entries.filter(e => e.existingSkinId).length, 3);
});

test('rejects local URLs and invalid transforms', () => {
  const bad = structuredClone(catalogue);
  bad.entries[0].parts[0].modelUrl = 'file:///C:/marine.obj';
  assert.throws(() => validateCatalogue(bad), /HTTPS/);
  assert.throws(() => transforms({ size: -1 }), /positive/);
});

test('multipart payload retains independent attachment transforms', () => {
  const extra = { ...entry.parts[0], transforms: transforms({ size: 2, position: [1, 2, 3] }) };
  const request = skinRequest({ ...entry, parts: [...entry.parts, extra] });
  assert.match(request.path, /multipart$/);
  assert.equal(request.body.parts[1].transforms.positionY, 2);
  assert.equal(request.body.parts[0].transforms.scale, 1);
});

test('resumes a failed assignment without recreating the skin', async () => {
  const state = {};
  const calls = [];
  let fail = true;
  const request = async (endpoint, body) => {
    calls.push({ endpoint, body });
    if (endpoint === '/AssignCatalogueSkin' && fail) throw new Error('offline');
    return respond(endpoint);
  };
  const options = { request, state, save: async () => {} };
  await assert.rejects(publishCatalogue(catalogue, options), /offline/);
  assert.equal(state.entries.marine.skinId, 123);
  fail = false;
  await publishCatalogue(catalogue, options);
  await publishCatalogue(catalogue, options);
  assert.equal(calls.filter(c => c.endpoint.includes('create-and-link')).length, 1);
  assert.equal(
    calls.filter(c => c.endpoint === '/AssignCatalogueSkin').at(-1).body.costumeDefault,
    1,
  );
});

test('uncertain creation stops retries and non-admins cannot publish', async () => {
  const state = {};
  const request = async endpoint => {
    if (endpoint.includes('create-and-link')) throw new Error('timeout');
    return respond(endpoint);
  };
  await assert.rejects(
    publishCatalogue(catalogue, { request, state, save: async () => {} }),
    /timeout/,
  );
  await assert.rejects(
    publishCatalogue(catalogue, { request, state, save: async () => {} }),
    /outcome unknown/,
  );
  await assert.rejects(
    publishCatalogue(catalogue, {
      state: {},
      save: async () => {},
      request: endpoint => (endpoint.includes('IsAdmin') ? [{ IsAdmin: 0 }] : respond(endpoint)),
    }),
    /administrator/,
  );
});
