import { modelAssetBaseUrl } from '../urls.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { projectRoot } from '../paths.mjs';
import { encodeGlb } from '../models/portable-glb.mjs';
import { tokenDefinitions, tokenDiameterMm } from './package.mjs';
import { solidTexture, zergTokenGeometry } from './zerg-geometry.mjs';

export function tokenGeometry(texture, segments = 96, diameterMm = tokenDiameterMm) {
  const radius = diameterMm / 20;
  const top = { vertices: [[0, 0.16, 0]], uv: [[0.5, 0.5]], faces: [], texture, unlit: true };
  const edge = {
    vertices: [],
    uv: [],
    faces: [],
    unlit: true,
    texture: { width: 1, height: 1, data: Buffer.from([16, 27, 39, 255]) },
  };
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius;
    top.vertices.push([x, 0.16, z]);
    top.uv.push([0.5 + x / (radius * 2), 0.5 + z / (radius * 2)]);
    edge.vertices.push([x, 0.02, z], [x, 0.16, z]);
    edge.uv.push([0, 0], [0, 0]);
    if (i < segments) {
      top.faces.push([0, i + 2, i + 1]);
      const n = i * 2;
      edge.faces.push([n, n + 2, n + 1], [n + 1, n + 2, n + 3]);
    }
  }
  return [top, edge];
}

export async function createTokenAssets(definitions = tokenDefinitions) {
  const index = JSON.parse(await readFile(path.join(projectRoot, 'token-artwork.json')));
  const directory = path.join(projectRoot, 'model-assets');
  await mkdir(directory, { recursive: true });
  const entries = [];
  for (const token of definitions) {
    const image = path.join(
      projectRoot,
      'Starcraft-test/assets/tokens',
      index.artwork[token.id].split('/').at(-1),
    );
    const { data, info } = await sharp(image)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const diameterMm = token.diameterMm ?? tokenDiameterMm;
    const meshes = token.diameterMm
      ? [
          ...tokenGeometry(solidTexture([39, 23, 35]), 96, diameterMm),
          ...(await zergTokenGeometry(token.id, diameterMm)),
        ]
      : tokenGeometry({ width: info.width, height: info.height, data });
    const bytes = await encodeGlb(meshes);
    const filename = `${createHash('sha256').update(bytes).digest('hex')}.glb`;
    const previewGeometryFile = `model-assets/${filename}.preview.json`;
    await writeFile(path.join(directory, filename), bytes);
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
    await writeFile(path.join(projectRoot, previewGeometryFile), JSON.stringify(preview));
    const transforms = {
      scale: 1 / 2.54,
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
    };
    entries.push({
      profileId: `sc_token_${token.id}`,
      name: `Starcraft - Token - ${token.name}`,
      kind: 'token',
      calibration: 'token-centimeters-v1',
      tokenDiameterMm: diameterMm,
      parts: [
        {
          modelUrl: `${modelAssetBaseUrl}/${filename}`,
          textureUrl: null,
          hostedAsset: true,
          transforms,
          previewGeometryFile,
          previewTransforms: { ...transforms, scale: 1 },
        },
      ],
    });
  }
  return entries;
}
