import fs from 'node:fs';
import path from 'node:path';

const project = path.resolve('.cache/ramp-collider-test');
const catalogue = JSON.parse(fs.readFileSync('model-catalogue.json'));
const entries = catalogue.entries.filter(
  entry => entry.kind === 'token' && entry.profileId !== 'sc_token_shield',
);
for (const entry of entries) {
  const directory = path.join(project, 'Assets/TokenColliderInput', entry.profileId);
  fs.mkdirSync(directory, { recursive: true });
  const meshes = JSON.parse(fs.readFileSync(entry.parts[0].previewGeometryFile));
  const chunks = [];
  const number = (value, integer = false) => {
    const bytes = Buffer.alloc(4);
    if (integer) bytes.writeInt32LE(value);
    else bytes.writeFloatLE(value);
    chunks.push(bytes);
  };
  number(entry.tokenDiameterMm / 10);
  number(meshes.length, true);
  for (const [index, mesh] of meshes.entries()) {
    number(mesh.faces.length * 3, true);
    for (const [faceIndex, face] of mesh.faces.entries()) {
      for (const [corner, vertex] of face.entries()) {
        mesh.vertices[vertex].forEach(value => number(value));
        const uvIndex = mesh.textureFaces?.[faceIndex]?.[corner] ?? vertex;
        (mesh.uv?.[uvIndex] ?? [0.5, 0.5]).forEach(value => number(value));
      }
    }
    fs.writeFileSync(path.join(directory, index + '.png'), Buffer.from(mesh.texture.png, 'base64'));
  }
  fs.writeFileSync(path.join(directory, 'geometry.bytes'), Buffer.concat(chunks));
}
fs.copyFileSync(
  'examples/token-collider/BuildTokenColliders.cs',
  path.join(project, 'Assets/Editor/BuildTokenColliders.cs'),
);
console.log('Prepared ' + entries.length + ' custom tokens.');
