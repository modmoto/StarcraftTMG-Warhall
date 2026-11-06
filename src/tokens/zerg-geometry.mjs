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
  if (id === 'bile_bomb') {
    return [
      flame(
        [
          [0, 0.16, 0.03],
          [0, 0.26, 1.04],
          [-0.16, 0.64, 0.72],
          [-0.55, 1.19, 0.49],
          [-0.98, 2.05, 0.04],
        ],
        [203, 69, 12],
      ),
      flame(
        [
          [0.2, 0.19, 0.03],
          [0.24, 0.38, 0.72],
          [0.11, 0.76, 0.54],
          [-0.46, 1.52, 0.09],
        ],
        [255, 150, 22],
      ),
      flame(
        [
          [0.45, 0.2, 0.03],
          [0.48, 0.41, 0.42],
          [0.2, 0.8, 0.24],
          [-0.12, 1.12, 0.02],
        ],
        [255, 227, 93],
      ),
      flame(
        [
          [0.75, 0.16, 0.02],
          [0.92, 0.26, 0.22],
          [1.32, 0.59, 0.03],
        ],
        [251, 106, 20],
      ),
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
