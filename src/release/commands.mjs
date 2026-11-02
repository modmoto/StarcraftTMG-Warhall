import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { projectRoot } from '../paths.mjs';

function works(file) {
  return spawnSync(file, ['--version'], { stdio: 'ignore' }).status === 0;
}
export const git = [
  process.env.WARHALL_GIT_BIN,
  'git',
  '/Applications/Xcode.app/Contents/Developer/usr/bin/git',
]
  .filter(Boolean)
  .find(works);
if (!git) throw new Error('A working Git installation is required');
if (path.isAbsolute(git))
  process.env.PATH = `${path.dirname(git)}${path.delimiter}${process.env.PATH}`;
const cachedGh = path.join(
  projectRoot,
  '.cache/github-cli',
  process.platform === 'win32' ? 'gh.exe' : 'gh',
);
export const gh = existsSync(cachedGh) ? cachedGh : 'gh';
export const repository = 'modmoto/StarcraftTMG-Warhall';
export function run(file, args, { capture = false, input } = {}) {
  const result = spawnSync(file, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    input,
    stdio: capture ? ['pipe', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${path.basename(file)} ${args[0]} failed${capture ? `: ${result.stderr?.trim() || result.error?.message || ''}` : ''}`,
    );
  return result.stdout?.trim();
}
export const gitText = args => run(git, args, { capture: true });
export function requireClean() {
  if (gitText(['diff', '--name-only']) || gitText(['diff', '--cached', '--name-only']))
    throw new Error('Commit tracked work before starting a release');
}
