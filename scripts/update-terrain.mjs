import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { sha256, readJson, writeJson } from '../src/io.mjs';
import { projectRoot } from '../src/paths.mjs';
const flags = process.argv.slice(2);
assert.ok(
  flags.every(f => ['--offline', '--check'].includes(f)),
  'Unknown flag',
);
const offline = flags.includes('--offline') || flags.includes('--check'),
  check = flags.includes('--check');
const source = await readJson(path.join(projectRoot, 'terrain-sources.json'));
const cache = path.join(projectRoot, '.cache', 'terrain');
await mkdir(cache, { recursive: true });
const models = [],
  terrains = [],
  assetReport = [];
const centers = new Map();
async function download(url, extension) {
  const file = path.join(cache, sha256(url) + extension);
  try {
    return await readFile(file);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    if (offline) throw Error(`Missing cached terrain: ${url}`);
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  assert.ok(response.ok, `Terrain download failed ${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(file, bytes);
  return bytes;
}
for (const asset of source.assets) {
  const bytes = await download(asset.meshUrl, '.obj');
  const texture = await download(asset.textureUrl, '.texture');
  const vertices = bytes
    .toString()
    .split(/\r?\n/)
    .filter(s => s.startsWith('v '))
    .map(s => s.trim().split(/\s+/).slice(1, 4).map(Number));
  assert.ok(vertices.length > 3, `Not an OBJ mesh: ${asset.name}`);
  const lo = [0, 1, 2].map(i => Math.min(...vertices.map(v => v[i]))),
    hi = [0, 1, 2].map(i => Math.max(...vertices.map(v => v[i])));
  const [sx, sy, sz] = asset.ttsScale,
    size = Math.max(Math.abs(sx), Math.abs(sz));
  // TriLib's OBJ import mirrors X. Center the Warhall footprint beneath the
  // rendered geometry, compensating each map placement so the model stays put.
  const center = [(-(lo[0] + hi[0]) * size) / 2, ((lo[2] + hi[2]) * size) / 2];
  centers.set(asset.id, center);
  const width = (hi[0] - lo[0]) * size * 2.54,
    length = (hi[2] - lo[2]) * size * 2.54,
    height = (hi[1] - lo[1]) * size * 2.54;
  terrains.push({
    Id: asset.id,
    Name: asset.name,
    Type: 'Terrain',
    Description: `StarCraft terrain: ${asset.name}. Official PDF map placements; TTS model. Resolve cover, elevation and movement using the rulebook.`,
    Width: Math.max(width, 1),
    Length: Math.max(length, 1),
    Height: Math.max(height, 0.1),
    Shape: 0,
  });
  models.push({
    terrainId: asset.id,
    unitName: `Terrain - ${asset.name} - ${asset.id.slice(-6)}`,
    status: 'selected',
    model: { meshUrl: asset.meshUrl, textureUrl: asset.textureUrl, ttsTransform: { scaleY: size } },
    layout: {
      size,
      position: [-center[0] * 2.54, 0.03 - lo[1] * size * 2.54, -center[1] * 2.54],
      rotation: [0, 0, 0],
    },
  });
  assetReport.push({
    id: asset.id,
    name: asset.name,
    meshSha256: sha256(bytes),
    textureSha256: sha256(texture),
    sourceScale: asset.ttsScale,
    renderScale: size,
    bounds: { lo, hi },
    note:
      Math.abs(sx - sy) > 0.01 || Math.abs(sz - sy) > 0.01
        ? 'Warhall remote skins use uniform scale; horizontal footprint prioritized.'
        : 'Uniform source scale retained.',
  });
}
const maps = source.maps.map(m => ({
  Id: `sc_map_${m.number}`,
  Name: m.name,
  MapName: m.name,
  Items: m.items.map(item => {
    const rotation = Math.round(item.rotation) % 360;
    const angle = (rotation * Math.PI) / 180;
    const [cx, cz] = centers.get(item.id);
    const x = item.x + Math.cos(angle) * cx + Math.sin(angle) * cz;
    const z = item.z - Math.sin(angle) * cx + Math.cos(angle) * cz;
    return {
      Id: item.id,
      Quadrant: 1,
      Rotation: rotation,
      ShortSide: 27 - x,
      LongSide: 18 + z,
      Type: 'Terrain',
    };
  }),
}));
const target = path.join(projectRoot, 'Starcraft'),
  existing = await readJson(path.join(target, 'terrains.json'));
const files = new Map([
  [
    path.join(target, 'terrains.json'),
    [...existing.filter(t => !t.Id.startsWith('sc_terrain_')), ...terrains].sort((a, b) =>
      a.Id.localeCompare(b.Id, 'en'),
    ),
  ],
  [path.join(target, 'maps.json'), maps],
  [path.join(projectRoot, 'terrain-models.json'), { source: source.source, models }],
  [
    path.join(projectRoot, 'terrain-report.json'),
    {
      source: source.source,
      maps: source.maps.map(m => ({ name: m.name, pdfPage: m.pdfPage, pieces: m.items.length })),
      assets: assetReport,
    },
  ],
]);
const manifest = await readJson(path.join(target, 'manifest.json'));
manifest.files = [...new Set([...manifest.files, 'maps.json'])].sort();
files.set(path.join(target, 'manifest.json'), manifest);
for (const [file, data] of files) {
  const bytes = Buffer.from(JSON.stringify(data, null, 2) + '\n');
  if (check) assert.ok((await readFile(file)).equals(bytes), `Stale terrain data: ${file}`);
  else await writeFile(file, bytes);
}
console.log(
  `${check ? 'Verified' : 'Updated'} ${maps.length} official maps, ${terrains.length} terrain variants. Models reference TTS CDN URLs; no model binaries are committed.`,
);
