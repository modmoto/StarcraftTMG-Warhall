import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { readJson, writeJson } from '../src/io.mjs';
import { projectRoot, defaultDataDirectory } from '../src/paths.mjs';
import { downloadCommandCenter, commandCenterSnapshot } from '../src/sources/command-center.mjs';
import { auditCommandCenter } from '../src/command-center-audit.mjs';
import { buildFromCommandCenter } from '../src/convert.mjs';
import { writePackage } from '../src/warhall/package.mjs';

const options = { apply: false, offline: false, snapshot: commandCenterSnapshot };
const args = process.argv.slice(2);
while (args.length) {
  const flag = args.shift();
  if (flag === '--apply') options.apply = true;
  else if (flag === '--offline') options.offline = true;
  else if (['--source-input', '--approve-blue', '--approve-green'].includes(flag)) {
    const value = args.shift();
    assert.ok(value && !value.startsWith('--'), `Missing value: ${flag}`);
    options[
      { '--source-input': 'snapshot', '--approve-blue': 'blue', '--approve-green': 'green' }[flag]
    ] = flag === '--source-input' ? path.resolve(value) : value;
    if (flag === '--source-input') options.offline = true;
  } else if (flag === '--help') {
    console.log(
      'Usage: npm run wave:update -- [--offline | --source-input FILE] [--apply --approve-blue FINGERPRINT --approve-green FINGERPRINT]',
    );
    console.log(
      'Default: download DB, audit and build a candidate in .cache/wave-update; never update the general rulebook. PDF fallback is only for reviewed base sizes in command-center-mapping.json.',
    );
    process.exit(0);
  } else throw new Error(`Unknown argument: ${flag}`);
}

const directory = path.join(projectRoot, '.cache/wave-update');
const raw = options.offline ? await readJson(options.snapshot) : await downloadCommandCenter();
const candidateSnapshot = path.join(directory, 'command-center.json');
await writeJson(candidateSnapshot, raw);
const mapping = await readJson(path.join(projectRoot, 'command-center-mapping.json'));
const audit = auditCommandCenter(
  raw,
  mapping,
  await readJson(path.join(defaultDataDirectory, 'import-report.json')),
  await readJson(path.join(projectRoot, 'model-catalogue.json')),
);
await writeJson(path.join(directory, 'report.json'), audit);
console.log(
  `${audit.counts.units} DB units (${audit.newUnits.length} new), ${audit.counts.cards} tactical cards.`,
);
console.log(
  `Review: ${audit.blue.length} blue, ${audit.green.length} green; ${audit.missingBases.length} missing bases, ${audit.conflicts.length} source conflicts, ${audit.missingModels.length} missing models.`,
);
console.log(`Report: ${path.join(directory, 'report.json')}\nFingerprint: ${audit.fingerprint}`);
const blockers = [
  ...audit.missingBases.map(item => `Missing reviewed PDF base: ${item.key}`),
  ...audit.conflicts.map(item => `${item.key}: ${item.reason}`),
  ...audit.missingFromDatabase.map(key => `Previously mapped unit absent from DB: ${key}`),
];
if (blockers.length) {
  console.log(blockers.join('\n'));
  if (options.apply) throw new Error('No game data written: resolve the inventory blockers first.');
  process.exit(0);
}
// Generation and validation finish before any write to the live dataset.
const { data, report } = await buildFromCommandCenter({ snapshot: candidateSnapshot });
await writePackage(path.join(directory, 'Starcraft'), data, report);
console.log(`Validated candidate: ${path.join(directory, 'Starcraft')}`);
if (!options.apply) process.exit(0);
for (const color of ['blue', 'green'])
  if (audit[color].length)
    assert.equal(
      options[color],
      audit.fingerprint,
      `Explicit ${color} list approval is required for this source fingerprint; candidate retained.`,
    );
const unchanged = (
  await Promise.all(
    Object.keys(data)
      .filter(file => !['manifest.json', 'version.json'].includes(file))
      .map(async file => {
        try {
          return (
            (await readFile(path.join(defaultDataDirectory, file), 'utf8')) ===
            JSON.stringify(data[file], null, 2) + '\n'
          );
        } catch (error) {
          if (error.code === 'ENOENT') return false;
          throw error;
        }
      }),
  )
).every(Boolean);
if (!unchanged) {
  data['manifest.json'].version++;
  data['version.json'].version = data['manifest.json'].version;
}
report.sources[0].file = path.relative(projectRoot, commandCenterSnapshot);
await writeJson(commandCenterSnapshot, raw);
await writePackage(defaultDataDirectory, data, report);
await writeJson(path.join(projectRoot, 'command-center-report.json'), audit);
console.log(
  `Applied DB snapshot as data version ${data['manifest.json'].version}. Publish Test assets separately; production needs an explicit release.`,
);
