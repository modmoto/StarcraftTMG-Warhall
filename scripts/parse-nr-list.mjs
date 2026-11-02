import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defaultDataDirectory } from '../src/paths.mjs';
import { planNewRecruitList } from '../src/lists/new-recruit.mjs';

const { values } = parseArgs({
  options: { input: { type: 'string' }, output: { type: 'string' } },
});
if (!values.input) throw new Error('Use --input list.txt [--output plan.json]');
const json = async file =>
  JSON.parse(await readFile(path.join(defaultDataDirectory, file), 'utf8'));
const factions = {};
for (const faction of ['Terran', 'Protoss', 'Zerg']) {
  factions[faction] = {
    units: await json(`${faction}/units.json`),
    profiles: await json(`${faction}/profiles.json`),
    rules: await json(`${faction}/rules.json`),
  };
}
const plan = planNewRecruitList(await readFile(values.input, 'utf8'), {
  factions,
  cards: await json('cards.json'),
  deployments: await json('deployments.json'),
});
const output = JSON.stringify(plan, null, 2) + '\n';
if (values.output) await writeFile(values.output, output);
else process.stdout.write(output);
