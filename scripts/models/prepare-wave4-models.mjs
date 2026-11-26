import path from 'node:path';
import sharp from 'sharp';
import { readJson, writeJson, sha256 } from '../../src/io.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { projectRoot } from '../../src/paths.mjs';
import { modelAssetBaseUrl } from '../../src/urls.mjs';
import { sourceGeometry, renderGeometry } from '../../src/models/render-thumbnail.mjs';
import { encodeGlb } from '../../src/models/portable-glb.mjs';
import { transformPoint, bounds } from '../../src/models/calibration.mjs';
import { factionTexture, redGoldTexture } from '../../src/models/faction-colors.mjs';

const source = await readJson(path.join(projectRoot, 'wave4-model-sources.json'));
const selections = await readJson(path.join(projectRoot, 'model-selections.json'));
const report = [];
const apply = process.argv.slice(2).includes('--apply');
if (process.argv.slice(2).some(flag => flag !== '--apply'))
  throw new Error('Use --apply to save reviewed model selections');
const directory = path.join(projectRoot, 'model-assets');
const previews = path.join(projectRoot, '.cache/wave4-model-previews');
await mkdir(directory, { recursive: true });
await mkdir(previews, { recursive: true });

function local(point, t) {
  return transformPoint(
    point.map((value, axis) => value * t[['scaleX', 'scaleY', 'scaleZ'][axis]]),
    {
      scale: 1,
      rotationX: t.rotX,
      rotationY: t.rotY,
      rotationZ: t.rotZ,
      positionX: t.posX,
      positionY: t.posY,
      positionZ: t.posZ,
    },
  );
}

for (const model of source.models) {
  if (model.reuseUnitId) {
    const normal = selections.models.find(entry => entry.unitId === model.reuseUnitId);
    if (!normal) throw new Error('Missing source model ' + model.reuseUnitId);
    const { geometry: meshes } = await sourceGeometry({
      modelUrl: normal.model.meshUrl,
      textureUrl: normal.model.textureUrl,
    });
    const texture = redGoldTexture(factionTexture(meshes[0].texture, 'Protoss'));
    const png = await sharp(texture.data, {
      raw: { width: texture.width, height: texture.height, channels: 4 },
    })
      .png()
      .toBuffer();
    const filename = sha256(png) + '.png';
    await writeFile(path.join(directory, filename), png);
    const entry = {
      ...structuredClone(normal),
      unitId: model.unitId,
      unitName: model.unitName,
      role: 'Wave 4',
      preserveSourceColors: true,
      notes:
        'Reuse the normal Stalker geometry and reviewed scale; replace its yellow/gold accents with red, retaining neutral pixels.',
      model: { ...structuredClone(normal.model), textureUrl: `${modelAssetBaseUrl}/${filename}` },
    };
    if (apply) {
      const index = selections.models.findIndex(s => s.unitId === model.unitId);
      if (index < 0) selections.models.push(entry);
      else selections.models[index] = entry;
    }
    report.push({
      unitId: model.unitId,
      reusedFrom: normal.unitId,
      sourceGuid: normal.model.guid,
      textureFile: filename,
      meshCount: meshes.length,
    });
    console.log(model.unitName + ': normal Stalker geometry with red gold accents');
    continue;
  }
  const geometry = [];
  const rootScale = ['scaleX', 'scaleY', 'scaleZ'].map(key => model.root.Transform[key]);
  async function visit(object, ancestors = []) {
    if (!object.CustomMesh?.MeshURL)
      throw new Error(`Unsupported Wave 4 source: ${model.unitName}/${object.GUID}`);
    const { geometry: meshes } = await sourceGeometry({
      modelUrl: object.CustomMesh.MeshURL,
      textureUrl: object.CustomMesh.DiffuseURL,
    });
    const transforms = [object.Transform, ...ancestors];
    const determinant = transforms.reduce(
      (product, t) => product * t.scaleX * t.scaleY * t.scaleZ,
      rootScale.reduce((a, b) => a * b),
    );
    for (const mesh of meshes) {
      const vertices = mesh.vertices.map(point => {
        for (const transform of transforms) point = local(point, transform);
        return point.map((value, axis) => value * rootScale[axis] * 2.54);
      });
      geometry.push({
        ...mesh,
        vertices,
        faces: determinant < 0 ? mesh.faces.map(face => [...face].reverse()) : mesh.faces,
        textureFaces:
          determinant < 0 ? mesh.textureFaces.map(face => [...face].reverse()) : mesh.textureFaces,
        texture:
          model.preserveSourceColors || model.faction === 'Zerg'
            ? mesh.texture
            : factionTexture(mesh.texture, model.faction),
      });
    }
    for (const child of object.ChildObjects ?? [])
      await visit(child, [object.Transform, ...ancestors]);
  }
  for (const child of model.root.ChildObjects ?? []) await visit(child);
  if (!geometry.length) throw new Error(`No actual model geometry: ${model.unitName}`);
  const authoredBounds = bounds(geometry.flatMap(mesh => mesh.vertices));
  const groundOffsetCm = authoredBounds.min[1];
  for (const mesh of geometry)
    mesh.vertices = mesh.vertices.map(([x, y, z]) => [x, y - groundOffsetCm, z]);
  const measurements = bounds(geometry.flatMap(mesh => mesh.vertices));
  const bytes = await encodeGlb(geometry);
  const file = `${sha256(bytes)}.glb`;
  const previewGeometryFile = `model-assets/${file}.preview.json`;
  await writeFile(path.join(directory, file), bytes);
  await writeJson(
    path.join(projectRoot, previewGeometryFile),
    await Promise.all(
      geometry.map(async mesh => ({
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
    ),
  );
  await writeFile(path.join(previews, `${model.unitId}.png`), await renderGeometry(geometry));
  const entry = {
    faction: model.faction,
    unitId: model.unitId,
    unitName: model.unitName,
    role: 'Wave 4',
    pose: 'authored TTS pose',
    status: 'selected',
    preserveSourceColors: true,
    notes: `Public Wave 4 table model ${model.root.GUID}; baked actual child geometry and attachments, omitted dummy base.`,
    model: {
      sourceName: model.unitName,
      workshopId: '3662791369',
      guid: model.root.GUID,
      meshUrl: `${modelAssetBaseUrl}/${file}`,
      textureUrl: null,
      hostedAsset: true,
      previewGeometryFile,
    },
    layout: { size: 1 / 2.54, position: [0, 0, 0], rotation: [0, 0, 0] },
  };
  if (apply) {
    const previous = selections.models.findIndex(selection => selection.unitId === model.unitId);
    if (previous >= 0) selections.models[previous] = entry;
    else selections.models.push(entry);
  }
  report.push({
    unitId: model.unitId,
    sourceGuid: model.root.GUID,
    file,
    meshCount: geometry.length,
    sizeMm: measurements.size.map(value => value * 10),
    minimumYmm: measurements.min[1] * 10,
    removedGroundOffsetMm: groundOffsetCm * 10,
  });
  console.log(
    `${model.unitName}: ${geometry.length} meshes, ${measurements.size.map(value => (value * 10).toFixed(1)).join(' × ')} mm`,
  );
}
await writeJson(path.join(projectRoot, 'wave4-model-report.json'), report);
if (apply) await writeJson(path.join(projectRoot, 'model-selections.json'), selections);
