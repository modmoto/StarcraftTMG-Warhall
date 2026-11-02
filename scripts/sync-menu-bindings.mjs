import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { promptLogin } from '../src/models/login.mjs';
import { publicationTarget } from '../src/models/servers.mjs';
import { defaultMenuSkins, menuBindingPlan } from '../src/models/menu-bindings.mjs';

// Reproduce the editor's assignment step without rewriting or uploading any meshes.
const { values } = parseArgs({
  options: {
    apply: { type: 'boolean' },
    login: { type: 'boolean' },
    server: { type: 'string', default: 'test' },
  },
});
const { catalogue } = publicationTarget(
  JSON.parse(await readFile(new URL('../model-catalogue.json', import.meta.url))),
  values.server,
);
const entries = catalogue.entries.filter(entry => ['token', 'terrain'].includes(entry.kind));
const cookie = values.login ? await promptLogin(catalogue.serverUrl) : process.env.WARHALL_COOKIE;
assert.ok(cookie, 'Use --login or an explicitly supplied WARHALL_COOKIE');
const request = async (endpoint, body) => {
  const response = await fetch(new URL(endpoint, catalogue.serverUrl), {
    method: body ? 'POST' : 'GET',
    headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',
    signal: AbortSignal.timeout(60000),
  });
  assert.ok(response.ok, `Warhall request failed: ${endpoint} (${response.status})`);
  const result = await response.json();
  assert.ok(result.error === undefined || result.error === 0, `Warhall rejected ${endpoint}`);
  return result;
};
const listing = await request('/GetGamesWeb/');
const game = listing.games?.find(g => g.GameName === catalogue.gameName);
assert.ok(listing.success && game, 'Exact-case game missing');
assert.equal(
  Number((await request(`/IsAdmin/${game.IdGame}`))?.[0]?.IsAdmin),
  1,
  'Administrator required',
);
let usages = (await request('/GetMySkinUsages')).result;
assert.ok(Array.isArray(usages), 'Invalid shared assignment response');
const defaults = id => defaultMenuSkins(usages, game.IdGame, id);
const plan = menuBindingPlan(entries, usages, game.IdGame);
let assigned = 0;
for (const item of plan) {
  if (item.assigned || !values.apply) continue;
  await request('/AssignCatalogueSkin', {
    skinId: item.skinId,
    profileId: item.menuId,
    selectedOptions: [],
    gameId: game.IdGame,
    costumeDefault: 1,
    mode: 'override',
  });
  assigned++;
}
if (values.apply) {
  usages = (await request('/GetMySkinUsages')).result;
  for (const item of plan)
    assert.deepEqual(
      defaults(item.menuId),
      [item.skinId],
      `Menu assignment readback failed: ${item.menuId}`,
    );
  for (const item of plan)
    assert.deepEqual(
      defaults(item.canonicalId),
      [item.skinId],
      `Canonical assignment changed: ${item.canonicalId}`,
    );
}
console.log(
  JSON.stringify(
    {
      server: catalogue.serverUrl,
      apply: !!values.apply,
      selected: plan.length,
      assigned,
      alreadyAssigned: plan.filter(p => p.assigned).length,
      verified: values.apply ? plan.length : 0,
    },
    null,
    2,
  ),
);
