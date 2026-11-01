import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { projectRoot } from '../paths.mjs';
import { sourceGeometry } from './render-thumbnail.mjs';
import { encodeGlb } from './portable-glb.mjs';

export function transformPoint(point, transform) {
  let [x, y, z] = point.map(value => value * transform.scale);
  const [rx, ry, rz] = ['rotationX', 'rotationY', 'rotationZ'].map(
    key => (transform[key] * Math.PI) / 180,
  );
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  return [x + transform.positionX, y + transform.positionY, z + transform.positionZ];
}

export function bounds(points) {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const point of points)
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  if (!min.every(Number.isFinite)) throw new Error('Empty model bounds');
  return { min, max, size: max.map((v, i) => v - min[i]) };
}

export function normalizedObjScale(legacyScale, sourceBounds, partCount) {
  return partCount === 1 ? (legacyScale * Math.max(...sourceBounds.size)) / (8 / 3) : legacyScale;
}

export async function calibrateCatalogue(
  catalogue,
  {
    assetDirectory = path.join(projectRoot, 'model-assets'),
    assetBaseUrl = 'https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/main/model-assets',
  } = {},
) {
  await mkdir(assetDirectory, { recursive: true });
  const entries = [],
    report = [];
  for (const entry of catalogue.entries) {
    if (!entry.parts?.length) {
      entries.push(entry);
      continue;
    }
    const sources = [];
    const worldPoints = [];
    for (const part of entry.parts) {
      const { geometry, format } = await sourceGeometry(part);
      const sourceBounds = bounds(geometry.flatMap(mesh => mesh.vertices));
      const worldTransform = { ...part.transforms, scale: part.transforms.scale * 2.54 };
      for (const mesh of geometry)
        for (const point of mesh.vertices) worldPoints.push(transformPoint(point, worldTransform));
      let modelUrl = part.modelUrl,
        textureUrl = part.textureUrl;
      let portable = false;
      if (format === 'unity') {
        const glb = await encodeGlb(geometry);
        const name = `${createHash('sha256').update(glb).digest('hex')}.glb`;
        await writeFile(path.join(assetDirectory, name), glb);
        modelUrl = `${assetBaseUrl}/${name}`;
        textureUrl = null;
        portable = true;
      }
      sources.push({ part, format, sourceBounds, modelUrl, textureUrl, portable });
    }
    const authored = bounds(worldPoints);
    const parts = sources.map(({ part, format, sourceBounds, modelUrl, textureUrl, portable }) => {
      const scale = part.transforms.scale;
      const transform = {
        ...part.transforms,
        scale: format === 'obj' ? normalizedObjScale(scale, sourceBounds, sources.length) : scale,
      };
      return {
        modelUrl,
        textureUrl,
        transforms: transform,
        previewSource: { modelUrl: part.modelUrl, textureUrl: part.textureUrl },
        previewTransforms: { ...transform, scale: scale * 2.54 },
        ...(portable || part.hostedAsset ? { hostedAsset: true } : {}),
        ...(part.previewGeometryFile ? { previewGeometryFile: part.previewGeometryFile } : {}),
      };
    });
    entries.push({ ...entry, calibration: entry.calibration ?? 'windows-cache-v1', parts });
    report.push({
      profileId: entry.profileId,
      name: entry.name,
      kind: entry.kind,
      authoredSizeMm: authored.size.map(v => v * 10),
      correctedSizeMm: authored.size.map(v => v * 10),
      scaleAdjustment: 1,
      portableParts: sources.filter(source => source.portable).length,
      sourceParts: sources.map((source, index) => ({
        format: source.format,
        sourceSize: source.sourceBounds.size,
        cacheScale: source.part.transforms.scale,
        apiScale: parts[index].transforms.scale,
        partCount: parts.length,
      })),
      rotations: parts.map(part => [
        part.transforms.rotationX,
        part.transforms.rotationY,
        part.transforms.rotationZ,
      ]),
    });
  }
  return { catalogue: { ...catalogue, entries }, report };
}
