import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validatePackage } from './warhall/validate.mjs';

const rawRoot = 'https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/';
const dataUrl = new RegExp(
  `${rawRoot.replaceAll('.', '\\.')}((?:refs/heads/)?(?:main|test))/Starcraft(?:-test)?/`,
  'g',
);

export function liveDataUrls(text) {
  return text.replace(dataUrl, `${rawRoot}main/Starcraft/`);
}

export async function copyTestToLive(root) {
  const source = path.join(root, 'Starcraft-test');
  const target = path.join(root, 'Starcraft');
  const tracked = execFileSync('git', ['ls-files', '-z', '--', 'Starcraft-test/'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);
  await validatePackage(source);
  const readVersion = async directory =>
    JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8')).version;
  const version = Math.max(await readVersion(source), await readVersion(target)) + 1;
  const temporary = await mkdtemp(path.join(root, '.publish-'));
  const staged = path.join(temporary, 'Starcraft');
  const backup = path.join(temporary, 'previous');
  try {
    for (const file of tracked) {
      const input = path.join(root, file);
      const output = path.join(staged, path.relative(source, input));
      await mkdir(path.dirname(output), { recursive: true });
      if (file.endsWith('.json')) {
        await writeFile(output, liveDataUrls(await readFile(input, 'utf8')));
      } else {
        await copyFile(input, output);
      }
    }
    for (const filename of ['manifest.json', 'version.json']) {
      const file = path.join(staged, filename);
      const data = JSON.parse(await readFile(file, 'utf8'));
      data.version = version;
      await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
    }
    await validatePackage(staged);
    await rename(target, backup);
    try {
      await rename(staged, target);
    } catch (error) {
      await rename(backup, target);
      throw error;
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  return version;
}
