import assert from 'node:assert/strict';
import { lstat, mkdir, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from '../src/paths.mjs';

// Run with the test client closed. Move only regenerable data, never saves or login settings.
const [directory, mode = '--dry-run'] = process.argv.slice(2);
assert.ok(
  directory,
  'Usage: node scripts/reset-warhall-cloud.mjs WARHALL_TEST_DIRECTORY [--dry-run|--apply]',
);
assert.ok(['--dry-run', '--apply'].includes(mode), 'Unknown mode');
assert.ok(process.argv.length <= 4, 'Unexpected arguments');
const root = await realpath(directory);
assert.equal(path.basename(root), 'WarhallTest', 'Only the test client is supported');
await realpath(path.join(root, 'Database'));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(root, '.cloud-reset-backups', stamp);
const targets = [
  ...[
    'AllItems',
    'AllItemInstances',
    'AllItemInstancesNoDefault',
    'AllSkinData',
    'AllSkinParts',
    'AllSkinLayers',
    'GetGameVersions',
    'Table_version',
  ].map(n => `Database/${n}`),
  'WDS/Starcraft',
  'DeploymentDB',
  'DeploymentDB.version.json',
  'ModelCache',
  'TextureCache',
];
const existing = [];
for (const relative of targets) {
  const target = path.join(root, relative);
  try {
    const info = await lstat(target);
    assert.ok(!info.isSymbolicLink(), `Refusing linked target: ${relative}`);
    const resolved = await realpath(target);
    const within = path.relative(root, resolved);
    assert.ok(
      within && !within.startsWith('..') && !path.isAbsolute(within),
      'Target outside client',
    );
    existing.push(relative);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const preview = path.join(projectRoot, '.cache', 'warhall-preview');
let hasPreview = false;
try {
  assert.ok(!(await lstat(preview)).isSymbolicLink(), 'Refusing linked preview');
  hasPreview = true;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
console.log(
  JSON.stringify(
    { mode, root, backup, caches: existing, disableRepositoryPreview: hasPreview },
    null,
    2,
  ),
);
if (mode === '--apply') {
  await mkdir(backup, { recursive: true });
  await writeFile(
    path.join(backup, 'reset.json'),
    JSON.stringify({ root, caches: existing }, null, 2) + '\n',
  );
  for (const relative of existing) {
    const destination = path.join(backup, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(path.join(root, relative), destination);
  }
  if (hasPreview) await rename(preview, `${preview}-disabled-${stamp}`);
  console.log('Cloud reset complete. Start Warhall Test online to download shared data.');
}
