import { cp, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
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
  await validatePackage(source);
  const readVersion = async directory =>
    JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8')).version;
  const version = Math.max(await readVersion(source), await readVersion(target)) + 1;
  const temporary = await mkdtemp(path.join(root, '.publish-'));
  const staged = path.join(temporary, 'Starcraft');
  const backup = path.join(temporary, 'previous');
  try {
    await cp(source, staged, { recursive: true });
    async function prepare(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) await prepare(filename);
        else if (entry.name.endsWith('.json')) {
          const text = await readFile(filename, 'utf8');
          await writeFile(filename, liveDataUrls(text));
        }
      }
    }
    await prepare(staged);
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
