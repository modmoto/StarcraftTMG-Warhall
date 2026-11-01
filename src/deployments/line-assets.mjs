import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { encodeGlb } from '../models/portable-glb.mjs';
import { projectRoot } from '../paths.mjs';
import { overlayId } from './package.mjs';

export function lineGeometry(template, thickness = 0.15) {
  const vertices = [],
    uv = [],
    faces = [];
  for (const line of template.lines) {
    const angle = (Number(line.rotationY) * Math.PI) / 180;
    const x = Number(line.posX) * 2.54,
      z = Number(line.posY) * 2.54;
    const length = Number(line.sizeX) * 2.54;
    if (![angle, x, z, length].every(Number.isFinite) || length <= 0)
      throw new Error(`Invalid deployment line: ${template.deploymentName}`);
    const first = vertices.length;
    for (const [along, across] of [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ]) {
      const a = (along * length) / 2,
        b = (across * thickness) / 2;
      vertices.push([
        x + a * Math.cos(angle) - b * Math.sin(angle),
        0,
        z + a * Math.sin(angle) + b * Math.cos(angle),
      ]);
      uv.push([0, 0]);
    }
    faces.push([first, first + 1, first + 2], [first, first + 2, first + 3]);
  }
  return {
    vertices,
    uv,
    faces,
    texture: { width: 1, height: 1, data: Buffer.from([235, 242, 255, 255]) },
  };
}

export async function createDeploymentAssets(templates) {
  const directory = path.join(projectRoot, 'model-assets');
  await mkdir(directory, { recursive: true });
  const entries = [];
  for (const template of templates) {
    const mesh = lineGeometry(template);
    const bytes = await encodeGlb([mesh]);
    const file = `${createHash('sha256').update(bytes).digest('hex')}.glb`;
    await writeFile(path.join(directory, file), bytes);
    const previewGeometryFile = `model-assets/${file}.preview.json`;
    const png = await sharp(mesh.texture.data, { raw: { width: 1, height: 1, channels: 4 } })
      .png()
      .toBuffer();
    await writeFile(
      path.join(projectRoot, previewGeometryFile),
      JSON.stringify([{ ...mesh, texture: { png: png.toString('base64') } }]),
    );
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
      profileId: overlayId(template),
      name: `Starcraft - Deployment - ${template.deploymentName}`,
      kind: 'deployment',
      calibration: 'deployment-centimeters-v1',
      parts: [
        {
          modelUrl: `https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/main/model-assets/${file}`,
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
