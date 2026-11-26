import config from '../../flamer-template.json' with { type: 'json' };
import { blastTemplateOrange, createBlastTemplateAsset } from './blast-template.mjs';

export function flamerOutlineCm() {
  return config.outlineMm.map(([x, z]) => [x / 10, z / 10]);
}
export function flamerTemplateGeometry() {
  const outer = flamerOutlineCm(),
    inner = outer.map((p, i) => {
      const before = outer[(i + outer.length - 1) % outer.length],
        after = outer[(i + 1) % outer.length];
      const edge = (a, b) => {
        const x = b[0] - a[0],
          z = b[1] - a[1],
          n = Math.hypot(x, z);
        return [-z / n, x / n];
      };
      const a = edge(before, p),
        b = edge(p, after),
        d = 1 + a[0] * b[0] + a[1] * b[1];
      return [p[0] + (0.2 * (a[0] + b[0])) / d, p[1] + (0.2 * (a[1] + b[1])) / d];
    });
  const mesh = {
    vertices: [],
    uv: [],
    faces: [],
    unlit: true,
    texture: { width: 1, height: 1, data: Buffer.from([...blastTemplateOrange, 255]) },
  };
  for (let i = 0; i < outer.length; i++) {
    for (const [x, z] of [inner[i], outer[i]]) {
      mesh.vertices.push([x, 0.08, z]);
      mesh.uv.push([0.5, 0.5]);
    }
    const a = i * 2,
      b = ((i + 1) % outer.length) * 2;
    mesh.faces.push([a, b, a + 1], [a + 1, b, b + 1]);
  }
  return mesh;
}
export function createFlamerTemplateAsset() {
  return createBlastTemplateAsset({
    mesh: flamerTemplateGeometry(),
    profileId: 'sc_token_flamer_template',
    name: 'Starcraft - Token - Flamer Template',
    configFile: 'flamer-template.json',
    diameterMm: config.lengthMm,
  });
}
