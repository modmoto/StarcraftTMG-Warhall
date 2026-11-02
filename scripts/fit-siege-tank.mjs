import { readFile, writeFile } from 'node:fs/promises';
import { sourceGeometry } from '../src/models/render-thumbnail.mjs';
import { transformPoint } from '../src/models/calibration.mjs';
import { transforms } from '../src/models/catalogue.mjs';

const selections = JSON.parse(await readFile('model-selections.json'));
const adjustments = JSON.parse(await readFile('model-adjustments.json'));
const tank = selections.models.find(m => m.unitName === 'Siege Tank');
const { geometry } = await sourceGeometry({
  modelUrl: tank.model.meshUrl,
  textureUrl: tank.model.textureUrl,
});
const transform = transforms(tank.layout);
transform.scale *= 2.54;
const points = geometry.flatMap(m => m.vertices.map(v => transformPoint(v, transform)));
const radiusMm = Math.max(...points.map(p => Math.hypot(p[0], p[2]))) * 10;
const baseDiameterMm = 150,
  factor = baseDiameterMm / 2 / radiusMm;
const original = tank.layout;
tank.layout = {
  ...original,
  size: original.size * factor,
  position: original.position.map((v, axis) =>
    axis === 1 ? 0.01 + (v - 0.01) * factor : v * factor,
  ),
};
const increasePercent = (tank.layout.size / 1.47 - 1) * 100;
tank.notes = `Deployed siege pose enlarged ${increasePercent.toFixed(1)}% from the reviewed 1.47 baseline. Furthest geometry touches the 150 mm circular base edge; centering and ground clearance preserved.`;
adjustments['Siege Tank'] = {
  ...adjustments['Siege Tank'],
  layout: tank.layout,
  notes: tank.notes,
};
await writeFile('model-selections.json', JSON.stringify(selections, null, 2) + '\n');
await writeFile('model-adjustments.json', JSON.stringify(adjustments, null, 2) + '\n');
await writeFile(
  'siege-tank-fit-report.json',
  JSON.stringify(
    {
      profileId: 'pdf_Terran_profile_siege_tank',
      baseDiameterMm,
      maximumRadiusMm: 75,
      increasePercent,
      layout: tank.layout,
    },
    null,
    2,
  ) + '\n',
);
console.log({ increasePercent, maximumRadiusMm: 75 });
