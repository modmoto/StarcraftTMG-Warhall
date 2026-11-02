import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { channelUrls } from '../src/release/channel-urls.mjs';
import { projectRoot } from '../src/paths.mjs';

test('channel preparation isolates test/main while retaining external and immutable sources', () => {
  const root = 'https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/';
  const sources = [
    root + 'main/Starcraft/manifest.json',
    root + 'refs/heads/main/model-assets/model.glb',
    root + '0123456789/model-assets/model.glb',
    'https://example.com/main/model.glb',
  ];
  const prepared = JSON.parse(channelUrls(JSON.stringify(sources), 'test'));
  assert.deepEqual(prepared, [
    root + 'test/Starcraft/manifest.json',
    root + 'test/model-assets/model.glb',
    sources[2],
    sources[3],
  ]);
  const promoted = JSON.parse(channelUrls(JSON.stringify(prepared), 'main'));
  assert.deepEqual(promoted, [
    sources[0],
    root + 'main/model-assets/model.glb',
    sources[2],
    sources[3],
  ]);
  assert.throws(() => channelUrls('', '../main'), /Channel/);
});

test('release publishing rejects mismatched branches and unsafe version inputs before remote work', () => {
  const call = (branch, version, prerelease) =>
    spawnSync(
      process.execPath,
      [
        'scripts/create-github-release.mjs',
        '--version',
        version,
        '--prerelease',
        prerelease,
        '--dry-run',
      ],
      { cwd: projectRoot, env: { ...process.env, GITHUB_REF_NAME: branch }, encoding: 'utf8' },
    );
  assert.notEqual(call('test', '3.0', 'false').status, 0);
  assert.notEqual(call('main', '3.0', 'true').status, 0);
  assert.notEqual(call('test', '../../other', 'true').status, 0);
  assert.equal(call('test', '3.0', 'true').status, 0);
  assert.equal(call('main', '3.0', 'false').status, 0);
});
