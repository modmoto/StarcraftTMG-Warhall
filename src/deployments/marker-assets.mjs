import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { sourceGeometry } from '../models/render-thumbnail.mjs';
import { encodeGlb } from '../models/portable-glb.mjs';
import { projectRoot } from '../paths.mjs';
import { controlRangeInches, markerDiameterMm, nativeMarkers } from './markers.mjs';

export const ttsObjectiveReference = {
  workshopId: '3662791369',
  scriptGuid: 'd87518',
  modelUrl:
    'https://steamusercontent-a.akamaihd.net/ugc/2492270022769002891/E40281F9F7B0FDC8D90F249D2AA481BF3BB82CD4/',
  textureUrl:
    'https://steamusercontent-a.akamaihd.net/ugc/10292823844618557163/FD312D1B5405C94295E291614BCACD4D5DE19C16/',
};
const accents = { red: [240, 66, 58], blue: [56, 161, 255], green: [65, 216, 139] };
export const controlOuterRadiusMm = Number(
  (markerDiameterMm / 2 + controlRangeInches * 25.4).toFixed(6),
);

export function annulus(innerRadius, outerRadius, y, segments = 192) {
  const vertices = [],
    uv = [],
    faces = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    for (const radius of [innerRadius, outerRadius]) {
      const x = Math.cos(angle) * radius,
        z = Math.sin(angle) * radius;
      vertices.push([x, y, z]);
      uv.push([0.5 + x / (outerRadius * 2), 0.5 + z / (outerRadius * 2)]);
    }
    if (i < segments) {
      const n = i * 2;
      faces.push([n, n + 2, n + 1], [n + 1, n + 2, n + 3]);
    }
  }
  return { vertices, uv, faces };
}

function disk(radius, y, color) {
  const vertices = [[0, y, 0]],
    uv = [[0, 0]],
    faces = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    vertices.push([Math.cos(a) * radius, y, Math.sin(a) * radius]);
    uv.push([0, 0]);
    if (i < 96) faces.push([0, i + 2, i + 1]);
  }
  return {
    vertices,
    uv,
    faces,
    texture: { width: 1, height: 1, data: Buffer.from([...color, 255]) },
  };
}

export async function createMarkerAssets({
  directory = path.join(projectRoot, 'model-assets'),
  baseUrl = 'https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/main/model-assets',
} = {}) {
  await mkdir(directory, { recursive: true });
  const { geometry } = await sourceGeometry(ttsObjectiveReference);
  const artwork = geometry.find(mesh => mesh.texture)?.texture;
  if (!artwork) throw new Error('TTS objective reference has no texture');
  let artworkRadius = 0;
  for (let y = 0; y < artwork.height; y++)
    for (let x = 0; x < artwork.width; x++) {
      if (artwork.data[(y * artwork.width + x) * 4 + 3] >= 64) {
        artworkRadius = Math.max(
          artworkRadius,
          Math.hypot((x + 0.5) / artwork.width - 0.5, (y + 0.5) / artwork.height - 0.5),
        );
      }
    }
  const uvScale = Math.min(1, artworkRadius * 2);

  const result = [];
  for (const marker of nativeMarkers) {
    const color = accents[marker.color];
    const tinted = Buffer.from(artwork.data);
    for (let i = 0; i < tinted.length; i += 4) {
      const brightness = Math.min(
        1,
        Math.max(artwork.data[i], artwork.data[i + 1], artwork.data[i + 2]) / 128,
      );
      for (let channel = 0; channel < 3; channel++)
        tinted[i + channel] = Math.round(color[channel] * brightness);
    }
    const ring = annulus(markerDiameterMm / 20, controlOuterRadiusMm / 10, 0.025);
    ring.uv = ring.uv.map(([u, v]) => [0.5 + (u - 0.5) * uvScale, 0.5 + (v - 0.5) * uvScale]);
    ring.texture = { ...artwork, data: tinted };
    const center = disk(markerDiameterMm / 20, 0.075, [25, 33, 44]);
    const face = disk(
      markerDiameterMm / 20 - 0.09,
      0.08,
      color.map(v => Math.round(v * 0.65)),
    );
    const core = disk(0.32, 0.085, color);
    const meshes = [ring, center, face, core];
    const bytes = await encodeGlb(meshes);
    const file = `${createHash('sha256').update(bytes).digest('hex')}.glb`;
    await writeFile(path.join(directory, file), bytes);
    const previewFile = path.join(directory, `${file}.preview.json`);
    await writeFile(
      previewFile,
      JSON.stringify(
        await Promise.all(
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
        ),
      ),
    );
    result.push({
      profileId: `sc_mission_${marker.color}`,
      name: `Starcraft - Mission marker ${marker.color}`,
      kind: 'marker',
      replacesNativeSkinId: marker.skinId,
      calibration: 'marker-centimeters-v1',
      markerDiameterMm,
      controlRangeInches,
      controlOuterDiameterMm: controlOuterRadiusMm * 2,
      parts: [
        {
          modelUrl: `${baseUrl}/${file}`,
          textureUrl: null,
          hostedAsset: true,
          transforms: {
            scale: 1 / 2.54,
            positionX: 0,
            positionY: 0,
            positionZ: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
          },
          previewGeometryFile: path.relative(projectRoot, previewFile),
          previewTransforms: {
            scale: 1,
            positionX: 0,
            positionY: 0,
            positionZ: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
          },
        },
      ],
    });
  }
  return result;
}
