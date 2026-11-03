import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readJson, writeJson } from '../src/io.mjs';
import { projectRoot, defaultDataDirectory } from '../src/paths.mjs';
import { formatCard } from '../src/cards/descriptions.mjs';

const python = process.env.WARHALL_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const result = spawnSync(python, ['scripts/update-cards.py'], {
  cwd: projectRoot,
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const overrides = await readJson(path.join(projectRoot, 'card-text-overrides.json'));
const filename = path.join(defaultDataDirectory, 'cards.json');
const cards = await readJson(filename);
await writeJson(
  filename,
  cards.map(card => formatCard(card, overrides)),
);
console.log(
  `Formatted ${cards.length} non-unit cards with resource costs and separated abilities.`,
);
