import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { projectRoot } from '../paths.mjs';
import { modelAssetBaseUrl } from '../urls.mjs';
import { encodeGlb } from '../models/portable-glb.mjs';

export const blastTemplateDiameterMm = 130;
export function blastTemplateGeometry() {
  const radius = blastTemplateDiameterMm / 20,
    inner = radius - 0.1,
    segments = 128;
  const mesh = {
    vertices: [],
    uv: [],
    faces: [],
    unlit: true,
    texture: { width: 1, height: 1, data: Buffer.from([185, 228, 242, 255]) },
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

export async function createBlastTemplateAsset() {
  const mesh = blastTemplateGeometry();
  // Native TemplateArea tests the mesh footprint. A ring alone would miss
  // models wholly inside it, so include a translucent filled circular face.
  const fill = {
    vertices: [[0, 0.08, 0]],
    uv: [[0.5, 0.5]],
    faces: [],
    unlit: true,
    texture: { width: 1, height: 1, data: Buffer.from([100, 170, 200, 30]) },
  };
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    fill.vertices.push([Math.cos(a) * 6.5, 0.08, Math.sin(a) * 6.5]);
    fill.uv.push([0.5, 0.5]);
    fill.faces.push([0, ((i + 1) % 128) + 1, i + 1]);
  }
  const meshes = [mesh, fill];
  const bytes = await encodeGlb(meshes);
  const filename = createHash('sha256').update(bytes).digest('hex') + '.glb';
  const previewGeometryFile = 'model-assets/' + filename + '.preview.json';
  await writeFile(path.join(projectRoot, 'model-assets', filename), bytes);
  const previews = await Promise.all(
    meshes.map(async mesh => ({
      ...mesh,
      texture: {
        png: (
          await sharp(mesh.texture.data, { raw: { width: 1, height: 1, channels: 4 } })
            .png()
            .toBuffer()
        ).toString('base64'),
      },
    })),
  );
  await writeFile(path.join(projectRoot, previewGeometryFile), JSON.stringify(previews));
  const { bundle } = JSON.parse(await readFile(path.join(projectRoot, 'blast-template.json')));
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
    profileId: 'Token5Inch',
    name: 'Starcraft - Token - Blast Template',
    kind: 'token',
    calibration: 'token-centimeters-v1',
    tokenDiameterMm: blastTemplateDiameterMm,
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
