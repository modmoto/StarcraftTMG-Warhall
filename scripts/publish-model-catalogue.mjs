import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from '../src/paths.mjs';
import { publishCatalogue, skinRequest, validateCatalogue } from '../src/models/catalogue.mjs';

const { values } = parseArgs({
  options: {
    apply: { type: 'boolean', default: false },
    catalogue: { type: 'string', default: 'model-catalogue.json' },
    state: { type: 'string', default: '.cache/model-publication.json' },
    'accept-publication-terms': { type: 'boolean', default: false },
  },
});
const catalogue = validateCatalogue(
  JSON.parse(await readFile(path.resolve(projectRoot, values.catalogue), 'utf8')),
);
if (!values.apply) {
  console.log(
    JSON.stringify(
      {
        serverUrl: catalogue.serverUrl,
        gameName: catalogue.gameName,
        dryRun: true,
        entries: catalogue.entries.map(entry => ({
          profileId: entry.profileId,
          existingSkinId: entry.existingSkinId,
          create: entry.existingSkinId ? undefined : skinRequest(entry),
          assignment: { costumeDefault: 1, mode: 'add' },
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
  const cookie = process.env.WARHALL_COOKIE;
  if (!cookie)
    throw new Error(
      'Set WARHALL_COOKIE to your own authenticated Warhall session cookie header. It is never saved or logged.',
    );
  const filename = path.resolve(projectRoot, values.state);
  let state = {};
  try {
    state = JSON.parse(await readFile(filename, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
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
  });
  console.log('Shared mappings published. Refresh the catalogue in Warhall Test.');
}
