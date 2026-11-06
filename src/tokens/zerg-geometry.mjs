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

function liquid(profile, rgb) {
  const segments = 24;
  const rings = profile.flatMap((point, i) => {
    if (i === profile.length - 1) return [point];
    const before = profile[Math.max(0, i - 1)];
    const after = profile[i + 1];
    const end = profile[Math.min(profile.length - 1, i + 2)];
    return [0, 0.25, 0.5, 0.75].map(t =>
      point.map((p, axis) => {
        const a = before[axis],
          b = after[axis],
          c = end[axis];
        const v =
          0.5 *
          (2 * p +
            (-a + b) * t +
            (2 * a - 5 * p + 4 * b - c) * t ** 2 +
            (-a + 3 * p - 3 * b + c) * t ** 3);
        return axis === 2 ? Math.max(0.006, v) : v;
      }),
    );
  });
  const vertices = rings.flatMap(([x, y, radius], row) =>
    Array.from({ length: segments }, (_, segment) => {
      const angle = (segment * Math.PI * 2) / segments + row * 0.012;
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
    roughness: 0.17,
  };
}

export async function zergTokenGeometry(id, diameterMm) {
  if (id === 'bile_bomb' || id === 'corrosive_bile') {
    const green = id === 'bile_bomb';
    const deep = green ? [43, 86, 13] : [146, 55, 9];
    const amber = green ? [118, 177, 19] : [231, 111, 11];
    const bright = green ? [177, 223, 31] : [255, 174, 20];
    const heights = [0.59, 0.95, 0.48, 1.12, 0.76, 0.96, 0.48, 0.68, 0.55];
    return [
      liquid(
        [
          [0, 0.13, 0.79],
          [0, 0.22, 1.12],
          [0, 0.41, 0.89],
          [-0.06, 0.65, 0.66],
          [0.04, 0.89, 0.51],
          [0.03, 1.12, 0.18],
        ],
        deep,
      ),
      liquid(
        [
          [0.04, 0.69, 0.42],
          [0.06, 1.04, 0.45],
          [-0.23, 1.34, 0.3],
          [-0.28, 1.63, 0.19],
          [-0.11, 1.92, 0.3],
          [0.12, 2.22, 0.15],
          [0.25, 2.55, 0.16],
          [0.38, 2.85, 0.27],
          [0.34, 3.12, 0.18],
          [0.13, 3.37, 0.29],
          [-0.19, 3.6, 0.16],
          [-0.24, 3.9, 0.19],
          [-0.15, 4.17, 0.095],
          [-0.16, 4.45, 0.065],
          [-0.29, 4.59, 0.01],
        ],
        amber,
      ),
      ...heights.map((height, i) => {
        const angle = i * 2.39996;
        const splash = liquid(
          [
            [0.47, 0.27, 0.24],
            [0.78, 0.34, 0.24],
            [1.02, height * 0.72, 0.13],
            [1.19, height * 0.9, 0.21],
            [1.27, height + 0.05, 0.16],
            [1.28, height + 0.17, 0.025],
          ],
          i % 3 === 0 ? bright : amber,
        );
        return {
          ...splash,
          vertices: splash.vertices.map(([x, y, z]) => [
            x * Math.cos(angle) - z * Math.sin(angle),
            y,
            x * Math.sin(angle) + z * Math.cos(angle),
          ]),
        };
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
