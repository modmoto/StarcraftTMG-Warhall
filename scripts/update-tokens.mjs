import { rawRepositoryUrl } from '../src/channel.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from '../src/paths.mjs';
import { tokenDefinitions, factionColors } from '../src/tokens/package.mjs';
import { tokenImage, factionLogo } from '../src/tokens/artwork.mjs';

const flags = process.argv.slice(2);
assert.ok(
  flags.every(flag => flag === '--check'),
  'Unknown token artwork flag',
);
const check = flags.includes('--check');
const directory = path.join(projectRoot, 'Starcraft/assets/tokens');
const base = `${rawRepositoryUrl}/Starcraft/assets/tokens`;
const files = new Map();
const artwork = {},
  icons = {};
function asset(bytes) {
  const filename = `${createHash('sha256').update(bytes).digest('hex')}.png`;
  files.set(path.join(directory, filename), bytes);
  return `${base}/${filename}`;
}
for (const token of tokenDefinitions) {
  artwork[token.id] = asset(await tokenImage(projectRoot, token));
}
for (const [name, color] of Object.entries(factionColors)) {
  icons[name.toLowerCase()] = asset(await factionLogo(projectRoot, name.toLowerCase(), color));
}
files.set(
  path.join(projectRoot, 'token-artwork.json'),
  Buffer.from(`${JSON.stringify({ artwork, icons }, null, 2)}\n`),
);
if (!check) await mkdir(directory, { recursive: true });
for (const [filename, bytes] of files) {
  if (check)
    assert.ok((await readFile(filename)).equals(bytes), `Token artwork differs: ${filename}`);
  else await writeFile(filename, bytes);
}
console.log(
  `${check ? 'Verified' : 'Generated'} ${tokenDefinitions.length} single-sided round tokens and three faction icons.`,
);
