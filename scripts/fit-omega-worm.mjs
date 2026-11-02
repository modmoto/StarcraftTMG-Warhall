import { readFile, writeFile } from 'node:fs/promises';
import { sourceGeometry } from '../src/models/render-thumbnail.mjs';
import { bounds } from '../src/models/calibration.mjs';

// The emerged OBJ is the full body, not the two flat Omega Worm ground-marker meshes.
const inventory = JSON.parse(await readFile('tts-model-sources.json'));
const source = inventory.models.find(m => m.name === 'nydus' && m.workshopId === '3662791369');
if (!source?.customMesh?.MeshURL) throw new Error('Emerged Nydus source missing');
const model = {
  sourceName: 'nydus (emerged body)',
  workshopId: source.workshopId,
  guid: source.guid,
  meshUrl: source.customMesh.MeshURL,
  textureUrl: source.customMesh.DiffuseURL,
  ttsTransform: source.transform,
};
const { geometry } = await sourceGeometry({
  modelUrl: model.meshUrl,
  textureUrl: model.textureUrl,
});
const points = geometry.flatMap(mesh => mesh.vertices);
const box = bounds(points);
const center = [0, 2].map(axis => (box.min[axis] + box.max[axis]) / 2);
const radius = Math.max(...points.map(p => Math.hypot(p[0] - center[0], p[2] - center[1])));
const diameterMm = 80,
  marginMm = 2;
const multiplier = (diameterMm / 2 - marginMm) / 10 / radius;
const layout = {
  size: multiplier / 2.54,
  position: [-center[0] * multiplier, -box.min[1] * multiplier + 0.01, -center[1] * multiplier],
  rotation: [0, 0, 0],
};
const notes =
  'Emerged TTS Nydus OBJ body. All vertices, including ground spikes, fit within the 80 mm round base with a 2 mm radial margin; original Zerg texture.';
const adjustments = JSON.parse(await readFile('model-adjustments.json'));
adjustments['Omega Worm'] = { model, layout, notes };
await writeFile('model-adjustments.json', JSON.stringify(adjustments, null, 2) + '\n');
const selections = JSON.parse(await readFile('model-selections.json'));
const selected = selections.models.find(m => m.unitName === 'Omega Worm');
Object.assign(selected, { model, layout, notes, pose: 'emerged', status: 'selected' });
delete selected.attachments;
await writeFile('model-selections.json', JSON.stringify(selections, null, 2) + '\n');
const report = {
  profileId: 'pdf_Zerg_profile_omega_worm',
  baseDiameterMm: diameterMm,
  radialMarginMm: marginMm,
  maximumRadiusMm: radius * multiplier * 10,
  heightMm: box.size[1] * multiplier * 10,
  modelUrl: model.meshUrl,
  layout,
};
await writeFile('omega-worm-fit-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
