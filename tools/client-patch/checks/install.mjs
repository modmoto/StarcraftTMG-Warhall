import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, rm, access, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import path from 'node:path';
import os from 'node:os';

const { values } = parseArgs({ options: { patcher: { type: 'string' }, source: { type: 'string' } } });
assert.ok(values.patcher && values.source, 'Use --patcher <binary> --source <original production app/folder>');
const binary = path.resolve(values.patcher);
const source = path.resolve(values.source);
const temporary = await mkdtemp(path.join(os.tmpdir(), 'warhall-installer-checks-'));
const fixture = path.join(temporary, process.platform === 'darwin' ? 'ProductionFixture.app' : 'ProductionFixture');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = file => access(file).then(() => true, () => false);
async function snapshot(directory, prefix = '') {
  const result = new Map();
  for (const item of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = path.join(prefix, item.name);
    if (item.isDirectory()) for (const entry of await snapshot(directory, relative)) result.set(...entry);
    else if (item.isFile()) result.set(relative, hash(await readFile(path.join(directory, relative))));
  }
  return result;
}
function run(extra = [], expected = 0) {
  const result = spawnSync(binary, ['--source', fixture, ...extra], { encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, expected, result.stderr || result.error?.message || result.stdout);
  return result;
}
try {
  await cp(source, fixture, { recursive: true, dereference: true });
  const managed = process.platform === 'darwin'
    ? path.join(fixture, 'Contents/Resources/Data/Managed')
    : path.join(fixture, 'Warhall_Data/Managed');
  const assembly = path.join(managed, 'Assembly-CSharp.dll');
  const helper = path.join(managed, 'MovementPrototype.dll');
  const original = hash(await readFile(assembly));
  const before = await snapshot(fixture);
  run();
  const patched = hash(await readFile(assembly));
  assert.notEqual(patched, original);
  for (const [file, digest] of before)
    if (path.join(fixture, file) !== assembly)
      assert.equal(hash(await readFile(path.join(fixture, file))), digest, 'Unexpected change: ' + file);
  run();
  assert.equal(hash(await readFile(assembly)), patched, 'Repeated install must not stack hooks');
  const bytes = await readFile(helper);
  await writeFile(helper, 'unexpected external helper');
  run([], 1);
  assert.equal(hash(await readFile(assembly)), patched, 'Rejected install changed the game');
  await writeFile(helper, bytes);
  run(['--restore']);
  assert.equal(hash(await readFile(assembly)), original);
  assert.equal(await exists(helper), false);
  run();
  const log = await readFile(path.join(path.dirname(binary), 'WarhallCommunityPatch.log'), 'utf8');
  assert.match(log, /ERROR:/);
  assert.match(log, /Original managed code restored/);
  console.log('PASS in-place install, unchanged native files, idempotence, refusal, restore and logging');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
