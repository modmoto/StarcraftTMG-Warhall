import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { projectRoot } from '../paths.mjs';

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const normalized = vector => vector.map(value => value / (Math.hypot(...vector) || 1));
const camera = normalized([3, 1.8, 4]);
const right = normalized(cross([0, 1, 0], camera));
const up = cross(camera, right);
const light = normalized([0.3, 0.8, 0.5]);

export function parseObj(text) {
  const vertices = [],
    uv = [],
    faces = [],
    textureFaces = [];
  for (const line of text.split(/\r?\n/)) {
    const [type, ...fields] = line.trim().split(/\s+/);
    if (type === 'v') vertices.push(fields.slice(0, 3).map(Number));
    else if (type === 'vt') uv.push(fields.slice(0, 2).map(Number));
    else if (type === 'f') {
      const points = fields.map(field => field.split('/').map(Number));
      for (let index = 1; index < points.length - 1; index++) {
        const triangle = [points[0], points[index], points[index + 1]];
        faces.push(
          triangle.map(point => (point[0] < 0 ? vertices.length + point[0] : point[0] - 1)),
        );
        textureFaces.push(
          triangle.map(point =>
            !point[1] ? -1 : point[1] < 0 ? uv.length + point[1] : point[1] - 1,
          ),
        );
      }
    }
  }
  if (
    !vertices.length ||
    !faces.length ||
    !vertices.every(v => v.length === 3 && v.every(Number.isFinite)) ||
    faces.some(face => face.some(i => i < 0 || i >= vertices.length))
  ) {
    throw new Error('Invalid or empty OBJ geometry');
  }
  return { vertices, uv, faces, textureFaces };
}

async function cachedAsset(url, directory) {
  if (new URL(url).protocol !== 'https:') throw new Error('Thumbnail source must use HTTPS');
  const filename = path.join(directory, createHash('sha256').update(url).digest('hex'));
  try {
    await readFile(filename);
    return filename;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error('Empty model download');
  await writeFile(filename, bytes);
  return filename;
}

async function unityGeometry(filename, directory, secondary) {
  const output = `${filename}${secondary ? '-materials' : ''}.geometry.json`;
  try {
    return JSON.parse(await readFile(output, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const command =
    process.env.WARHALL_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
  const dependencies = path.join(directory, 'python');
  const env = {
    ...process.env,
    PYTHONPATH: [dependencies, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
  };
  const check = spawnSync(command, ['-c', 'import UnityPy, numpy'], { env, encoding: 'utf8' });
  if (check.status !== 0) {
    if (check.error?.code === 'ENOENT')
      throw new Error('Unity bundle thumbnails require Python 3; install it or set WARHALL_PYTHON');
    const install = spawnSync(
      command,
      [
        '-m',
        'pip',
        'install',
        '--target',
        dependencies,
        '--disable-pip-version-check',
        'UnityPy==1.25.4',
        'numpy==2.2.6',
      ],
      { env, encoding: 'utf8', maxBuffer: 2_000_000 },
    );
    if (install.status !== 0)
      throw new Error(`Could not prepare Unity thumbnail decoder: ${install.stderr?.slice(-700)}`);
  }
  const result = spawnSync(
    command,
    [
      path.join(projectRoot, 'scripts/unity-thumbnail-geometry.py'),
      filename,
      output,
      ...(secondary ? [secondary] : []),
    ],
    { env, encoding: 'utf8', maxBuffer: 2_000_000 },
  );
  if (result.status !== 0)
    throw new Error(`Unity thumbnail decoding failed: ${result.stderr?.slice(-4000)}`);
  return JSON.parse(await readFile(output, 'utf8'));
}

async function textureData(filename) {
  const { data, info } = await sharp(filename)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function renderGeometry(
  meshes,
  { size = 512, topDown = false, frame = null, margin = 32 } = {},
) {
  const viewRight = topDown ? [1, 0, 0] : right;
  const viewUp = topDown ? [0, 0, 1] : up;
  const viewCamera = topDown ? [0, 1, 0] : camera;
  if (!meshes.length) throw new Error('No renderable model meshes');
  const projected = meshes.map(mesh =>
    mesh.vertices.map(v => [dot(v, viewRight), dot(v, viewUp), dot(v, viewCamera)]),
  );
  const lower = [Infinity, Infinity, Infinity],
    upper = [-Infinity, -Infinity, -Infinity];
  for (const points of projected)
    for (const point of points)
      for (let axis = 0; axis < 3; axis++) {
        lower[axis] = Math.min(lower[axis], point[axis]);
        upper[axis] = Math.max(upper[axis], point[axis]);
      }
  if (frame) {
    [lower[0], lower[1], upper[0], upper[1]] = frame;
  }
  const scale = (size - margin * 2) / Math.max(upper[0] - lower[0], upper[1] - lower[1], 0.0001);
  const center = lower.map((value, i) => (value + upper[i]) / 2);
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 27;
    pixels[i + 1] = 35;
    pixels[i + 2] = 47;
    pixels[i + 3] = 255;
  }
  const depth = new Float64Array(size * size).fill(-Infinity);
  let drawn = 0;
  for (const [meshIndex, mesh] of meshes.entries()) {
    const points = projected[meshIndex].map(p => [
      size / 2 + (p[0] - center[0]) * scale,
      size / 2 - (p[1] - center[1]) * scale,
      p[2],
    ]);
    for (const [faceIndex, face] of mesh.faces.entries()) {
      const [a, b, c] = face.map(index => points[index]);
      const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(denominator) < 1e-10) continue;
      const v = face.map(index => mesh.vertices[index]);
      const normal = normalized(
        cross(
          v[1].map((n, i) => n - v[0][i]),
          v[2].map((n, i) => n - v[0][i]),
        ),
      );
      const shade = mesh.unlit ? 1 : 0.42 + 0.58 * Math.abs(dot(normal, light));
      const texIndices = mesh.textureFaces?.[faceIndex] ?? face;
      const texCoords = texIndices.map(index => mesh.uv?.[index]);
      const hasTexture = mesh.texture && texCoords.every(p => p?.length >= 2);
      const xmin = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))),
        xmax = Math.min(size - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const ymin = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))),
        ymax = Math.min(size - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      for (let y = ymin; y <= ymax; y++)
        for (let x = xmin; x <= xmax; x++) {
          const u =
            ((b[1] - c[1]) * (x + 0.5 - c[0]) + (c[0] - b[0]) * (y + 0.5 - c[1])) / denominator;
          const w =
            ((c[1] - a[1]) * (x + 0.5 - c[0]) + (a[0] - c[0]) * (y + 0.5 - c[1])) / denominator;
          const t = 1 - u - w;
          if (u < 0 || w < 0 || t < 0) continue;
          const z = u * a[2] + w * b[2] + t * c[2],
            index = y * size + x;
          if (z <= depth[index]) continue;
          let color = [153, 170, 190, 255];
          if (hasTexture) {
            const tu = u * texCoords[0][0] + w * texCoords[1][0] + t * texCoords[2][0];
            const tv = u * texCoords[0][1] + w * texCoords[1][1] + t * texCoords[2][1];
            const texture = mesh.texture;
            const tx =
              ((Math.floor(tu * texture.width) % texture.width) + texture.width) % texture.width;
            const ty =
              ((Math.floor((1 - tv) * texture.height) % texture.height) + texture.height) %
              texture.height;
            color = texture.data.subarray(
              (ty * texture.width + tx) * 4,
              (ty * texture.width + tx) * 4 + 4,
            );
            if (color[3] < 64) continue;
          }
          depth[index] = z;
          for (let channel = 0; channel < 3; channel++)
            pixels[index * 4 + channel] = Math.round(color[channel] * shade);
          drawn++;
        }
    }
  }
  if (!drawn) throw new Error('Model thumbnail rendered no visible triangles');
  return sharp(pixels, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toBuffer();
}

export async function generateThumbnail(
  entry,
  {
    directory,
    defaultScale = true,
    cacheDirectory = path.join(projectRoot, '.cache/thumbnail-assets'),
  },
) {
  await mkdir(directory, { recursive: true });
  await mkdir(cacheDirectory, { recursive: true });
  const meshes = [];
  for (const part of entry.parts ?? []) {
    const { geometry } = await sourceGeometry(part, cacheDirectory);
    for (const mesh of geometry) {
      const transform = part.previewTransforms ?? {
        ...part.transforms,
        scale: defaultScale ? 1 : (part.transforms?.scale ?? 1),
      };
      const rotation = [
        transform.rotationX ?? 0,
        transform.rotationY ?? 0,
        transform.rotationZ ?? 0,
      ].map(value => (value * Math.PI) / 180);
      mesh.vertices = mesh.vertices.map(point => {
        let [x, y, z] = point;
        [y, z] = [
          y * Math.cos(rotation[0]) - z * Math.sin(rotation[0]),
          y * Math.sin(rotation[0]) + z * Math.cos(rotation[0]),
        ];
        [x, z] = [
          x * Math.cos(rotation[1]) + z * Math.sin(rotation[1]),
          -x * Math.sin(rotation[1]) + z * Math.cos(rotation[1]),
        ];
        [x, y] = [
          x * Math.cos(rotation[2]) - y * Math.sin(rotation[2]),
          x * Math.sin(rotation[2]) + y * Math.cos(rotation[2]),
        ];
        return [x, y, z].map(
          (v, i) =>
            v * (transform.scale ?? 1) +
            (transform[['positionX', 'positionY', 'positionZ'][i]] ?? 0),
        );
      });
      meshes.push(mesh);
    }
  }
  const png = await renderGeometry(meshes);
  const filename = path.join(directory, `${entry.profileId}.png`);
  await writeFile(filename, png);
  await writeFile(
    `${filename}.render.json`,
    JSON.stringify({ fingerprint: renderFingerprint(entry, defaultScale) }),
  );
  return png;
}

export function renderFingerprint(entry, defaultScale) {
  return createHash('sha256')
    .update(JSON.stringify({ parts: entry.parts, defaultScale, rendererVersion: 4 }))
    .digest('hex');
}

export async function sourceGeometry(
  part,
  cacheDirectory = path.join(projectRoot, '.cache/thumbnail-assets'),
) {
  await mkdir(cacheDirectory, { recursive: true });
  if (part.previewGeometryFile) {
    const geometry = JSON.parse(
      await readFile(path.join(projectRoot, part.previewGeometryFile), 'utf8'),
    );
    for (const mesh of geometry)
      mesh.texture = await textureData(Buffer.from(mesh.texture.png, 'base64'));
    return { geometry, format: 'glb' };
  }
  part = { ...part, ...part.previewSource };
  const source = await cachedAsset(part.modelUrl, cacheDirectory);
  const bytes = await readFile(source);
  const externalTexture = part.textureUrl
    ? await textureData(await cachedAsset(part.textureUrl, cacheDirectory))
    : null;
  let secondary;
  if (bytes.subarray(0, 7).toString().startsWith('Unity') && !externalTexture) {
    const inventory = JSON.parse(
      await readFile(path.join(projectRoot, 'tts-model-sources.json'), 'utf8'),
    );
    const source = inventory.models.find(
      model => model.customAssetbundle?.AssetbundleURL === part.modelUrl,
    );
    const url = source?.customAssetbundle?.AssetbundleSecondaryURL;
    if (url) secondary = await cachedAsset(url, cacheDirectory);
  }
  const format = bytes.subarray(0, 7).toString().startsWith('Unity') ? 'unity' : 'obj';
  const geometry =
    format === 'unity'
      ? await unityGeometry(source, cacheDirectory, secondary)
      : [parseObj(bytes.toString('utf8'))];
  for (const mesh of geometry)
    mesh.texture =
      externalTexture ?? (mesh.textureFile ? await textureData(mesh.textureFile) : null);
  return { geometry, format };
}
