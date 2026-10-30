import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { defaultDataDirectory, projectRoot } from '../src/paths.mjs';
import { buildFromPdf } from '../src/convert.mjs';
import { validatePackage } from '../src/warhall/validate.mjs';

// Read-only check: uses the existing official PDF cache and never rewrites output.
const result = await validatePackage(defaultDataDirectory);
const { data, report } = await buildFromPdf({ offline: true });
assert.equal(
  data['version.json'].version,
  data['manifest.json'].version,
  'Release versions differ',
);
assert.equal(
  data['version.json'].url,
  'https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/main/Starcraft/manifest.json',
  'Unexpected update manifest URL',
);
for (const [name, value] of Object.entries({ ...data, 'import-report.json': report })) {
  const actual = await readFile(path.join(defaultDataDirectory, name));
  const expected = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  assert.ok(actual.equals(expected), `Generated file differs or has non-LF encoding: ${name}`);
}
console.log(`Package verified: ${result.units} units, ${result.records} records, LF-only output.`);

for (const args of [
  ['scripts/update-deployments.mjs', '--check'],
  ['scripts/update-terrain.mjs', '--check'],
  ['--test'],
  [
    'node_modules/prettier/bin/prettier.cjs',
    '--check',
    'scripts/**/*.mjs',
    'src/**/*.mjs',
    'test/*.mjs',
    'package.json',
    '.prettierrc.json',
  ],
]) {
  const processResult = spawnSync(process.execPath, args, { cwd: projectRoot, stdio: 'inherit' });
  if (processResult.error) throw processResult.error;
  if (processResult.status !== 0) process.exit(processResult.status ?? 1);
}
console.log('Local checks passed. Warhall UI/model rendering requires a separate client check.');
