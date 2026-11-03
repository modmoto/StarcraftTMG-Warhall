import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { projectRoot } from '../src/paths.mjs';
import { renderGeometry, sourceGeometry } from '../src/models/render-thumbnail.mjs';

const output = path.resolve(
  process.argv[2] ?? path.join(projectRoot, 'Starcraft-test/assets/terrain-overhead'),
);
const read = async file => JSON.parse(await readFile(path.join(projectRoot, file), 'utf8'));
const [catalogue, terrains] = await Promise.all([
  read('model-catalogue.json'),
  read('Starcraft-test/terrains.json'),
]);
await mkdir(output, { recursive: true });
const images = {};
for (const entry of catalogue.entries.filter(entry => entry.kind === 'terrain')) {
  const terrain = terrains.find(
    terrain => terrain.Id === entry.profileId || terrain.Id === entry.name,
  );
  if (!terrain) throw new Error(`Missing footprint for ${entry.name}`);
  const { geometry } = await sourceGeometry(entry.parts[0]);
  const { Width: width, Length: length } = terrain;
  const size = 512;
  const projection = {
    size,
    topDown: true,
    transparent: true,
    margin: 0,
    frame: [-width / 2, -length / 2, width / 2, length / 2],
  };
  let square = await renderGeometry(geometry, projection);
  // Keep the overhead texture only where the wall occupies the lowest centimetre.
  if (/^Wall Set [12]$/.test(terrain.Name)) {
    const footprint = await renderGeometry(geometry, { ...projection, maxHeight: 1 });
    square = await sharp(square)
      .composite([{ input: footprint, blend: 'dest-in' }])
      .png()
      .toBuffer();
  }
  const scale = size / Math.max(width, length);
  const w = Math.round(width * scale);
  const h = Math.round(length * scale);
  const filename = terrain.Name.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase();
  images[terrain.Id] = `${filename}.png`;
  await writeFile(
    path.join(output, `${filename}.png`),
    await sharp(square)
      .extract({
        left: Math.floor((size - w) / 2),
        top: Math.floor((size - h) / 2),
        width: w,
        height: h,
      })
      .png()
      .toBuffer(),
  );
}
await writeFile(path.join(output, 'index.json'), JSON.stringify(images, null, 2) + '\n');
