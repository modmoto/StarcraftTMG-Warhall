import { channelUrls } from '../src/release/channel-urls.mjs';
import { parseArgs } from 'node:util';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from '../src/paths.mjs';

const { values } = parseArgs({ options: { branch: { type: 'string' } } });
if (!['test', 'main'].includes(values.branch)) throw new Error('--branch must be test or main');
const files = [];
async function collect(directory, recursive) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name);
    if (item.isDirectory() && recursive && item.name !== 'assets') await collect(filename, true);
    else if (item.isFile() && item.name.endsWith('.json')) files.push(filename);
  }
}
await collect(projectRoot, false);
await collect(path.join(projectRoot, 'Starcraft'), true);
let changed = 0;
for (const filename of files) {
  const before = await readFile(filename, 'utf8');
  const after = channelUrls(before, values.branch);
  if (before !== after) {
    await writeFile(filename, after);
    changed++;
  }
}
console.log(`Prepared ${values.branch} URLs in ${changed} data/catalogue files.`);
