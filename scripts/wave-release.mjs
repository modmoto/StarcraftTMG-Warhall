import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { run, git, gitText, gh, repository, requireClean } from '../src/release/commands.mjs';
import { warhallSession } from '../src/release/warhall.mjs';
import { projectRoot } from '../src/paths.mjs';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { version: { type: 'string' }, apply: { type: 'boolean' } },
});
const mode = positionals[0];
if (!['stage', 'promote'].includes(mode)) throw new Error('Use stage or promote');
if (!/^\d+\.\d+(?:\.\d+)?$/.test(values.version ?? ''))
  throw new Error('--version must be a numeric version, for example 4.0');
const target = mode === 'stage' ? 'test' : 'main';
const server = mode === 'stage' ? 'test' : 'prod';
const tag = `v${values.version}`;
await readFile(path.join(projectRoot, 'releases', `${values.version}.md`));
if (!values.apply) {
  console.log(
    `${mode}: ${tag} → ${target} and Warhall ${server}. Run with --apply only when this stage is requested.`,
  );
  process.exit(0);
}
requireClean();
if (gitText(['branch', '--show-current']) !== 'test')
  throw new Error('Start releases from the test branch');
const session = await warhallSession(target);
run(git, ['fetch', 'origin', 'main', 'test', '--tags']);
const script = (name, ...args) => run(process.execPath, [`scripts/${name}.mjs`, ...args]);
if (mode === 'promote') {
  const release = JSON.parse(
    run(gh, ['release', 'view', tag, '--repo', repository, '--json', 'isPrerelease,isDraft'], {
      capture: true,
    }),
  );
  if (release.isDraft || !release.isPrerelease)
    throw new Error('Promote an existing published prerelease');
  const directory = path.join(projectRoot, '.cache/release-approval', tag);
  await mkdir(directory, { recursive: true });
  run(gh, [
    'release',
    'download',
    tag,
    '--repo',
    repository,
    '--pattern',
    'test-publication.json',
    '--dir',
    directory,
    '--clobber',
  ]);
  const receipt = JSON.parse(await readFile(path.join(directory, 'test-publication.json')));
  const tested = gitText(['rev-list', '-n', '1', tag]);
  if (
    receipt.sourceCommit !== tested ||
    receipt.version !== values.version ||
    receipt.server !== 'test' ||
    receipt.complete !== true
  )
    throw new Error('The prerelease has no matching completed Warhall Test publication');
  run(git, ['switch', 'main']);
  run(git, ['merge', '--ff-only', 'origin/main']);
  run(git, ['merge', '--no-ff', '--no-commit', tested]);
}
script('prepare-channel', '--branch', target);
const versionFile = path.join(projectRoot, 'Starcraft/version.json');
const manifestFile = path.join(projectRoot, 'Starcraft/manifest.json');
const version = JSON.parse(await readFile(versionFile));
const manifest = JSON.parse(await readFile(manifestFile));
const originManifest = JSON.parse(gitText(['show', 'origin/main:Starcraft/manifest.json']));
version.version = manifest.version = Math.max(manifest.version, originManifest.version) + 1;
await writeFile(versionFile, `${JSON.stringify(version, null, 2)}\n`);
await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
script('check-local');
run(git, ['add', '-u']);
run(git, [
  'commit',
  '-m',
  `${mode === 'stage' ? 'Stage' : 'Release'} Wave ${values.version.split('.')[0]} (${values.version})`,
]);
const commit = gitText(['rev-parse', 'HEAD']);
run(git, ['push', 'origin', target]);
script(
  'publish-model-catalogue',
  '--apply',
  '--login',
  '--server',
  server,
  '--state',
  `.cache/release-publication-${server}.json`,
  '--accept-publication-terms',
);
script('sync-menu-bindings', '--apply', '--login', '--server', server);
await session.pointToBranch();
run(gh, [
  'workflow',
  'run',
  'release.yml',
  '--repo',
  repository,
  '--ref',
  target,
  '-f',
  `version=${values.version}`,
  '-f',
  `prerelease=${mode === 'stage'}`,
]);
let workflow;
for (let attempt = 0; attempt < 20; attempt++) {
  const runs = JSON.parse(
    run(
      gh,
      [
        'run',
        'list',
        '--repo',
        repository,
        '--workflow',
        'release.yml',
        '--branch',
        target,
        '--limit',
        '10',
        '--json',
        'databaseId,headSha,createdAt',
      ],
      { capture: true },
    ),
  );
  workflow = runs.find(item => item.headSha === commit);
  if (workflow) break;
  await new Promise(resolve => setTimeout(resolve, 2000));
}
if (!workflow)
  throw new Error('Release workflow was dispatched; inspect GitHub Actions before retrying');
run(gh, ['run', 'watch', String(workflow.databaseId), '--repo', repository, '--exit-status']);
const receiptFile = path.join(
  projectRoot,
  '.cache',
  mode === 'stage' ? 'test-publication.json' : 'production-publication.json',
);
await writeFile(
  receiptFile,
  `${JSON.stringify({ version: values.version, sourceCommit: commit, server, complete: true }, null, 2)}\n`,
);
run(gh, ['release', 'upload', tag, receiptFile, '--repo', repository, '--clobber']);
if (mode === 'promote') run(git, ['switch', 'test']);
console.log(`${tag}: ${mode === 'stage' ? 'ready for your tests' : 'released to production'}.`);
