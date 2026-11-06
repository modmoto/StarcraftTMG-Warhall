import { modelAssetBaseUrl } from '../src/urls.mjs';
import assert from 'node:assert/strict';
import { builtinTerrains } from '../src/terrain/native.mjs';
import { terrainMenuId } from '../src/models/menu-ids.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { sha256, readJson } from '../src/io.mjs';
import { projectRoot, defaultDataDirectory } from '../src/paths.mjs';
import { assembleTerrain } from '../src/terrain/geometry.mjs';
import { encodeGlb } from '../src/models/portable-glb.mjs';
import {
  buildScoreboard,
  scoreboardPlacement,
  scoreboardTerrain,
} from '../src/terrain/scoreboard.mjs';

const flags = process.argv.slice(2);
assert.ok(
  flags.every(flag => ['--offline', '--check'].includes(flag)),
  'Unknown flag',
);
const check = flags.includes('--check'),
  offline = check || flags.includes('--offline');
const source = await readJson(path.join(projectRoot, 'terrain-sources.json'));
const calibration = await readJson(path.join(projectRoot, 'terrain-calibration.json'));
const cache = path.join(projectRoot, '.cache', 'terrain');
await mkdir(cache, { recursive: true });
const files = new Map(),
  models = [],
  terrains = [],
  assets = [];
async function download(url, extension) {
  const file = path.join(cache, sha256(url) + extension);
  try {
    return await readFile(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (offline) throw new Error(`Missing cached terrain: ${url}`);
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  assert.ok(response.ok, `Terrain download failed ${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(file, bytes);
  return bytes;
}
const aliases = calibration.assetAliases ?? {};
const canonicalAsset = id => {
  const asset = source.assets.find(asset => asset.id === (aliases[id] ?? id));
  assert.ok(asset && !aliases[asset.id], `Invalid terrain alias: ${id}`);
  return asset;
};
for (const [id, target] of Object.entries(aliases)) {
  assert.ok(
    source.assets.some(asset => asset.id === id),
    `Unknown terrain alias: ${id}`,
  );
  assert.equal(source.assets.find(asset => asset.id === id).name, canonicalAsset(target).name);
}
// Match the editor: round inches first, then centimeters.
const editorDimension = cm => Math.round(Math.round((cm / 2.54) * 100) * 2.54) / 100;
const raisedObeliskId = 'sc_terrain_temple_obelisk_raised';
const raisedObeliskName = 'Starcraft - Terrain - Temple Obelisk - Raised';
const platformHeightCm = calibration.assets['High Ground'].heightMm / 10;

for (const asset of source.assets.filter(asset => !aliases[asset.id])) {
  const definition = calibration.assets[asset.name];
  assert.ok(definition, `Missing PDF size calibration: ${asset.name}`);
  const parts = [],
    hashes = [];
  for (const part of [asset, ...asset.attachments]) {
    const obj = await download(part.meshUrl, '.obj');
    const bytes = await download(part.textureUrl, '.texture');
    const { data, info } = await sharp(bytes)
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    parts.push({
      obj: obj.toString('utf8'),
      texture: { data, width: info.width, height: info.height },
    });
    hashes.push({ meshSha256: sha256(obj), textureSha256: sha256(bytes) });
  }
  const { meshes, sourceBounds, calibratedBounds } = assembleTerrain(asset, parts, definition);
  const bytes = await encodeGlb(meshes);
  const file = `${sha256(bytes)}.glb`,
    previewGeometryFile = `model-assets/${file}.preview.json`;
  files.set(path.join(projectRoot, 'model-assets', file), bytes);
  const preview = await Promise.all(
    meshes.map(async mesh => ({
      ...mesh,
      texture: {
        png: (
          await sharp(mesh.texture.data, {
            raw: { width: mesh.texture.width, height: mesh.texture.height, channels: 4 },
          })
            .png()
            .toBuffer()
        ).toString('base64'),
      },
    })),
  );
  files.set(path.join(projectRoot, previewGeometryFile), Buffer.from(JSON.stringify(preview)));
  const [width, , length] = calibratedBounds.size;
  terrains.push({
    Id: terrainMenuId(asset),
    Name: asset.name,
    Type: 'Terrain',
    Width: editorDimension(width),
    Length: editorDimension(length),
    Shape: 0,
  });
  models.push({
    terrainId: asset.id,
    unitName: `Terrain - ${asset.name} - ${asset.id.slice(-6)}`,
    status: 'selected',
    calibration: 'pdf-grid-v1',
    sourcePartCount: parts.length,
    model: {
      meshUrl: `${modelAssetBaseUrl}/${definition.colliderBundle ?? file}`,
      textureUrl: null,
      hostedAsset: true,
      previewGeometryFile,
    },
    layout: { size: 1 / 2.54, position: [0, 0.03, 0], rotation: [0, 0, 0] },
    attachments: [],
  });
  assets.push({
    id: asset.id,
    name: asset.name,
    parts: hashes,
    sourceScale: asset.ttsScale,
    footprintYaw: definition.alignmentYaw ?? 0,
    sourceSizeInches: sourceBounds.size,
    calibratedSizeInches: calibratedBounds.size.map(v => v / 2.54),
    policy:
      'Preserve separate parent/attachment XYZ scales, bake attachments into one portable GLB, then fit the reviewed PDF footprint. ' +
      (definition.heightMm === undefined
        ? 'Height retains the authored TTS scale.'
        : `Temporary vertical compression to ${definition.heightMm} mm while imported ramp collision is unavailable.`),
  });
  if (asset.name === 'Temple Obelisk') {
    const raised = meshes.map(mesh => ({
      ...mesh,
      vertices: mesh.vertices.map(([x, y, z]) => [x, y + platformHeightCm, z]),
    }));
    const raisedBytes = await encodeGlb(raised);
    const raisedFile = `${sha256(raisedBytes)}.glb`;
    const raisedPreview = `model-assets/${raisedFile}.preview.json`;
    files.set(path.join(projectRoot, 'model-assets', raisedFile), raisedBytes);
    files.set(
      path.join(projectRoot, raisedPreview),
      Buffer.from(
        JSON.stringify(raised.map((mesh, index) => ({ ...mesh, texture: preview[index].texture }))),
      ),
    );
    const original = models.at(-1);
    models.push({
      ...original,
      terrainId: raisedObeliskId,
      unitName: 'Terrain - Temple Obelisk - Raised',
      model: {
        ...original.model,
        meshUrl: `${modelAssetBaseUrl}/${raisedFile}`,
        previewGeometryFile: raisedPreview,
      },
    });
    terrains.push({ ...terrains.at(-1), Id: raisedObeliskName, Name: 'Temple Obelisk (Raised)' });
  }
}
const scoreboard = await buildScoreboard();
for (const [file, bytes] of scoreboard.files) files.set(path.join(projectRoot, file), bytes);
models.push(scoreboard.model);
terrains.push(scoreboardTerrain);
const maps = source.maps.map(map => ({
  Id: `sc_map_${map.number}`,
  Name: map.name,
  MapName: map.name,
  Items: [
    ...map.items.map(item => {
      const placement = calibration.maps[String(map.number)]?.[item.ttsGuid];
      assert.ok(placement, `Missing reviewed placement: ${map.number}/${item.ttsGuid}`);
      return {
        Id:
          map.number === 5 && canonicalAsset(item.id).name === 'Temple Obelisk'
            ? raisedObeliskName
            : terrainMenuId(canonicalAsset(item.id)),
        Quadrant: 1,
        Rotation: placement.rotation,
        ShortSide: 27 - placement.x,
        LongSide: map.height / 2 + placement.z,
        Type: 'Terrain',
      };
    }),
    scoreboardPlacement(map),
  ],
}));
const target = defaultDataDirectory;
const existing = await readJson(path.join(target, 'terrains.json'));
const json = (file, data) => files.set(file, Buffer.from(JSON.stringify(data, null, 2) + '\n'));
json(
  path.join(target, 'terrains.json'),
  [
    ...existing.filter(
      t =>
        !builtinTerrains.some(native => native.Id === t.Id) &&
        !t.Id.startsWith('sc_terrain_') &&
        !/^Starcraft - Terrain - (?!Mission marker |Deployment - )/.test(t.Id),
    ),
    ...terrains,
    ...builtinTerrains,
  ].sort((a, b) => a.Id.localeCompare(b.Id, 'en')),
);
json(path.join(target, 'maps.json'), maps);
json(path.join(projectRoot, 'terrain-models.json'), {
  source: source.source,
  calibration: 'terrain-calibration.json',
  models,
});
json(path.join(projectRoot, 'terrain-report.json'), {
  source: source.source,
  pdf: calibration.pdf,
  gridInches: 6,
  calibration: 'terrain-calibration.json',
  maps: source.maps.map(map => ({
    name: map.name,
    pdfPage: map.pdfPage,
    pieces: map.items.length,
  })),
  assets,
});
const manifest = await readJson(path.join(target, 'manifest.json'));
manifest.files = [...new Set([...manifest.files, 'maps.json'])].sort();
json(path.join(target, 'manifest.json'), manifest);
for (const [file, bytes] of files) {
  if (check) assert.ok((await readFile(file)).equals(bytes), `Stale terrain data: ${file}`);
  else {
    await mkdir(path.dirname(file), { recursive: true });
    let previous;
    try {
      previous = await readFile(file);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (!previous?.equals(bytes)) await writeFile(file, bytes);
  }
}
console.log(
  `${check ? 'Verified' : 'Updated'} ${maps.length} PDF-grid layouts and ${terrains.length} calibrated portable terrain models.`,
);
