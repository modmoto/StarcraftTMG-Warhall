import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot } from '../src/paths.mjs';

const [directory, ...flags] = process.argv.slice(2);
const mode = flags.includes('--apply') ? '--apply' : '--dry-run';
assert.ok(
  flags.every(f => ['--apply', '--dry-run', '--local-source'].includes(f)),
  'Unknown flag',
);
assert.ok(
  directory,
  'Usage: node scripts/install-warhall-data.mjs WARHALL_TEST_DIRECTORY [--apply|--dry-run]',
);
assert.ok(['--apply', '--dry-run'].includes(mode));
const root = await realpath(directory);
assert.equal(path.basename(root), 'WarhallTest', 'Only the test client is supported');
const source = path.join(projectRoot, 'Starcraft');
const target = await realpath(path.join(root, 'WDS', 'Starcraft'));
assert.equal(target, path.join(root, 'WDS', 'Starcraft'), 'Unexpected resolved WDS directory');
const manifest = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'));
const files = [...new Set(['manifest.json', 'version.json', ...manifest.files])];
const contents = new Map();
for (const file of files) {
  assert.ok(!path.isAbsolute(file) && !file.split(/[\\/]/).includes('..'), 'Unsafe manifest path');
  const bytes = await readFile(path.join(source, file));
  JSON.parse(bytes.toString());
  contents.set(file, bytes);
}
let versionCache, versionCacheOriginal;
const versionCacheFile = path.join(root, 'Database', 'GetGameVersions');
if (flags.includes('--local-source')) {
  const localUrl = pathToFileURL(path.join(source, 'manifest.json')).href;
  versionCacheOriginal = await readFile(versionCacheFile);
  const encoded = versionCacheOriginal.toString('utf8');
  assert.ok(encoded.startsWith('1L4HR4W'), 'Unexpected game version cache encoding');
  versionCache = JSON.parse(Buffer.from(encoded.slice(7), 'base64').toString('utf8'));
  const gamesEncoded = await readFile(path.join(root, 'Database', 'GetGames'), 'utf8');
  const games = JSON.parse(Buffer.from(gamesEncoded.slice(7), 'base64').toString('utf8'));
  const game = games.find(g => g.GameName === 'Starcraft');
  assert.ok(game, 'Exact-case Starcraft game missing');
  const versions = versionCache.filter(v => v.GameVersionIdGame === game.IdGame);
  assert.ok(versions.length, 'No Starcraft version entries');
  for (const v of versions) v.GameVersionDataPath = localUrl;
  const installedVersion = JSON.parse(contents.get('version.json'));
  installedVersion.url = localUrl;
  contents.set('version.json', Buffer.from(JSON.stringify(installedVersion, null, 2) + '\n'));
}
if (mode === '--apply') {
  const backup = path.join(projectRoot, '.cache', `warhall-data-backup-${Date.now()}`);
  const originals = new Map();
  if (versionCache)
    await copyFile(versionCacheFile, path.join(backup, 'GetGameVersions')).catch(async error => {
      if (error.code !== 'ENOENT') throw error;
      await mkdir(backup, { recursive: true });
      await copyFile(versionCacheFile, path.join(backup, 'GetGameVersions'));
    });
  for (const file of files) {
    const destination = path.join(target, file);
    try {
      originals.set(file, await readFile(destination));
      await mkdir(path.dirname(path.join(backup, file)), { recursive: true });
      await copyFile(destination, path.join(backup, file));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  try {
    for (const [file, bytes] of contents) {
      await mkdir(path.dirname(path.join(target, file)), { recursive: true });
      await writeFile(path.join(target, file), bytes);
    }
    if (versionCache)
      await writeFile(
        versionCacheFile,
        '1L4HR4W' + Buffer.from(JSON.stringify(versionCache)).toString('base64'),
      );
  } catch (error) {
    for (const [file, bytes] of originals) await writeFile(path.join(target, file), bytes);
    if (versionCacheOriginal) await writeFile(versionCacheFile, versionCacheOriginal);
    throw error;
  }
  console.log(`Backup: ${backup}`);
}
console.log(
  `${mode}: ${files.length} WDS files, version ${manifest.version}. Restart Warhall Test to load them.`,
);
