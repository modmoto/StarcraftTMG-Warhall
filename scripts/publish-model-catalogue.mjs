import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { loadThumbnail } from '../src/models/thumbnails.mjs';
import { publicationTarget } from '../src/models/servers.mjs';
import { promptLogin } from '../src/models/login.mjs';
import { projectRoot } from '../src/paths.mjs';
import { publishCatalogue, skinRequest, validateCatalogue } from '../src/models/catalogue.mjs';

const { values } = parseArgs({
  options: {
    apply: { type: 'boolean', default: false },
    replace: { type: 'boolean', default: false },
    login: { type: 'boolean', default: false },
    'default-scale': { type: 'boolean', default: false },
    catalogue: { type: 'string', default: 'model-catalogue.json' },
    state: { type: 'string' },
    server: { type: 'string', default: 'test' },
    'thumbnails-dir': { type: 'string', default: '.cache/model-thumbnails' },
    'accept-publication-terms': { type: 'boolean', default: false },
  },
});
const target = publicationTarget(
  JSON.parse(await readFile(path.resolve(projectRoot, values.catalogue), 'utf8')),
  values.server,
);
const catalogue = validateCatalogue(target.catalogue);
if (target.excluded.length)
  console.error(
    `Skipped ${target.excluded.length} native skin references without verified IDs on this server`,
  );
const filename = path.resolve(projectRoot, values.state ?? target.stateFile);
let state = {};
try {
  state = JSON.parse(await readFile(filename, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const thumbnailDirectory = path.resolve(projectRoot, values['thumbnails-dir']);
const thumbnails = new Map();
const missingThumbnails = [];
for (const entry of catalogue.entries) {
  if (!entry.parts?.length) continue;
  try {
    thumbnails.set(
      entry.profileId,
      await loadThumbnail(entry, {
        directory: thumbnailDirectory,
        root: projectRoot,
      }),
    );
  } catch (error) {
    missingThumbnails.push({ profileId: entry.profileId, message: error.message });
  }
}
if (values.apply && missingThumbnails.length) {
  throw new Error(
    `Prepare thumbnails before publication:\n${missingThumbnails.map(item => item.message).join('\n')}`,
  );
}
if (!values.apply) {
  console.log(
    JSON.stringify(
      {
        serverUrl: catalogue.serverUrl,
        gameName: catalogue.gameName,
        dryRun: true,
        replace: values.replace,
        serverReconciliationRequired: true,
        missingThumbnails,
        entries: catalogue.entries.map(entry => ({
          profileId: entry.profileId,
          existingSkinId: entry.existingSkinId,
          create:
            !entry.parts?.length ||
            (!values.replace && (entry.existingSkinId || state.entries?.[entry.profileId]?.skinId))
              ? undefined
              : thumbnails.has(entry.profileId)
                ? skinRequest(entry, {
                    defaultScale: values['default-scale'],
                    thumbnailDataUrl: thumbnails.get(entry.profileId),
                  })
                : { blocked: 'missing thumbnail' },
          assignment: { costumeDefault: 1, mode: values.replace ? 'override' : 'add' },
        })),
      },
      null,
      2,
    ),
  );
} else {
  if (!values['accept-publication-terms']) {
    throw new Error(
      'Review Warhall’s public-skin rights, hosting licence and takedown terms in Model Creator, then pass --accept-publication-terms if you can accept them.',
    );
  }
  const cookie = values.login ? await promptLogin(catalogue.serverUrl) : process.env.WARHALL_COOKIE;
  if (!cookie)
    throw new Error(
      'Set WARHALL_COOKIE to your own authenticated Warhall session cookie header. It is never saved or logged.',
    );
  const request = async (endpoint, body) => {
    const response = await fetch(new URL(endpoint, catalogue.serverUrl), {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
    const result = await response.json();
    if (
      (!Array.isArray(result) && result.error !== undefined && result.error !== 0) ||
      result.success === false
    ) {
      throw new Error(
        `${endpoint}: Warhall error ${result.error}. Publication stopped; check the website before retrying.`,
      );
    }
    return result;
  };
  await publishCatalogue(catalogue, {
    request,
    state,
    save: async value => {
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(`${filename}.tmp`, JSON.stringify(value, null, 2) + '\n');
      await rename(`${filename}.tmp`, filename);
    },
    log: console.log,
    defaultScale: values['default-scale'],
    getThumbnail: entry => thumbnails.get(entry.profileId),
    replace: values.replace,
  });
  console.log('Shared mappings published. Refresh the catalogue in Warhall Test.');
}
