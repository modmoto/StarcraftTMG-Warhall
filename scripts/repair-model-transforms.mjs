import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from '../src/paths.mjs';
import { publicationTarget } from '../src/models/servers.mjs';
import { promptLogin } from '../src/models/login.mjs';
import { repairSkinTransforms, wirePayload } from '../src/models/wire-transforms.mjs';

const { values } = parseArgs({
  options: {
    server: { type: 'string', default: 'test' },
    profile: { type: 'string' },
    login: { type: 'boolean', default: false },
    username: { type: 'string' },
    'manual-login': { type: 'boolean', default: false },
    apply: { type: 'boolean', default: false },
  },
});
const raw = JSON.parse(await readFile(path.join(projectRoot, 'model-catalogue.json'), 'utf8'));
const { catalogue } = publicationTarget(raw, values.server);
const entries = catalogue.entries.filter(
  entry => entry.parts?.length && (!values.profile || entry.profileId === values.profile),
);
if (!entries.length) throw new Error('No matching model profiles');
if (!values.apply) {
  console.log(
    JSON.stringify(
      {
        serverUrl: catalogue.serverUrl,
        dryRun: true,
        profiles: entries.map(entry => ({
          profileId: entry.profileId,
          parts: entry.parts.map(part => part.transforms),
        })),
      },
      null,
      2,
    ),
  );
} else {
  const cookie = values.login
    ? await promptLogin(catalogue.serverUrl, {
        username: values.username,
        manual: values['manual-login'],
      })
    : process.env.WARHALL_COOKIE;
  if (!cookie) throw new Error('Use --login or explicitly supply WARHALL_COOKIE');
  const request = async (endpoint, body) => {
    const response = await fetch(new URL(endpoint, catalogue.serverUrl), {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(wirePayload(endpoint, body)) : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
    const result = await response.json();
    if (result.error !== undefined && result.error !== 0)
      throw new Error(`${endpoint}: Warhall error ${result.error}`);
    return result;
  };
  const listing = await request('/GetGamesWeb/');
  const game = listing.games?.find(game => game.GameName === catalogue.gameName);
  if (!listing.success || !game) throw new Error('Target game not found');
  const admin = await request(`/IsAdmin/${game.IdGame}`);
  if (Number(admin?.[0]?.IsAdmin) !== 1) throw new Error('Game administrator access required');
  const usages = await request('/GetMySkinUsages');
  if (!Array.isArray(usages.result)) throw new Error('Invalid skin assignment response');
  for (const entry of entries) {
    const matches = [
      ...new Set(
        usages.result
          .filter(
            usage =>
              usage.profileId === entry.profileId &&
              Number(usage.gameId) === Number(game.IdGame) &&
              Number(usage.costumeDefault) === 1 &&
              !usage.optionNames?.length,
          )
          .map(usage => Number(usage.skinId)),
      ),
    ];
    if (matches.length !== 1)
      throw new Error(`${entry.name}: expected one shared skin, found ${matches.length}`);
    await repairSkinTransforms(entry, matches[0], request);
    console.log(`${entry.name}: skin ${matches[0]} transforms repaired and verified`);
  }
}
