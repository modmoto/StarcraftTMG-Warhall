// Run terrain:update first. Converts its reviewed geometry to Unity editor input.
import fs from 'node:fs';
import path from 'node:path';
const project = path.resolve('.cache/ramp-collider-test');
const selection = JSON.parse(fs.readFileSync('terrain-models.json')).models.find(
  m => m.terrainId === 'sc_terrain_f2dd0d048a087d53',
);
const meshes = JSON.parse(fs.readFileSync(selection.model.previewGeometryFile));
const dir = path.join(project, 'Assets/HighGroundInput');
fs.mkdirSync(dir, { recursive: true });
const chunks = [];
const int = n => {
  const b = Buffer.alloc(4);
  b.writeInt32LE(n);
  chunks.push(b);
};
const float = n => {
  const b = Buffer.alloc(4);
  b.writeFloatLE(n);
  chunks.push(b);
};
int(meshes.length);
for (const [index, mesh] of meshes.entries()) {
  int(mesh.faces.length * 3);
  for (const [fi, face] of mesh.faces.entries())
    for (let j = 0; j < 3; j++) {
      mesh.vertices[face[j]].forEach(float);
      (mesh.uv[mesh.textureFaces[fi][j]] ?? [0, 0]).forEach(float);
    }
  fs.writeFileSync(path.join(dir, `${index}.png`), Buffer.from(mesh.texture.png, 'base64'));
}
fs.writeFileSync(path.join(dir, 'geometry.bytes'), Buffer.concat(chunks));
fs.copyFileSync(
  'examples/ramp-collider/BuildHighGround.cs',
  path.join(project, 'Assets/Editor/BuildHighGround.cs'),
);
console.log(`Prepared ${meshes.length} textured ramp/platform meshes in ${project}`);
