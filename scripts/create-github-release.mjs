import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { run, gitText, gh, repository } from '../src/release/commands.mjs';
import { projectRoot } from '../src/paths.mjs';

const { values } = parseArgs({
  options: {
    version: { type: 'string' },
    prerelease: { type: 'string', default: 'true' },
    'dry-run': { type: 'boolean' },
  },
});
if (!/^\d+\.\d+(?:\.\d+)?$/.test(values.version ?? ''))
  throw new Error('Use a numeric release version, for example 3.0');
if (!['true', 'false'].includes(values.prerelease))
  throw new Error('--prerelease must be true or false');
const prerelease = values.prerelease === 'true';
const branch = process.env.GITHUB_REF_NAME ?? gitText(['branch', '--show-current']);
if (branch !== (prerelease ? 'test' : 'main'))
  throw new Error('Prereleases must run from test; stable releases must run from main');
const tag = `v${values.version}`;
const source = await readFile(path.join(projectRoot, 'releases', `${values.version}.md`), 'utf8');
if (!source.trim() || /TODO|TBD|\[insert/i.test(source))
  throw new Error('Write reviewed player-facing release notes first');
const title = `${values.version} — Wave ${values.version.split('.')[0]}${prerelease ? ' Beta' : ''}`;
const body = `${prerelease ? '> Beta for player testing. Known limitations are listed below.\n\n' : ''}${source.trim()}\n`;
const directory = path.join(projectRoot, '.cache/release', tag);
await mkdir(directory, { recursive: true });
const notes = path.join(directory, 'notes.md');
await writeFile(notes, body);
const commit = gitText(['rev-parse', 'HEAD']);
const metadata = path.join(directory, 'release-metadata.json');
await writeFile(
  metadata,
  `${JSON.stringify({ version: values.version, tag, channel: branch, sourceCommit: commit, prerelease, dataVersion: JSON.parse(await readFile(path.join(projectRoot, 'Starcraft/manifest.json'))).version }, null, 2)}\n`,
);
if (values['dry-run']) {
  console.log(`${title}\n\n${body}`);
  process.exit(0);
}
const zip = path.join(directory, 'Starcraft.zip');
run('python3', [
  '-c',
  'import shutil,sys;shutil.make_archive(sys.argv[1],"zip",sys.argv[2],"Starcraft")',
  zip.slice(0, -4),
  projectRoot,
]);
const all = JSON.parse(
  run(gh, ['api', `repos/${repository}/releases?per_page=100`], { capture: true }),
);
const existing = all.find(release => release.tag_name === tag);
if (existing && !existing.prerelease && prerelease)
  throw new Error('A stable release cannot be overwritten by a prerelease');
if (existing && prerelease) {
  const tagged = gitText(['rev-list', '-n', '1', tag]);
  if (tagged !== commit)
    throw new Error('This prerelease already pins another commit; use a new patch version');
}
const common = ['--repo', repository, '--title', title, '--notes-file', notes];
if (existing)
  run(gh, [
    'release',
    'edit',
    tag,
    ...common,
    `--prerelease=${prerelease}`,
    `--latest=${!prerelease}`,
  ]);
else
  run(gh, [
    'release',
    'create',
    tag,
    ...common,
    '--target',
    commit,
    ...(prerelease ? ['--prerelease'] : ['--latest']),
  ]);
run(gh, ['release', 'upload', tag, zip, metadata, '--repo', repository, '--clobber']);
console.log(`Published ${title}`);
