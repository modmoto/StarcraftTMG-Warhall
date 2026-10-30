import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Extract references only: no meshes, textures or bundles are downloaded.
const [directory, output = 'tts-model-sources.json'] = process.argv.slice(2);
if (!directory) {
  throw new Error('Usage: node scripts/extract-tts-models.mjs TTS_WORKSHOP_DIRECTORY [OUTPUT]');
}

const packs = {
  Table: '3662791369',
  Protoss: '3662780188',
  Terran: '3662783278',
  Zerg: '3662781729',
};
const models = [];
for (const [faction, workshopId] of Object.entries(packs)) {
  const save = JSON.parse(await readFile(path.join(directory, `${workshopId}.json`), 'utf8'));
  const seen = new Set();
  function visit(value, parentName = '') {
    if (!value || typeof value !== 'object') return;
    const name = value.Nickname || parentName;
    const mesh = value.CustomMesh;
    const bundle = value.CustomAssetbundle;
    if (mesh?.MeshURL || bundle?.AssetbundleURL) {
      const model = {
        faction,
        name,
        workshopId,
        guid: value.GUID,
        transform: value.Transform,
        ...(mesh ? { customMesh: mesh } : {}),
        ...(bundle ? { customAssetbundle: bundle } : {}),
      };
      const key = JSON.stringify([name, mesh, bundle, value.Transform]);
      if (!seen.has(key)) {
        models.push(model);
        seen.add(key);
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'CustomMesh' || key === 'CustomAssetbundle' || key === 'Transform') continue;
      if (Array.isArray(child)) child.forEach(item => visit(item, name));
      else if (child && typeof child === 'object') visit(child, name);
    }
  }
  visit(save);
}

await writeFile(
  output,
  JSON.stringify(
    {
      source: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3662791369',
      status:
        'Source inventory; not a Warhall model configuration. Variants require explicit mapping.',
      models,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Extracted ${models.length} model references to ${output}`);
