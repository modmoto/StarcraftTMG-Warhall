import test from 'node:test';
import assert from 'node:assert/strict';
import { publishCatalogue, transforms } from '../src/models/catalogue.mjs';

const image = 'data:image/png;base64,iVBORw0KGgo=';
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
function server() {
  const skins = new Set();
  let id = 200;
  const calls = [];
  let usage = [];
  let failAssignment = false;
  let failDeletion = false;
  const request = async (url, body) => {
    calls.push({ url, body });
    if (url === '/GetGamesWeb/')
      return { success: true, games: [{ GameName: 'Starcraft', IdGame: 16 }] };
    if (url === '/IsAdmin/16') return [{ IsAdmin: 1 }];
    if (url === '/GetMySkinUsages') return { error: 0, result: structuredClone(usage) };
    if (url.startsWith('/GetCatalogueSkins?'))
      return {
        error: 0,
        result: { skins: [...skins].map(id => ({ id, name: 'Marine' })), total: skins.size },
      };
    if (url.includes('create-and-link')) {
      skins.add(++id);
      return { error: 0, result: { skin_id: id } };
    }
    if (url === '/AssignCatalogueSkin') {
      if (failAssignment) throw new Error('assignment unavailable');
      usage = [
        ...usage.filter(item => item.profileId !== body.profileId || item.gameId !== body.gameId),
        { skinId: body.skinId, gameId: body.gameId, profileId: body.profileId, costumeDefault: 1 },
      ];
      return { error: 0 };
    }
    if (url === '/DeleteMySkin') {
      if (failDeletion) throw new Error('delete unavailable');
      skins.delete(body.skinId);
      return { error: 0 };
    }
    throw new Error(`Unexpected endpoint: ${url}`);
  };
  return {
    request,
    calls,
    skins,
    failAssignment: value => {
      failAssignment = value;
    },
    failDeletion: value => {
      failDeletion = value;
    },
    share: skinId => {
      usage.push({ skinId, gameId: 99, profileId: 'another-profile', costumeDefault: 1 });
    },
    removeAll: () => {
      skins.clear();
      usage = [];
    },
  };
}

const options = (mock, state, extra = {}) => ({
  request: mock.request,
  state,
  save: async () => {},
  getThumbnail: async () => image,
  ...extra,
});

test('manually deleted uploads are recreated despite an assigned checkpoint', async () => {
  const mock = server(),
    state = {};
  await publishCatalogue(catalogue, options(mock, state));
  const old = state.entries.marine.skinId;
  mock.removeAll();
  await publishCatalogue(catalogue, options(mock, state));
  assert.notEqual(state.entries.marine.skinId, old);
  assert.ok(state.entries.marine.assigned);
});

test('replacement creates and assigns the new snapshot before deleting the old owned skin', async () => {
  const mock = server(),
    state = {};
  await publishCatalogue(catalogue, options(mock, state));
  const old = state.entries.marine.skinId;
  mock.calls.length = 0;
  await publishCatalogue(catalogue, options(mock, state, { replace: true }));
  assert.equal(mock.calls.filter(call => call.url === '/DeleteMySkin')[0].body.skinId, old);
  const operations = mock.calls.filter(call => call.body).map(call => call.url);
  assert.deepEqual(operations, [
    '/api/tripo/create-and-link-skin',
    '/AssignCatalogueSkin',
    '/DeleteMySkin',
  ]);
  assert.equal(
    mock.calls.find(call => call.url.includes('create-and-link')).body.thumbnail_data_url,
    image,
  );
  assert.equal(mock.calls.find(call => call.url === '/AssignCatalogueSkin').body.mode, 'override');
  assert.ok(!mock.skins.has(old));
});

test('a failed assignment retains the old model and resumes without duplicate creation', async () => {
  const mock = server(),
    state = {};
  await publishCatalogue(catalogue, options(mock, state));
  const old = state.entries.marine.skinId;
  mock.failAssignment(true);
  await assert.rejects(
    publishCatalogue(catalogue, options(mock, state, { replace: true })),
    /assignment unavailable/,
  );
  assert.ok(mock.skins.has(old));
  const created = state.entries.marine.skinId;
  mock.failAssignment(false);
  await publishCatalogue(catalogue, options(mock, state, { replace: true }));
  assert.equal(state.entries.marine.skinId, created);
  assert.ok(!mock.skins.has(old));
});

test('cleanup failure resumes deletion without creating another replacement', async () => {
  const mock = server(),
    state = {};
  await publishCatalogue(catalogue, options(mock, state));
  mock.failDeletion(true);
  await assert.rejects(
    publishCatalogue(catalogue, options(mock, state, { replace: true })),
    /delete unavailable/,
  );
  const created = state.entries.marine.skinId;
  mock.failDeletion(false);
  await publishCatalogue(catalogue, options(mock, state, { replace: true }));
  assert.equal(state.entries.marine.skinId, created);
  assert.equal(mock.skins.size, 1);
});

test('a changed snapshot automatically replaces an existing owned upload', async () => {
  const mock = server(),
    state = {};
  await publishCatalogue(catalogue, options(mock, state));
  const old = state.entries.marine.skinId;
  await publishCatalogue(
    catalogue,
    options(mock, state, { getThumbnail: async () => 'data:image/png;base64,iVBORw0KGgoAAAAA' }),
  );
  assert.notEqual(state.entries.marine.skinId, old);
  assert.ok(!mock.skins.has(old));
});

test('replacement preserves an old owned skin referenced by another profile', async () => {
  const mock = server(),
    state = {};
  await publishCatalogue(catalogue, options(mock, state));
  const old = state.entries.marine.skinId;
  mock.share(old);
  await publishCatalogue(catalogue, options(mock, state, { replace: true }));
  assert.ok(mock.skins.has(old));
  assert.ok(!mock.calls.some(call => call.url === '/DeleteMySkin' && call.body.skinId === old));
});

test('native marker skins are never recreated or deleted in replacement mode', async () => {
  const mock = server(),
    state = {};
  await publishCatalogue(
    {
      ...catalogue,
      entries: [{ profileId: 'marker', name: 'Native marker', existingSkinId: 6201 }],
    },
    options(mock, state, { replace: true }),
  );
  assert.ok(
    !mock.calls.some(call => call.url.includes('create-and-link') || call.url === '/DeleteMySkin'),
  );
  assert.equal(state.entries.marker.skinId, 6201);
});

test('custom marker visuals can replace a native assignment without deleting native assets', async () => {
  const mock = server(),
    state = {};
  const request = async (url, body) => {
    if (url === '/GetMySkinUsages')
      return {
        error: 0,
        result: [{ skinId: 6201, gameId: 16, profileId: 'marine', costumeDefault: 1 }],
      };
    return mock.request(url, body);
  };
  await publishCatalogue(
    { ...catalogue, entries: [{ ...entry, replacesNativeSkinId: 6201 }] },
    options(mock, state, { request }),
  );
  assert.ok(state.entries.marine.assigned);
  assert.ok(!mock.calls.some(call => call.url === '/DeleteMySkin' && call.body.skinId === 6201));
  assert.equal(mock.calls.find(call => call.url === '/AssignCatalogueSkin').body.mode, 'override');
});
