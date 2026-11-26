import { blastTemplateOrange, createBlastTemplateAsset } from './blast-template.mjs';

export function fireWallGeometry() {
  const mesh = {
    vertices: [],
    uv: [],
    faces: [],
    unlit: true,
    texture: { width: 1, height: 1, data: Buffer.from([...blastTemplateOrange, 255]) },
  };
  const segments = 128;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    for (const [x, z] of [
      [1.8, 4.8],
      [2, 5],
    ]) {
      mesh.vertices.push([Math.cos(a) * x, 0.08, Math.sin(a) * z]);
      mesh.uv.push([0.5, 0.5]);
    }
    if (i < segments) {
      const n = i * 2;
      mesh.faces.push([n, n + 2, n + 1], [n + 1, n + 2, n + 3]);
    }
  }
  return mesh;
}
export function createFireWallTemplateAsset() {
  return createBlastTemplateAsset({
    mesh: fireWallGeometry(),
    profileId: 'sc_token_fire_wall',
    name: 'Starcraft - Token - Wall Template',
    configFile: 'fire-wall-template.json',
    diameterMm: 100,
  });
}
