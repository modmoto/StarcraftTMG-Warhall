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
// The two mirrored L ruins are authored diagonally in their OBJ coordinates.
// Align their main wall runs with the base edges; retain all other footprints.
const footprintYaws = new Map([
  ['Wall Set 4', 25],
  ['Wall Set 5', -25],
]);
const turn = ([x, y, z], degrees) => {
  const a = (degrees * Math.PI) / 180;
  return [Math.cos(a) * x + Math.sin(a) * z, y, -Math.sin(a) * x + Math.cos(a) * z];
};
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
  const [sx, sy, sz] = asset.ttsScale;
  const size = Math.max(Math.abs(sx), Math.abs(sz));
  const parts = [
    { meshUrl: asset.meshUrl, textureUrl: asset.textureUrl },
    ...(asset.attachments ?? []),
  ];
  const vertices = [],
    layouts = [],
    hashes = [];
  for (const part of parts) {
    const bytes = await download(part.meshUrl, '.obj');
    const texture = await download(part.textureUrl, '.texture');
    const raw = bytes
      .toString()
      .split(/\r?\n/)
      .filter(s => s.startsWith('v '))
      .map(s => s.trim().split(/\s+/).slice(1, 4).map(Number));
    assert.ok(
      raw.length > 3 && raw.every(v => v.every(Number.isFinite)),
      `Invalid OBJ: ${asset.name}`,
    );
    const t = part.transform;
    const partSize = size * (t ? Math.max(Math.abs(t.scaleX), Math.abs(t.scaleZ)) : 1);
    const angle = ((t?.rotY ?? 0) * Math.PI) / 180;
    const rx = ((t?.rotX ?? 0) * Math.PI) / 180;
    const rz = ((t?.rotZ ?? 0) * Math.PI) / 180;
    const offset = [t?.posX ?? 0, t?.posY ?? 0, t?.posZ ?? 0].map(v => v * size);
    for (const [x, y, z] of raw) {
      // Both TTS and Warhall import OBJ into Unity's mirrored-X coordinates.
      const px = -x * partSize,
        pz = z * partSize;
      const zx = Math.cos(rz) * px - Math.sin(rz) * y * partSize;
      const zy = Math.sin(rz) * px + Math.cos(rz) * y * partSize;
      const xy = Math.cos(rx) * zy - Math.sin(rx) * pz;
      const xz = Math.sin(rx) * zy + Math.cos(rx) * pz;
      vertices.push([
        Math.cos(angle) * zx + Math.sin(angle) * xz + offset[0],
        xy + offset[1],
        -Math.sin(angle) * zx + Math.cos(angle) * xz + offset[2],
      ]);
    }
    layouts.push({
      size: partSize,
      position: offset.map(v => v * 2.54),
      rotation: [t?.rotX ?? 0, t?.rotY ?? 0, t?.rotZ ?? 0],
    });
    hashes.push({ meshSha256: sha256(bytes), textureSha256: sha256(texture) });
  }
  const footprintYaw = footprintYaws.get(asset.name) ?? 0;
  const alignedVertices = vertices.map(v => turn(v, footprintYaw));
  for (const layout of layouts) {
    layout.position = turn(layout.position, footprintYaw);
    layout.rotation[1] += footprintYaw;
  }
  const lo = [0, 1, 2].map(i => Math.min(...alignedVertices.map(v => v[i])));
  const hi = [0, 1, 2].map(i => Math.max(...alignedVertices.map(v => v[i])));
  const center = [(lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2];
  centers.set(asset.id, { center, footprintYaw });
  const shift = [-center[0] * 2.54, 0.03 - lo[1] * 2.54, -center[1] * 2.54];
  for (const layout of layouts) layout.position = layout.position.map((v, i) => v + shift[i]);
  terrains.push({
    Id: asset.id,
    Name: asset.name,
    Type: 'Terrain',
    Description: `StarCraft terrain: ${asset.name}. Official PDF map placements; complete TTS assembly. Resolve cover, elevation and movement using the rulebook.`,
    Width: Math.max((hi[0] - lo[0]) * 2.54, 1),
    Length: Math.max((hi[2] - lo[2]) * 2.54, 1),
    Height: Math.max((hi[1] - lo[1]) * 2.54, 0.1),
    Shape: 0,
  });
  models.push({
    terrainId: asset.id,
    unitName: `Terrain - ${asset.name} - ${asset.id.slice(-6)}`,
    status: 'selected',
    model: { meshUrl: asset.meshUrl, textureUrl: asset.textureUrl, ttsTransform: { scaleY: size } },
    layout: layouts[0],
    attachments: parts.slice(1).map((p, i) => ({
      meshUrl: p.meshUrl,
      textureUrl: p.textureUrl,
      ttsTransform: { scaleY: layouts[i + 1].size },
      layout: layouts[i + 1],
    })),
  });
  assetReport.push({
    id: asset.id,
    name: asset.name,
    parts: hashes,
    sourceScale: asset.ttsScale,
    renderScale: size,
    footprintYaw,
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
    const {
      center: [cx, cz],
      footprintYaw,
    } = centers.get(item.id);
    const rotation = (Math.round(item.rotation) - footprintYaw + 360) % 360;
    const angle = (rotation * Math.PI) / 180;
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
