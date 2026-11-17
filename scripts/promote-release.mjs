import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { projectRoot } from '../src/paths.mjs';

// Promote the exact tested main commit. Never rewrite release history or copy datasets.
const flags = process.argv.slice(2);
assert.ok(
  flags.every(flag => flag === '--apply'),
  'Use --apply to push release',
);
const git = (...args) => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim();
assert.equal(git('branch', '--show-current'), 'main', 'Run promotion from main');
assert.equal(git('status', '--porcelain'), '', 'Commit or set aside local work first');
git('fetch', 'origin', 'main');
const main = git('rev-parse', 'main');
assert.equal(main, git('rev-parse', 'origin/main'), 'Push main before promotion');
const remoteRelease = git('ls-remote', '--heads', 'origin', 'refs/heads/release');
if (remoteRelease) {
  git('fetch', 'origin', 'release:refs/remotes/origin/release');
  try {
    git('merge-base', '--is-ancestor', 'origin/release', main);
  } catch {
    throw new Error(
      'release has independent commits. Reconcile them before promotion; no force push was attempted.',
    );
  }
}
console.log(`${remoteRelease ? 'Advance' : 'Create'} release at main ${main}`);
if (flags.includes('--apply')) {
  git('push', 'origin', `${main}:refs/heads/release`);
  assert.equal(git('ls-remote', '--heads', 'origin', 'refs/heads/release').split(/\s/)[0], main);
  console.log('Release branch verified. Publish required production skins separately.');
} else console.log('Preview only. Run with --apply after validation and release authorization.');
