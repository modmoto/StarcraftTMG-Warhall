import { bounds } from './calibration.mjs';

export function centerOnStand(geometry) {
  const body = bounds(geometry[0].vertices);
  const contacts = geometry[0].vertices.filter(
    point => point[1] <= body.min[1] + body.size[1] * 0.02,
  );
  const stand = bounds(contacts);
  const center = [(stand.min[0] + stand.max[0]) / 2, (stand.min[2] + stand.max[2]) / 2];
  for (const mesh of geometry)
    mesh.vertices = mesh.vertices.map(([x, y, z]) => [x - center[0], y, z - center[1]]);
  return center;
}

// Remove complete disconnected pieces (the handheld launcher's grip), not clipped triangles.
export function removeLowComponents(mesh, threshold) {
  const parents = mesh.vertices.map((_, i) => i);
  function root(i) {
    while (parents[i] !== i) i = parents[i] = parents[parents[i]];
    return i;
  }
  for (const face of mesh.faces) for (const index of face) parents[root(index)] = root(face[0]);
  const components = Map.groupBy(
    mesh.vertices.map((point, index) => ({ point, index })),
    v => root(v.index),
  );
  const removed = new Set(
    [...components.values()]
      .filter(vertices => Math.min(...vertices.map(v => v.point[1])) < threshold)
      .flatMap(vertices => vertices.map(v => v.index)),
  );
  if (!removed.size) throw new Error('Expected handheld launcher grip was not found');
  const retained = mesh.faces
    .map((face, index) => ({ face, index }))
    .filter(({ face }) => !face.some(i => removed.has(i)));
  const indices = [...new Set(retained.flatMap(({ face }) => face))];
  const remap = new Map(indices.map((old, index) => [old, index]));
  return {
    ...mesh,
    vertices: indices.map(i => mesh.vertices[i]),
    faces: retained.map(({ face }) => face.map(i => remap.get(i))),
    ...(mesh.textureFaces
      ? { textureFaces: retained.map(({ index }) => mesh.textureFaces[index]) }
      : {}),
  };
}

function surfaceHeight(mesh, x, z) {
  let highest = -Infinity;
  for (const face of mesh.faces) {
    const [a, b, c] = face.map(i => mesh.vertices[i]);
    const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(det) < 1e-10) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
    if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8)
      highest = Math.max(highest, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
  }
  return highest;
}

export function seatLauncherOnShoulder(body, launcher, centerZ) {
  const initial = bounds(launcher.vertices);
  const dz = centerZ - (initial.min[2] + initial.max[2]) / 2;
  launcher.vertices = launcher.vertices.map(([x, y, z]) => [x, y, z + dz]);
  const box = bounds(launcher.vertices);
  const cx = (box.min[0] + box.max[0]) / 2;
  const heights = [];
  for (const x of [-0.3, 0, 0.3])
    for (const z of [-0.3, 0, 0.3])
      heights.push(surfaceHeight(body, cx + x * box.size[0], centerZ + z * box.size[2]));
  const contact = Math.max(...heights);
  if (!Number.isFinite(contact)) throw new Error('Launcher has no shoulder surface beneath it');
  const dy = contact - box.min[1] - 0.015; // 0.15 mm overlap prevents a visible floating seam.
  launcher.vertices = launcher.vertices.map(([x, y, z]) => [x, y + dy, z]);
  return { centerX: cx, centerZ, shoulderHeight: contact, shiftY: dy, shiftZ: dz };
}
