import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { projectRoot } from '../src/paths.mjs';
import { sourceGeometry, renderGeometry } from '../src/models/render-thumbnail.mjs';
import { rotate } from '../src/terrain/geometry.mjs';

const output = path.resolve(process.argv[2] ?? path.join(projectRoot, '.cache', 'terrain-review'));
await mkdir(output, { recursive: true });
const read = async file => JSON.parse(await readFile(path.join(projectRoot, file), 'utf8'));
const maps = await read('Starcraft/maps.json'),
  catalogue = await read('model-catalogue.json');
const terrains = await read('Starcraft/terrains.json');
const meshes = new Map();
for (const entry of catalogue.entries.filter(e => e.kind === 'terrain')) {
  meshes.set(entry.profileId, (await sourceGeometry(entry.parts[0])).geometry);
}
for (const [i, map] of maps.entries()) {
  const world = [];
  for (const item of map.Items)
    for (const mesh of meshes.get(item.Id)) {
      world.push({
        ...mesh,
        vertices: mesh.vertices.map(vertex => {
          const [x, y, z] = rotate(vertex, [0, item.Rotation, 0]);
          return [x + (27 - item.ShortSide) * 2.54, y + 0.03, z + (item.LongSide - 18) * 2.54];
        }),
      });
    }
  const size = 1296;
  const png = await renderGeometry(world, {
    size,
    topDown: true,
    frame: [-68.58, -45.72, 68.58, 45.72],
    margin: 0,
  });
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1296" height="864">`;
  for (let x = 0; x <= 54; x += 6)
    svg += `<line x1="${x * 24}" y1="0" x2="${x * 24}" y2="864" stroke="white" opacity=".4" stroke-dasharray="5 6"/>`;
  for (let z = 0; z <= 36; z += 6)
    svg += `<line x1="0" y1="${z * 24}" x2="1296" y2="${z * 24}" stroke="white" opacity=".4" stroke-dasharray="5 6"/>`;
  svg += '</svg>';
  await sharp(png)
    .extract({ left: 0, top: 216, width: 1296, height: 864 })
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toFile(path.join(output, `map-${i + 1}.png`));
  let bases = '<svg xmlns="http://www.w3.org/2000/svg" width="1296" height="864">';
  for (const item of map.Items) {
    const terrain = terrains.find(terrain => terrain.Id === item.Id);
    const x = (54 - item.ShortSide) * 24,
      y = (36 - item.LongSide) * 24;
    const w = (terrain.Width / 2.54) * 24,
      h = (terrain.Length / 2.54) * 24;
    bases += `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" transform="rotate(${item.Rotation} ${x} ${y})" fill="none" stroke="#39d5bc" stroke-width="1.5" opacity=".8"/>`;
  }
  bases += '</svg>';
  await sharp(path.join(output, `map-${i + 1}.png`))
    .composite([{ input: Buffer.from(bases) }])
    .png()
    .toFile(path.join(output, `map-${i + 1}-bases.png`));
  console.log(`Reviewed ${map.Name}`);
}
const references = await Promise.all(
  maps.map((_, i) =>
    access(path.join(output, `reference-${i + 1}.png`)).then(
      () => true,
      () => false,
    ),
  ),
);
const sections = maps
  .map((map, i) => {
    const reference = references[i] ? `<img src="reference-${i + 1}.png" alt="PDF reference">` : '';
    return `<section><h2>${map.Name}</h2><div class="${reference ? 'pair' : 'single'}">${reference}<img class="render" data-map="${i + 1}" src="map-${i + 1}.png"></div></section>`;
  })
  .join('');
await writeFile(
  path.join(output, 'index.html'),
  `<!doctype html>
<meta charset="utf-8">
<title>Terrain layout review</title>
<style>
body{background:#19232e;color:white;font:16px sans-serif;max-width:1600px;margin:2em auto}
img{width:100%}.pair{display:grid;grid-template-columns:1fr 1fr;gap:1em}label{display:block;margin:1em 0}
</style>
<h1>PDF-calibrated terrain layouts</h1>
<p>Dashed lines mark the official six-inch grid. Footprints are raster-calibrated estimates; heights retain the authored model scales. PDF references, when provided, appear on the left.</p>
<label><input type="checkbox" id="bases"> Show selection-base outlines</label>
${sections}
<script>
document.querySelector('#bases').addEventListener('change',event=>{
  for(const image of document.querySelectorAll('.render')){
    image.src='map-'+image.dataset.map+(event.target.checked?'-bases':'')+'.png';
  }
});
</script>`,
);
