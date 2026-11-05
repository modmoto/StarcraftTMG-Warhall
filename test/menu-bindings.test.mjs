import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { menuBindingPlan } from '../src/models/menu-bindings.mjs';

test('menu binding plan reuses canonical skins, resumes aliases, and rejects conflicts before writes', () => {
  const entries = [
    { kind: 'token', profileId: 'sc_token', name: 'Token skin' },
    { kind: 'unit', profileId: 'unit', name: 'Unit' },
  ];
  const usage = {
    profileId: 'sc_token',
    gameId: 16,
    skinId: 42,
    costumeDefault: 1,
    optionNames: [],
  };
  assert.deepEqual(menuBindingPlan(entries, [usage], 16), [
    { canonicalId: 'sc_token', menuId: 'Token skin', skinId: 42, assigned: false },
  ]);
  assert.equal(
    menuBindingPlan(entries, [usage, { ...usage, profileId: 'Token skin' }], 16)[0].assigned,
    true,
  );
  assert.throws(
    () => menuBindingPlan(entries, [usage, { ...usage, profileId: 'Token skin', skinId: 999 }], 16),
    /Conflicting/,
  );
  assert.throws(
    () => menuBindingPlan(entries, [usage, { ...usage, skinId: 999 }], 16),
    /one canonical/,
  );
});

test('menu migration preserves all map and scenario helper references without duplicate records', async () => {
  const json = async name =>
    JSON.parse(await readFile(new URL(`../Starcraft-test/${name}.json`, import.meta.url)));
  const terrains = await json('terrains');
  const ids = new Set(terrains.map(t => t.Id));
  assert.equal(ids.size, 33);
  assert.equal(terrains.filter(t => t.Id.startsWith('Starcraft - Terrain - ')).length, 33);
  assert.equal(terrains.filter(t => /Starcraft - Terrain - Deployment - /.test(t.Id)).length, 14);
  for (const map of await json('maps'))
    for (const item of map.Items) assert.ok(ids.has(item.Id), `${map.Id}/${item.Id}`);
  const tokens = await json('tokens');
  const tokenNames = new Set(tokens.map(t => t.Name));
  const config = await json('gameconfig');
  for (const deployment of config.DeploymentTerrains ?? [])
    for (const item of deployment.Items ?? [])
      assert.ok(item.IsToken ? tokenNames.has(item.Name) : ids.has(item.Name), item.Name);
  assert.equal(tokens.length, 24);
});
