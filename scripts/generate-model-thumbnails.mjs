import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { projectRoot } from '../src/paths.mjs';
import { generateThumbnail } from '../src/models/render-thumbnail.mjs';
import { loadThumbnail } from '../src/models/thumbnails.mjs';

const { values } = parseArgs({
  options: {
    directory: { type: 'string', default: '.cache/model-thumbnails' },
    profile: { type: 'string' },
    force: { type: 'boolean', default: false },
    'use-transforms': { type: 'boolean', default: false },
  },
});
const catalogue = JSON.parse(
  await readFile(path.join(projectRoot, 'model-catalogue.json'), 'utf8'),
);
const entries = catalogue.entries.filter(
  entry => entry.parts?.length && (!values.profile || entry.profileId === values.profile),
);
if (!entries.length) throw new Error('No matching model profiles');
for (const [index, entry] of entries.entries()) {
  await (values.force ? generateThumbnail : loadThumbnail)(entry, {
    directory: path.resolve(projectRoot, values.directory),
    root: projectRoot,
    defaultScale: !values['use-transforms'],
  });
  console.log(`[${index + 1}/${entries.length}] ${entry.name}`);
}
