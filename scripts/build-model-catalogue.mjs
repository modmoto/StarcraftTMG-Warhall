import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from '../src/paths.mjs';
import { transforms, validateCatalogue } from '../src/models/catalogue.mjs';
import { nativeMarkers } from '../src/deployments/markers.mjs';

const read = async file => JSON.parse(await readFile(path.join(projectRoot, file), 'utf8'));
const units = await read('model-selections.json');
const terrain = await read('terrain-models.json');
const entries = [];
for (const selection of [...units.models, ...terrain.models].filter(m => m.status === 'selected')) {
  let profileId = selection.terrainId ?? selection.tokenId;
  if (!profileId) {
    const faction = await read(`Starcraft/${selection.faction}/units.json`);
    const unit = faction.find(unit => unit.Id === selection.unitId);
    if (unit?.BasicProfileIds.length !== 1) throw new Error(`Unknown unit: ${selection.unitName}`);
    [profileId] = unit.BasicProfileIds;
  }
  entries.push({
    profileId,
    name: `Starcraft - ${selection.unitName}`,
    kind: selection.terrainId ? 'terrain' : 'unit',
    parts: [selection.model, ...(selection.attachments ?? [])].map(part => ({
      modelUrl: part.meshUrl,
      textureUrl: part.textureUrl ?? null,
      transforms: transforms(part.layout ?? selection.layout, part.ttsTransform?.scaleY),
    })),
  });
}
for (const marker of nativeMarkers) {
  entries.push({
    profileId: `sc_mission_${marker.color}`,
    name: `Starcraft - Mission marker ${marker.color}`,
    kind: 'terrain',
    existingSkinId: marker.skinId,
  });
}
const catalogue = validateCatalogue({
  schemaVersion: 1,
  serverUrl: 'https://apptest.warhall.eu',
  gameName: 'Starcraft',
  entries,
});
await writeFile(
  path.join(projectRoot, 'model-catalogue.json'),
  JSON.stringify(catalogue, null, 2) + '\n',
);
console.log(`Built model-catalogue.json: ${entries.length} shared mappings`);
