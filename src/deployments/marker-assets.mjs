import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { encodeGlb } from '../models/portable-glb.mjs';
import { projectRoot } from '../paths.mjs';
import { controlRangeInches, markerDiameterMm, missionMarkers } from './markers.mjs';

const accents = { red: [226, 61, 65], blue: [24, 103, 208], green: [34, 175, 103] };
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
      vertices.push([Math.cos(angle) * radius, y, Math.sin(angle) * radius]);
      uv.push([0, 0]);
    }
    if (i < segments) {
      const n = i * 2;
      faces.push([n, n + 2, n + 1], [n + 1, n + 2, n + 3]);
    }
  }
  return { vertices, uv, faces };
}
function polygon(points, y = 0.12) {
  const vertices = points.map(([x, z]) => [x, y, z]),
    faces = [];
  for (let i = 1; i < points.length - 1; i++) {
    const [a, b, c] = [points[0], points[i], points[i + 1]];
    const up = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    faces.push(up > 0 ? [0, i, i + 1] : [0, i + 1, i]);
  }
  return { vertices, faces, uv: vertices.map(() => [0, 0]) };
}
function stroke(points, width) {
  const meshes = [];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    const x = ((-dz / length) * width) / 2,
      z = ((dx / length) * width) / 2;
    meshes.push(
      polygon([
        [a[0] + x, a[1] + z],
        [b[0] + x, b[1] + z],
        [b[0] - x, b[1] - z],
        [a[0] - x, a[1] - z],
      ]),
    );
  }
  for (const point of points.slice(1, -1))
    meshes.push(
      polygon(
        Array.from({ length: 8 }, (_, i) => [
          point[0] + (Math.cos((i * Math.PI) / 4) * width) / 2,
          point[1] + (Math.sin((i * Math.PI) / 4) * width) / 2,
        ]),
      ),
    );
  return meshes;
}
function merge(meshes, color, role) {
  const result = {
    vertices: [],
    faces: [],
    uv: [],
    texture: { width: 1, height: 1, data: Buffer.from([...color, 255]) },
    unlit: true,
    role,
  };
  for (const mesh of meshes) {
    const offset = result.vertices.length;
    result.vertices.push(...mesh.vertices);
    result.uv.push(...mesh.uv);
    result.faces.push(...mesh.faces.map(face => face.map(index => index + offset)));
  }
  return result;
}
function numeral(number, color) {
  const segments = {
    a: [
      [-0.57, 1.2],
      [0.57, 1.2],
    ],
    b: [
      [0.675, 1.08],
      [0.675, 0.12],
    ],
    c: [
      [0.675, -0.12],
      [0.675, -1.08],
    ],
    d: [
      [-0.57, -1.2],
      [0.57, -1.2],
    ],
    e: [
      [-0.675, -1.08],
      [-0.675, -0.12],
    ],
    f: [
      [-0.675, 0.12],
      [-0.675, 1.08],
    ],
    g: [
      [-0.57, 0],
      [0.57, 0],
    ],
  };
  const digits = { 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd' };
  const meshes = [...digits[number]].map(key => {
    const [a, b] = segments[key],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      ux = dx / length,
      uz = dz / length;
    const local = [
      [0.1, 0.135],
      [length - 0.1, 0.135],
      [length, 0],
      [length - 0.1, -0.135],
      [0.1, -0.135],
      [0, 0],
    ];
    return polygon(
      local.map(([x, z]) => [a[0] + ux * x - uz * z, a[1] + uz * x + ux * z]),
      0.13,
    );
  });
  const mesh = merge(meshes, color, 'number');
  const xs = mesh.vertices.map(v => v[0]),
    center = (Math.min(...xs) + Math.max(...xs)) / 2;
  mesh.vertices = mesh.vertices.map(([x, y, z]) => [x - center, y, z]);
  return mesh;
}
export function createMarkerGeometry({ color, number }) {
  const radius = controlOuterRadiusMm / 10,
    meshes = [annulus(radius - 0.44, radius, 0.12)];
  const onTop = x => [x, Math.sqrt((radius - 0.22) ** 2 - x * x)];
  const onRight = z => [Math.sqrt((radius - 0.22) ** 2 - z * z), z];
  const rails = [
    [
      onTop(radius * 0.22),
      [radius * 0.22, radius * 0.56],
      [radius * 0.53, radius * 0.25],
      onRight(radius * 0.25),
    ],
    [
      onTop(radius * 0.15),
      [radius * 0.15, radius * 0.52],
      [radius * 0.49, radius * 0.18],
      onRight(radius * 0.18),
    ],
  ];
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const angle = (quadrant * Math.PI) / 2;
    for (const rail of rails)
      meshes.push(
        ...stroke(
          rail.map(([x, z]) => [
            x * Math.cos(angle) + z * Math.sin(angle),
            -x * Math.sin(angle) + z * Math.cos(angle),
          ]),
          0.28,
        ),
      );
  }
  return [merge(meshes, accents[color], 'outline'), numeral(number, accents[color])];
}
export async function createMarkerAssets({
  directory = path.join(projectRoot, 'model-assets'),
  baseUrl = 'https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/main/model-assets',
} = {}) {
  await mkdir(directory, { recursive: true });
  const result = [];
  for (const marker of missionMarkers) {
    const meshes = createMarkerGeometry(marker),
      bytes = await encodeGlb(meshes);
    const file = `${createHash('sha256').update(bytes).digest('hex')}.glb`,
      previewGeometryFile = `model-assets/${file}.preview.json`;
    await writeFile(path.join(directory, file), bytes);
    await writeFile(
      path.join(directory, `${file}.preview.json`),
      JSON.stringify(
        await Promise.all(
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
        ),
      ),
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
    result.push({
      profileId: marker.profileId,
      name: `Starcraft - Mission marker ${marker.number} - ${marker.color}`,
      kind: 'marker',
      ...(marker.replacesNativeSkinId ? { replacesNativeSkinId: marker.replacesNativeSkinId } : {}),
      calibration: 'marker-centimeters-v2',
      markerNumber: marker.number,
      markerColor: marker.color,
      markerDiameterMm,
      controlRangeInches,
      controlOuterDiameterMm: controlOuterRadiusMm * 2,
      parts: [
        {
          modelUrl: `${baseUrl}/${file}`,
          textureUrl: null,
          hostedAsset: true,
          transforms,
          previewGeometryFile,
          previewTransforms: { ...transforms, scale: 1 },
        },
      ],
    });
  }
  return result;
}
