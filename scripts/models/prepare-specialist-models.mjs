import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { readJson, writeJson, sha256 } from '../../src/io.mjs';
import { projectRoot } from '../../src/paths.mjs';
import { modelAssetBaseUrl } from '../../src/urls.mjs';
import { sourceGeometry, renderGeometry } from '../../src/models/render-thumbnail.mjs';
import { encodeGlb } from '../../src/models/portable-glb.mjs';
import { transformPoint, bounds } from '../../src/models/calibration.mjs';
import { factionTexture } from '../../src/models/faction-colors.mjs';

const source = await readJson(path.join(projectRoot, 'specialist-model-sources.json'));
const options = await readJson(path.join(projectRoot, 'Starcraft/options.json'));
const directory = path.join(projectRoot, 'model-assets');
await mkdir(directory, { recursive: true });
await mkdir(path.join(projectRoot, '.cache/specialist-previews'), { recursive: true });
const entries = [];
function local(point, t) {
  return transformPoint(
    point.map((v, i) => v * t[['scaleX', 'scaleY', 'scaleZ'][i]]),
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
  const option = options.find(o => o.Name.toLowerCase() === model.optionName.toLowerCase());
  if (option?.Type !== 4)
    throw new Error(`Not a native single-model specialist: ${model.optionName}`);
  const units = await readJson(path.join(projectRoot, 'Starcraft', model.faction, 'units.json'));
  const profileId = units.find(u => u.Id === model.unitId)?.BasicProfileIds[0];
  if (!profileId) throw new Error(`Unknown specialist unit: ${model.unitId}`);
  const geometry = [];
  // Library root position/rotation is table placement. Keep its scale and all child transforms.
  const root = { ...model.root.Transform, posX: 0, posY: 0, posZ: 0, rotX: 0, rotY: 0, rotZ: 0 };
  async function visit(object, parents = []) {
    const mesh = object.CustomMesh;
    const bundle = object.CustomAssetbundle;
    // The library root mesh is the decorative TTS base. Warhall supplies the base.
    if (object !== model.root && (mesh?.MeshURL || bundle?.AssetbundleURL)) {
      const { geometry: meshes } = await sourceGeometry({
        modelUrl: mesh?.MeshURL || bundle.AssetbundleURL,
        textureUrl: mesh?.DiffuseURL || undefined,
      });
      const transforms = object === model.root ? [root] : [object.Transform, ...parents];
      const determinant = transforms.reduce((v, t) => v * t.scaleX * t.scaleY * t.scaleZ, 1);
      for (const mesh of meshes) {
        if (!mesh.texture) throw new Error(`Missing texture: ${object.GUID}`);
        geometry.push({
          ...mesh,
          vertices: mesh.vertices.map(point => {
            if (object.authoredBundleScale)
              point = point.map((v, i) => v * object.authoredBundleScale[i]);
            for (const t of transforms) point = local(point, t);
            return point.map((v, i) => v * 2.54 + (object.reviewedMeshOffsetCm?.[i] ?? 0));
          }),
          faces: determinant < 0 ? mesh.faces.map(f => [...f].reverse()) : mesh.faces,
          textureFaces:
            determinant < 0 ? mesh.textureFaces.map(f => [...f].reverse()) : mesh.textureFaces,
          texture:
            model.faction === 'Zerg' ? mesh.texture : factionTexture(mesh.texture, model.faction),
        });
      }
    }
    for (const child of object.ChildObjects ?? [])
      await visit(child, [object === model.root ? root : object.Transform, ...parents]);
  }
  await visit(model.root);
  const minY = bounds(geometry.flatMap(m => m.vertices)).min[1];
  for (const mesh of geometry) mesh.vertices = mesh.vertices.map(([x, y, z]) => [x, y - minY, z]);
  const bytes = await encodeGlb(geometry);
  const filename = sha256(bytes) + '.glb';
  await writeFile(path.join(directory, filename), bytes);
  const previewGeometryFile = `model-assets/${filename}.preview.json`;
  await writeJson(
    path.join(projectRoot, previewGeometryFile),
    await Promise.all(
      geometry.map(async m => ({
        ...m,
        texture: {
          png: (
            await sharp(m.texture.data, {
              raw: { width: m.texture.width, height: m.texture.height, channels: 4 },
            })
              .png()
              .toBuffer()
          ).toString('base64'),
        },
      })),
    ),
  );
  const thumbnailFile = `.cache/specialist-previews/${model.root.GUID}.png`;
  await writeFile(path.join(projectRoot, thumbnailFile), await renderGeometry(geometry));
  entries.push({
    profileId: `${profileId}__specialist_${model.root.GUID}`,
    assignmentProfileId: profileId,
    selectedOptions: [option.Id],
    name: `${model.faction} - Specialist - ${model.optionName}`,
    kind: 'specialist',
    thumbnailFile,
    parts: [
      {
        modelUrl: `${modelAssetBaseUrl}/${filename}`,
        textureUrl: null,
        previewGeometryFile,
        hostedAsset: true,
        transforms: {
          scale: 1 / 2.54,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          positionX: 0,
          positionY: 0,
          positionZ: 0,
        },
      },
    ],
  });
  console.log(
    `${model.optionName}: ${geometry.length} meshes, ${bounds(geometry.flatMap(m => m.vertices))
      .size.map(v => (v * 10).toFixed(1))
      .join(' x ')} mm`,
  );
}
await writeJson(path.join(projectRoot, 'specialist-models.json'), {
  workshopId: source.workshopId,
  entries,
});
