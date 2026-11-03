import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  publishCatalogue,
  skinRequest,
  transforms,
  validateCatalogue,
} from '../src/models/catalogue.mjs';

const thumbnailDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const getThumbnail = async () => thumbnailDataUrl;

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
  if (endpoint.startsWith('/GetCatalogueSkins?'))
    return {
      error: 0,
      result: {
        skins: [
          { id: 123, name: 'Marine' },
          { id: 12999, name: 'Marine' },
        ],
        total: 2,
      },
    };
  if (endpoint === '/GetGamesWeb/')
    return { success: true, games: [{ GameName: 'Starcraft', IdGame: 16 }] };
  if (endpoint === '/IsAdmin/16') return [{ IsAdmin: 1 }];
  if (endpoint === '/GetMySkinUsages') return { error: 0, result: [] };
  if (endpoint === '/AssignCatalogueSkin') return { error: 0 };
  return { error: 0, result: { skin_id: 123 } };
};

test('catalogue covers all selected units, terrain and existing markers', async () => {
  const actual = validateCatalogue(
    JSON.parse(await readFile(new URL('../model-catalogue.json', import.meta.url))),
  );
  assert.equal(actual.entries.filter(e => e.kind === 'unit').length, 45);
  assert.equal(actual.entries.filter(e => e.kind === 'marker').length, 5);
  assert.equal(actual.entries.filter(e => e.kind === 'deployment').length, 7);
  assert.equal(actual.entries.filter(e => e.kind === 'token').length, 17);
  assert.equal(actual.entries.filter(e => e.kind === 'terrain' && e.parts).length, 13);
  assert.equal(actual.entries.filter(e => e.kind === 'marker' && e.replacesNativeSkinId).length, 3);
});

test('rejects local URLs and invalid transforms', () => {
  const bad = structuredClone(catalogue);
  bad.entries[0].parts[0].modelUrl = 'file:///C:/marine.obj';
  assert.throws(() => validateCatalogue(bad), /HTTPS/);
  assert.throws(() => transforms({ size: -1 }), /positive/);
});

test('a fresh publishing machine reconciles the owned shared default before replacement', async () => {
  const calls = [];
  const state = {};
  await publishCatalogue(catalogue, {
    state,
    save: async () => {},
    getThumbnail,
    replace: true,
    request: async (endpoint, body) => {
      calls.push({ endpoint, body });
      if (endpoint === '/GetMySkinUsages')
        return {
          error: 0,
          result: [
            { skinId: 12999, profileId: 'marine', gameId: 16, costumeDefault: 1, optionNames: [] },
          ],
        };
      return respond(endpoint);
    },
  });
  assert.equal(calls.find(c => c.endpoint === '/AssignCatalogueSkin').body.mode, 'override');
  assert.equal(calls.find(c => c.endpoint === '/DeleteMySkin').body.skinId, 12999);
  assert.equal(state.entries.marine.skinId, 123);
});

test('multipart payload retains independent attachment transforms', () => {
  const extra = { ...entry.parts[0], transforms: transforms({ size: 2, position: [1, 2, 3] }) };
  const request = skinRequest({ ...entry, parts: [...entry.parts, extra] }, { thumbnailDataUrl });
  assert.match(request.path, /multipart$/);
  assert.equal(request.body.parts[1].transforms.positionY, 2);
  assert.equal(request.body.parts[0].transforms.scale, 1);
  assert.equal(request.body.thumbnail_data_url, thumbnailDataUrl);
});

test('token replacement updates its editor alias before retiring the old skin', async () => {
  const calls = [];
  await publishCatalogue(
    { ...catalogue, entries: [{ ...entry, kind: 'token' }] },
    {
      state: {},
      save: async () => {},
      getThumbnail,
      replace: true,
      request: async (endpoint, body) => {
        calls.push({ endpoint, body });
        if (endpoint === '/GetMySkinUsages')
          return {
            error: 0,
            result: ['marine', 'Marine'].map(profileId => ({
              skinId: 12999,
              profileId,
              gameId: 16,
              costumeDefault: 1,
              optionNames: [],
            })),
          };
        return respond(endpoint);
      },
    },
  );
  const alias = calls.findIndex(
    c => c.endpoint === '/AssignCatalogueSkin' && c.body.profileId === 'Marine',
  );
  const deletion = calls.findIndex(c => c.endpoint === '/DeleteMySkin');
  assert.ok(alias >= 0 && deletion > alias);
  assert.equal(calls[alias].body.skinId, 123);
  assert.equal(calls[deletion].body.skinId, 12999);
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
  const options = { request, state, save: async () => {}, getThumbnail };
  await assert.rejects(publishCatalogue(catalogue, options), /offline/);
  assert.equal(state.entries.marine.skinId, 123);
  assert.equal(
    calls.find(call => call.endpoint.includes('create-and-link')).body.thumbnail_data_url,
    thumbnailDataUrl,
  );
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
    publishCatalogue(catalogue, { request, state, save: async () => {}, getThumbnail }),
    /timeout/,
  );
  await assert.rejects(
    publishCatalogue(catalogue, { request, state, save: async () => {}, getThumbnail }),
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

test('reconciles an existing Marine assignment instead of posting a duplicate', async () => {
  const state = {};
  const request = async endpoint => {
    if (endpoint === '/GetMySkinUsages')
      return {
        error: 0,
        result: [{ skinId: 12999, profileId: 'marine', gameId: 16, costumeDefault: 1 }],
      };
    if (endpoint === '/AssignCatalogueSkin')
      throw new Error('Duplicate assignment must not be posted');
    return respond(endpoint);
  };
  await publishCatalogue(
    { ...catalogue, entries: [{ ...entry, existingSkinId: 12999 }] },
    { request, state, save: async () => {}, getThumbnail },
  );
  assert.equal(state.entries.marine.assigned, true);
});
