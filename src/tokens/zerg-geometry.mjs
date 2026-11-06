import { bounds } from '../models/calibration.mjs';
import { sourceGeometry } from '../models/render-thumbnail.mjs';

// TTS StarCraft table, object 730f93.
const creepTumor = {
  modelUrl:
    'https://steamusercontent-a.akamaihd.net/ugc/16631150212134376441/944BC51BCDE2BC6EA817426F23CD755B574747B5/',
  textureUrl:
    'https://steamusercontent-a.akamaihd.net/ugc/2017097230052735116/D48C0DE238597259753F2529C90174E299D505DA/',
};

export function solidTexture(rgb) {
  return { width: 1, height: 1, data: Buffer.from([...rgb, 255]) };
}

function flame(rings, rgb) {
  const segments = 12;
  const vertices = rings.flatMap(([x, y, radius], row) =>
    Array.from({ length: segments }, (_, segment) => {
      const angle = (segment * Math.PI * 2) / segments + row * 0.31;
      return [x + Math.cos(angle) * radius, y, Math.sin(angle) * radius];
    }),
  );
  const faces = [];
  for (let row = 0; row < rings.length - 1; row++) {
    for (let segment = 0; segment < segments; segment++) {
      const a = row * segments + segment;
      const b = row * segments + ((segment + 1) % segments);
      faces.push([a, a + segments, b], [b, a + segments, b + segments]);
    }
  }
  return {
    vertices,
    faces,
    uv: vertices.map(() => [0.5, 0.5]),
    texture: solidTexture(rgb),
    unlit: true,
  };
}

export async function zergTokenGeometry(id, diameterMm) {
  if (id === 'bile_bomb' || id === 'corrosive_bile') {
    const green = id === 'bile_bomb';
    const rim = green ? [52, 145, 20] : [222, 69, 14];
    const core = green ? [155, 236, 44] : [255, 164, 34];
    const highlights = green ? [221, 255, 101] : [255, 219, 92];
    const jets = [0.63, 0.88, 0.47, 1.18, 0.72, 1.02, 0.56, 0.84];
    const rotate = (mesh, angle) => ({
      ...mesh,
      vertices: mesh.vertices.map(([x, y, z]) => [
        x * Math.cos(angle) - z * Math.sin(angle),
        y,
        x * Math.sin(angle) + z * Math.cos(angle),
      ]),
    });
    return [
      flame(
        [
          [0, 0.16, 1.24],
          [0, 0.24, 1.2],
          [0, 0.34, 0.69],
          [0, 0.43, 0.04],
        ],
        rim,
      ),
      flame(
        [
          [0, 0.34, 0.51],
          [0, 0.45, 0.44],
          [0, 0.65, 0.04],
        ],
        core,
      ),
      ...jets.flatMap((height, index) => {
        const angle = (index * Math.PI) / 4 + (index % 2) * 0.11;
        const jet = flame(
          [
            [0.54, 0.23, 0.32],
            [0.82, 0.38, 0.25],
            [1.05, height * 0.78, 0.12],
            [1.32, height, 0.015],
          ],
          index % 3 ? core : rim,
        );
        if (index % 2) return [rotate(jet, angle)];
        const droplet = flame(
          [
            [1.38, height + 0.07, 0.02],
            [1.42, height + 0.15, 0.085],
            [1.47, height + 0.24, 0.035],
            [1.49, height + 0.29, 0.008],
          ],
          highlights,
        );
        return [rotate(jet, angle), rotate(droplet, angle)];
      }),
    ];
  }
  const { geometry } = await sourceGeometry(creepTumor);
  const box = bounds(geometry.flatMap(mesh => mesh.vertices));
  const scale = diameterMm / 10 / Math.max(box.size[0], box.size[2]);
  const centerX = (box.min[0] + box.max[0]) / 2;
  const centerZ = (box.min[2] + box.max[2]) / 2;
  return geometry.map(mesh => ({
    ...mesh,
    vertices: mesh.vertices.map(([x, y, z]) => [
      (x - centerX) * scale,
      (y - box.min[1]) * scale + 0.16,
      (z - centerZ) * scale,
    ]),
  }));
}
