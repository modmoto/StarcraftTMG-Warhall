import { parseObj } from '../models/render-thumbnail.mjs';

export function rotate(point, angles) {
  let [x, y, z] = point;
  const [rx, ry, rz] = angles.map(value => (value * Math.PI) / 180);
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  return [x, y, z];
}

export function terrainPoint(point, parentScale, transform = {}, yaw = 0) {
  const scaled = [-point[0], point[1], point[2]].map(
    (v, i) => v * (transform[`scale${'XYZ'[i]}`] ?? 1),
  );
  const turned = rotate(
    scaled,
    'XYZ'.split('').map(axis => transform[`rot${axis}`] ?? 0),
  );
  return rotate(
    turned.map((v, i) => (v + (transform[`pos${'XYZ'[i]}`] ?? 0)) * parentScale[i]),
    [0, yaw, 0],
  );
}

export function bounds(meshes) {
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (const mesh of meshes)
    for (const vertex of mesh.vertices)
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], vertex[i]);
        hi[i] = Math.max(hi[i], vertex[i]);
      }
  return { lo, hi, size: hi.map((v, i) => v - lo[i]) };
}

export function assembleTerrain(asset, parts, calibration) {
  const meshes = parts.map(({ obj, texture }, index) => {
    const mesh = parseObj(obj);
    const transform = index ? asset.attachments[index - 1].transform : {};
    mesh.vertices = mesh.vertices.map(point =>
      terrainPoint(point, asset.ttsScale, transform, calibration.alignmentYaw ?? 0),
    );
    mesh.faces = mesh.faces.map(face => [...face].reverse());
    mesh.textureFaces = mesh.textureFaces.map(face => [...face].reverse());
    const triangles = mesh.faces
      .map((face, index) => ({ face, index }))
      .filter(({ face }) => {
        const [a, b, c] = face.map(i => mesh.vertices[i]);
        const u = b.map((v, i) => v - a[i]),
          v = c.map((value, i) => value - a[i]);
        return (
          Math.hypot(
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0],
          ) > 1e-9
        );
      });
    mesh.faces = triangles.map(({ face }) => face);
    mesh.textureFaces = triangles.map(({ index }) => mesh.textureFaces[index]);
    mesh.texture = texture;
    return mesh;
  });
  const source = bounds(meshes);
  const [width, length] = calibration.footprintInches;
  const center = source.lo.map((v, i) => (v + source.hi[i]) / 2);
  const heightScale =
    calibration.heightMm === undefined ? 2.54 : calibration.heightMm / (10 * source.size[1]);
  for (const mesh of meshes)
    mesh.vertices = mesh.vertices.map(([x, y, z]) => [
      (((x - center[0]) * width) / source.size[0]) * 2.54,
      (y - source.lo[1]) * heightScale,
      (((z - center[2]) * length) / source.size[2]) * 2.54,
    ]);
  return { meshes, sourceBounds: source, calibratedBounds: bounds(meshes) };
}
