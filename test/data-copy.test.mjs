import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { copyTestToLive, liveDataUrls } from '../src/data-copy.mjs';
import { defaultDataDirectory } from '../src/paths.mjs';

const raw = 'https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/';

test('live copy replaces stale files, copies assets and preserves the tested source', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'starcraft-copy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'Starcraft-test');
  const target = path.join(root, 'Starcraft');
  const jsonOnly = file => !file.includes(`${path.sep}assets`);
  await cp(defaultDataDirectory, source, { recursive: true, filter: jsonOnly });
  await cp(defaultDataDirectory, target, { recursive: true, filter: jsonOnly });
  const sourceVersion = await readFile(path.join(source, 'version.json'), 'utf8');
  await writeFile(path.join(target, 'obsolete.json'), '{}');
  await writeFile(path.join(source, 'example.png'), Buffer.from([1, 2, 3]));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', 'Starcraft-test'], { cwd: root });
  await writeFile(path.join(source, 'local-preview.png'), Buffer.from([4, 5, 6]));
  const version = await copyTestToLive(root);
  assert.equal(version, JSON.parse(sourceVersion).version + 1);
  assert.equal(await readFile(path.join(source, 'version.json'), 'utf8'), sourceVersion);
  assert.deepEqual(await readFile(path.join(target, 'example.png')), Buffer.from([1, 2, 3]));
  await assert.rejects(access(path.join(target, 'obsolete.json')));
  await assert.rejects(access(path.join(target, 'local-preview.png')));
  const published = JSON.parse(await readFile(path.join(target, 'version.json'), 'utf8'));
  assert.equal(published.url, `${raw}main/Starcraft/manifest.json`);
  assert.equal(published.version, version);
  assert.equal(JSON.parse(await readFile(path.join(target, 'manifest.json'))).version, version);
  assert.ok(
    !(await readFile(path.join(target, 'cards.json'), 'utf8')).includes('/Starcraft-test/'),
  );
  await writeFile(path.join(source, 'manifest.json'), '{}');
  const before = await readFile(path.join(target, 'version.json'), 'utf8');
  await assert.rejects(copyTestToLive(root));
  assert.equal(await readFile(path.join(target, 'version.json'), 'utf8'), before);
});

test('data URL changes leave external sources and immutable models alone', () => {
  assert.equal(
    liveDataUrls(`${raw}refs/heads/test/Starcraft-test/cards.json`),
    `${raw}main/Starcraft/cards.json`,
  );
  for (const url of [
    `${raw}abcdef/Starcraft/cards.json`,
    `${raw}main/model-assets/file.glb`,
    'https://example.com/Starcraft-test/card.png',
  ]) {
    assert.equal(liveDataUrls(url), url);
  }
});
