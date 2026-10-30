import assert from 'node:assert/strict';
import { readFile, writeFile, realpath, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from '../src/paths.mjs';

const [directory, mode = '--dry-run'] = process.argv.slice(2);
assert.ok(
  directory,
  'Usage: node scripts/install-warhall-deployment-cache.mjs WARHALL_TEST_DIRECTORY [--dry-run|--apply]',
);
assert.ok(['--dry-run', '--apply'].includes(mode), 'Unknown mode');
const root = await realpath(directory);
assert.equal(path.basename(root), 'WarhallTest', 'Only the test client is supported');
const target = path.join(root, 'DeploymentDB');
const original = await readFile(target, 'utf8');
const raw = original.replace(/^"|"$/g, '');
assert.ok(raw.startsWith('1L4HR4W'), 'Unexpected template cache encoding');
const templates = JSON.parse(Buffer.from(raw.slice(7), 'base64').toString('utf8'));
assert.ok(Array.isArray(templates), 'Unexpected template cache data');
const imported = JSON.parse(
  await readFile(path.join(projectRoot, 'deployment-templates.json'), 'utf8'),
);
for (const template of imported) {
  const existing = templates.find(t => t.deploymentID === template.deploymentID);
  if (existing) assert.ok(template.deploymentID >= 100000, 'Refusing to replace a shared template');
}
const ids = new Set(imported.map(t => t.deploymentID));
const merged = [...templates.filter(t => !ids.has(t.deploymentID)), ...imported];
if (mode === '--apply') {
  const backup = path.join(projectRoot, '.cache', `warhall-deployment-backup-${Date.now()}`);
  await mkdir(backup, { recursive: true });
  await copyFile(target, path.join(backup, 'DeploymentDB'));
  try {
    await writeFile(
      target,
      '1L4HR4W' + Buffer.from(JSON.stringify(merged)).toString('base64'),
      'utf8',
    );
  } catch (error) {
    await writeFile(target, original, 'utf8');
    throw error;
  }
  console.log(`Backup: ${backup}`);
}
console.log(
  `${mode}: ${imported.length} deployment templates. Close Warhall Test before applying, then restart. Shared updates can replace this cache.`,
);
