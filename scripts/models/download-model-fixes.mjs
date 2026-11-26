import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = '.cache/tts-fixes';
await mkdir(root, { recursive: true });
const { models } = JSON.parse(await readFile('tts-model-sources.json', 'utf8'));
const wanted = new Set([
  'Adept',
  'Jim Raynor (ComRifle)',
  'Nova (Assault)',
  'Medic',
  'Sentry',
  'High Templar',
  'Twilight Templar',
  'Omega Worm',
  'Vile',
  'Zergling ',
  'Zergling',
  'Zeratul',
]);
const entries = [];
const seen = new Set();
for (const model of models) {
  const url = model.customAssetbundle?.AssetbundleURL;
  if (!wanted.has(model.name) || !url || seen.has(url)) continue;
  seen.add(url);
  entries.push({
    ...model,
    file: `${root}/${createHash('sha256').update(url).digest('hex').slice(0, 20)}.unity3d`,
  });
}
await writeFile(`${root}/bundles.json`, JSON.stringify(entries, null, 2) + '\n');
const secondary = [
  ...new Map(entries.map(e => [e.customAssetbundle.AssetbundleSecondaryURL, e])).values(),
]
  .filter(e => e.customAssetbundle.AssetbundleSecondaryURL)
  .map(e => ({
    ...e,
    name: e.name + ' materials',
    file: `${root}/${createHash('sha256').update(e.customAssetbundle.AssetbundleSecondaryURL).digest('hex').slice(0, 20)}.unity3d`,
    customAssetbundle: { AssetbundleURL: e.customAssetbundle.AssetbundleSecondaryURL },
  }));
await writeFile(`${root}/materials.json`, JSON.stringify(secondary, null, 2) + '\n');
const queue = [...entries, ...secondary];
const failures = [];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const entry = queue.shift();
      try {
        try {
          await access(entry.file);
          continue;
        } catch {}
        const response = await fetch(entry.customAssetbundle.AssetbundleURL, {
          signal: AbortSignal.timeout(60000),
        });
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!bytes.subarray(0, 8).toString().startsWith('Unity')) throw Error('Not a Unity bundle');
        await writeFile(entry.file, bytes);
        console.log(`${entry.name}: ${bytes.length} bytes`);
      } catch (error) {
        failures.push({ name: entry.name, error: error.message });
      }
    }
  }),
);
console.log({ bundles: entries.length, failures });
if (failures.length) process.exitCode = 1;
