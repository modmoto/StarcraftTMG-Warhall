import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const output = '.cache/tts-preview';
await mkdir(output, { recursive: true });
const inventory = JSON.parse(await readFile('tts-model-sources.json', 'utf8'));
const unitName =
  /marine|marauder|raynor|raider|medic|goliath|nova|siege tank|raven|drone|turret|adept|zealot|artanis|stalker|sentry|praetor|tassadar|immortal|templar|watcher|zeratul|kerrigan|zergling|swarmling|roachling|vileling|queen|ravager|hydralisk|roach|corpser|defiler|omega worm|nydus|pylon|holo decoy|zagara|bile launcher|raptor|^vile$/i;
let previous = [];
try {
  previous = JSON.parse(await readFile(`${output}/candidates.json`, 'utf8'));
} catch {}
const previousIds = new Map(
  previous.map(model => [
    JSON.stringify([model.customMesh.MeshURL, model.customMesh.DiffuseURL]),
    model.id,
  ]),
);
let nextId = Math.max(0, ...previous.map(model => model.id)) + 1;
const candidates = [];
const seen = new Set();
const assets = new Map();
function asset(url, extension) {
  if (!url) return null;
  const file = `${output}/${createHash('sha256').update(url).digest('hex').slice(0, 20)}.${extension}`;
  assets.set(url, file);
  return file;
}
for (const model of inventory.models) {
  if (!unitName.test(model.name) || /token|ghost|shade/i.test(model.name)) continue;
  const mesh = model.customMesh;
  if (!mesh?.MeshURL) continue;
  const key = JSON.stringify([mesh.MeshURL, mesh.DiffuseURL]);
  if (seen.has(key)) continue;
  seen.add(key);
  candidates.push({
    id: previousIds.get(key) ?? nextId++,
    ...model,
    meshFile: asset(mesh.MeshURL, 'obj'),
    textureFile: asset(mesh.DiffuseURL, 'texture'),
  });
}
await writeFile(`${output}/candidates.json`, JSON.stringify(candidates, null, 2) + '\n');
const queue = [...assets];
const failures = [];
let completed = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const [url, file] = queue.shift();
      try {
        try {
          await access(file);
          completed++;
          continue;
        } catch {}
        const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await writeFile(file, Buffer.from(await response.arrayBuffer()));
        completed++;
        if (completed % 20 === 0) console.log(`Cached ${completed}/${assets.size} assets`);
      } catch (error) {
        failures.push({ url, file, error: error.message });
      }
    }
  }),
);
await writeFile(`${output}/failures.json`, JSON.stringify(failures, null, 2));
console.log(
  `${candidates.length} candidates; ${completed}/${assets.size} assets cached; ${failures.length} failures`,
);
if (failures.length) process.exitCode = 1;
