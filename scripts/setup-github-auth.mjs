import { spawn } from 'node:child_process';
import { access, writeFile, mkdir, mkdtemp, cp, chmod, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { projectRoot } from '../src/paths.mjs';

function execute(file, args, { interactive = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: projectRoot,
      stdio: interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
    const output = [];
    if (!interactive) {
      child.stdout.on('data', chunk => output.push(chunk));
      child.stderr.on('data', chunk => output.push(chunk));
    }
    child.once('error', () => reject(new Error(`Could not run ${path.basename(file)}`)));
    child.once('close', code =>
      resolve({ code, output: Buffer.concat(output).toString('utf8').trim() }),
    );
  });
}
const directory = path.join(projectRoot, '.cache', 'github-cli');
const gh = path.join(directory, 'gh');
try {
  await access(gh);
} catch {
  if (process.platform !== 'darwin')
    throw new Error(
      'Install GitHub CLI from https://cli.github.com, then run gh auth login and gh auth setup-git.',
    );
  const response = await fetch('https://api.github.com/repos/cli/cli/releases/latest', {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error('Could not discover the official GitHub CLI release');
  const release = await response.json();
  const architecture = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const asset = release.assets.find(asset => asset.name.endsWith(`_macOS_${architecture}.zip`));
  const checksums = release.assets.find(asset => asset.name.endsWith('_checksums.txt'));
  if (!asset || !checksums) throw new Error('Official GitHub CLI download not found');
  const [download, manifest] = await Promise.all([
    fetch(asset.browser_download_url),
    fetch(checksums.browser_download_url),
  ]);
  if (!download.ok || !manifest.ok) throw new Error('Could not download the official GitHub CLI');
  const bytes = Buffer.from(await download.arrayBuffer());
  const checksum = (await manifest.text())
    .split('\n')
    .find(line => line.trim().endsWith(` ${asset.name}`))
    ?.trim()
    .split(/\s+/)[0];
  if (!checksum || createHash('sha256').update(bytes).digest('hex') !== checksum)
    throw new Error('GitHub CLI checksum verification failed');
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'warhall-github-'));
  try {
    const archive = path.join(temporary, 'gh.zip'),
      unpacked = path.join(temporary, 'unpacked');
    await writeFile(archive, bytes);
    const extracted = await execute('/usr/bin/ditto', ['-x', '-k', archive, unpacked]);
    if (extracted.code !== 0) throw new Error('Could not extract GitHub CLI');
    await mkdir(directory, { recursive: true });
    const folder = asset.name.slice(0, -4);
    await cp(path.join(unpacked, folder, 'bin', 'gh'), gh);
    await chmod(gh, 0o755);
    console.log(`Installed official GitHub CLI ${release.tag_name} (checksum verified).`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
if (process.argv.includes('--prepare')) {
  console.log('GitHub CLI is ready for browser sign-in.');
  process.exit(0);
}
if (!process.stdin.isTTY)
  throw new Error('Run npm run auth:github in your terminal to approve GitHub browser sign-in.');
let git;
for (const candidate of [
  process.env.WARHALL_GIT,
  'git',
  '/Applications/Xcode.app/Contents/Developer/usr/bin/git',
].filter(Boolean)) {
  try {
    if ((await execute(candidate, ['--version'])).code === 0) {
      git = candidate;
      break;
    }
  } catch {}
}
if (!git) throw new Error('Git is unavailable. Set WARHALL_GIT to a working Git executable.');
if (path.isAbsolute(git))
  process.env.PATH = path.dirname(git) + path.delimiter + (process.env.PATH ?? '');
const authenticated = await execute(
  gh,
  ['auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web'],
  { interactive: true },
);
if (authenticated.code !== 0) throw new Error('GitHub sign-in was not completed');
const storage = await execute(gh, ['auth', 'status', '--hostname', 'github.com', '--active']);
if (storage.code !== 0 || !storage.output.includes('(keyring)'))
  throw new Error(
    'GitHub CLI did not confirm OS Keychain storage. Resolve its credential-store warning before configuring Git.',
  );
const account = await execute(gh, ['api', 'user', '--jq', '.login']);
if (account.code !== 0 || !/^[a-z\d-]+$/i.test(account.output))
  throw new Error('Could not resolve the authenticated GitHub account');
const quote = value => `'${value.replace(/'/g, "'\\''")}'`;
const helper = `!${quote(gh)} auth git-credential`;
for (const args of [
  ['config', '--local', 'credential.https://github.com.username', account.output],
  ['config', '--local', 'credential.https://github.com.helper', ''],
  ['config', '--local', '--add', 'credential.https://github.com.helper', helper],
]) {
  const configured = await execute(git, args);
  if (configured.code !== 0)
    throw new Error('Could not configure this repository’s GitHub credential helper');
}
console.log(
  'GitHub authentication is configured for this repository. Git can use the stored credential without printing it.',
);
