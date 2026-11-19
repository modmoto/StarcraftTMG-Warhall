import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { projectRoot } from '../paths.mjs';
import { modelAssetBaseUrl } from '../urls.mjs';
import { encodeGlb } from '../models/portable-glb.mjs';

export const blastTemplateDiameterMm = 130;
export const blastTemplateHeightMm = 40;
export const blastTemplateOrange = [255, 132, 24];
export function blastTemplateGeometry() {
  const radius = blastTemplateDiameterMm / 20,
    inner = radius - 0.1,
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

export function blastTemplateCylinderGeometry() {
  const segments = 128,
    levels = 16,
    radius = blastTemplateDiameterMm / 20;
  const textureHeight = 256;
  const pixels = Buffer.alloc(textureHeight * 4);
  for (let row = 0; row < textureHeight; row++) {
    // PNG top row maps to UV v=1: exactly transparent at 40mm.
    const opacity = Math.round(190 * (row / (textureHeight - 1)) ** 1.5);
    pixels.set([...blastTemplateOrange, opacity], row * 4);
  }
  const mesh = {
    vertices: [],
    uv: [],
    faces: [],
    unlit: true,
    alphaMode: 'BLEND',
    texture: { width: 1, height: textureHeight, data: pixels },
  };
  for (let side = 0; side < 2; side++) {
    const offset = mesh.vertices.length;
    for (let level = 0; level <= levels; level++) {
      const t = level / levels;
      const r = side === 0 ? radius : radius - 0.08 * (1 - t);
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        mesh.vertices.push([
          Math.cos(a) * r,
          0.08 + (t * blastTemplateHeightMm) / 10,
          Math.sin(a) * r,
        ]);
        mesh.uv.push([0.5, t]);
        if (level < levels && i < segments) {
          const a = offset + level * (segments + 1) + i,
            b = a + 1,
            c = a + segments + 1,
            d = c + 1;
          mesh.faces.push(
            ...(side === 0
              ? [
                  [a, c, b],
                  [b, c, d],
                ]
              : [
                  [a, b, c],
                  [b, d, c],
                ]),
          );
        }
      }
    }
  }
  return mesh;
}

export async function createBlastTemplateAsset() {
  const mesh = blastTemplateGeometry();
  // Native TemplateArea tests the mesh footprint. A ring alone would miss
  // models wholly inside it, so include a fully invisible filled circular face.
  const fill = {
    vertices: [[0, 0.08, 0]],
    uv: [[0.5, 0.5]],
    faces: [],
    unlit: true,
    texture: { width: 1, height: 1, data: Buffer.from([...blastTemplateOrange, 0]) },
  };
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    fill.vertices.push([Math.cos(a) * 6.5, 0.08, Math.sin(a) * 6.5]);
    fill.uv.push([0.5, 0.5]);
    fill.faces.push([0, ((i + 1) % 128) + 1, i + 1]);
  }
  fill.alphaMode = 'BLEND';
  const meshes = [mesh, fill, blastTemplateCylinderGeometry()];
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
