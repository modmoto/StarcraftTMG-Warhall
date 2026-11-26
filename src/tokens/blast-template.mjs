import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { projectRoot } from '../paths.mjs';
import { modelAssetBaseUrl } from '../urls.mjs';
import { encodeGlb } from '../models/portable-glb.mjs';

export const blastTemplateDiameterMm = 130;
export const blastTemplateOrange = [255, 132, 24];
export function blastTemplateGeometry() {
  const radius = blastTemplateDiameterMm / 20,
    inner = radius - 0.2,
    segments = 128;
  const mesh = {
    vertices: [],
    uv: [],
    faces: [],
    unlit: true,
    texture: { width: 1, height: 1, data: Buffer.from([...blastTemplateOrange, 255]) },
  };
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    for (const r of [inner, radius]) {
      mesh.vertices.push([Math.cos(angle) * r, 0.08, Math.sin(angle) * r]);
      mesh.uv.push([0.5, 0.5]);
    }
    if (i < segments) {
      const a = i * 2;
      mesh.faces.push([a, a + 2, a + 1], [a + 1, a + 2, a + 3]);
    }
  }
  return mesh;
}

export async function createBlastTemplateAsset({
  mesh = blastTemplateGeometry(),
  profileId = 'Token5Inch',
  name = 'Starcraft - Token - Blast Template',
  configFile = 'blast-template.json',
  diameterMm = blastTemplateDiameterMm,
} = {}) {
  // Only the visible ring is exported for previews. The Unity builder supplies
  // a non-rendering contact mesh for native template hit detection.
  const meshes = [mesh];
  const bytes = await encodeGlb(meshes);
  const filename = createHash('sha256').update(bytes).digest('hex') + '.glb';
  const previewGeometryFile = 'model-assets/' + filename + '.preview.json';
  await writeFile(path.join(projectRoot, 'model-assets', filename), bytes);
  const previews = await Promise.all(
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
  await writeFile(path.join(projectRoot, previewGeometryFile), JSON.stringify(previews));
  const { bundle } = JSON.parse(await readFile(path.join(projectRoot, configFile)));
  const transforms = {
    scale: 1 / 2.54,
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
  };
  return {
    profileId,
    name,
    kind: 'token',
    calibration: 'token-centimeters-v1',
    tokenDiameterMm: diameterMm,
    parts: [
      {
        modelUrl: `${modelAssetBaseUrl}/${bundle ?? filename}`,
        textureUrl: null,
        hostedAsset: true,
        previewGeometryFile,
        transforms,
        previewTransforms: { ...transforms, scale: 1 },
      },
    ],
  };
}
