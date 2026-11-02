import sharp from 'sharp';
import { accents } from './marker-assets.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { encodeGlb } from '../models/portable-glb.mjs';
import { projectRoot } from '../paths.mjs';
import { overlayId } from './package.mjs';

export function lineGeometry(template, thickness = 1, color = [235, 242, 255]) {
  const vertices = [],
    uv = [],
    faces = [];
  for (const line of template.lines) {
    const angle = (Number(line.rotationY) * Math.PI) / 180;
    let x = Number(line.posX) * 2.54,
      z = Number(line.posY) * 2.54;
    // Coloured strips sit wholly outside the playable area; grid lines stay centred.
    if (line.color) {
      if (Math.abs(Math.sin(angle)) > 0.5) x += (Math.sign(x) * thickness) / 2;
      else z += (Math.sign(z) * thickness) / 2;
    }
    const length = Number(line.sizeX) * 2.54;
    const cornerExtension = along => {
      if (!line.color) return 0;
      const ex = Number(line.posX) * 2.54 + ((along * length) / 2) * Math.cos(angle);
      const ez = Number(line.posY) * 2.54 + ((along * length) / 2) * Math.sin(angle);
      return template.lines.some(other => {
        if (other === line || other.color !== line.color) return false;
        const oa = (Number(other.rotationY) * Math.PI) / 180;
        if (Math.abs(Math.sin(oa - angle)) < 0.99) return false;
        return [-1, 1].some(
          end =>
            Math.hypot(
              Number(other.posX) * 2.54 +
                ((end * Number(other.sizeX) * 2.54) / 2) * Math.cos(oa) -
                ex,
              Number(other.posY) * 2.54 +
                ((end * Number(other.sizeX) * 2.54) / 2) * Math.sin(oa) -
                ez,
            ) < 1e-6,
        );
      })
        ? thickness
        : 0;
    };
    const extensions = { [-1]: cornerExtension(-1), [1]: cornerExtension(1) };
    if (![angle, x, z, length].every(Number.isFinite) || length <= 0)
      throw new Error(`Invalid deployment line: ${template.deploymentName}`);
    const first = vertices.length;
    for (const y of [0, 0.05])
      for (const [along, across] of [
        [-1, -1],
        [-1, 1],
        [1, 1],
        [1, -1],
      ]) {
        const a = along * (length / 2 + extensions[along]),
          b = (across * thickness) / 2;
        vertices.push([
          x + a * Math.cos(angle) - b * Math.sin(angle),
          y,
          z + a * Math.sin(angle) + b * Math.cos(angle),
        ]);
        uv.push([0, 0]);
      }
    for (const face of [
      [0, 1, 2],
      [0, 2, 3],
      [4, 6, 5],
      [4, 7, 6],
      [0, 4, 5],
      [0, 5, 1],
      [1, 5, 6],
      [1, 6, 2],
      [2, 6, 7],
      [2, 7, 3],
      [3, 7, 4],
      [3, 4, 0],
    ])
      faces.push(face.map(index => first + index));
  }
  return {
    vertices,
    uv,
    faces,
    texture: { width: 1, height: 1, data: Buffer.from([...color, 255]) },
  };
}

export async function createDeploymentAssets(templates) {
  const directory = path.join(projectRoot, 'model-assets');
  await mkdir(directory, { recursive: true });
  const entries = [];
  for (const template of templates) {
    const colors = [...new Set(template.lines.map(line => line.color ?? 'grid'))];
    const meshes = colors.map(color =>
      lineGeometry(
        { ...template, lines: template.lines.filter(line => (line.color ?? 'grid') === color) },
        color === 'grid' ? 0.15 : 1,
        color === 'grid' ? [235, 242, 255] : accents[color],
      ),
    );
    const bytes = await encodeGlb(meshes);
    const file = `${createHash('sha256').update(bytes).digest('hex')}.glb`;
    await writeFile(path.join(directory, file), bytes);
    const previewGeometryFile = `model-assets/${file}.preview.json`;
    const preview = await Promise.all(
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
