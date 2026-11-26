import fs from 'node:fs';
import path from 'node:path';

const project = path.resolve('.cache/ramp-collider-test');
const catalogue = JSON.parse(fs.readFileSync('model-catalogue.json'));
const entries = catalogue.entries.filter(entry => ['token', 'marker'].includes(entry.kind));
fs.mkdirSync(path.join(project, 'Assets/TokenColliderInput'), { recursive: true });
fs.writeFileSync(
  path.join(project, 'Assets/TokenColliderInput/active-ids.txt'),
  entries.map(entry => entry.profileId).join('\n'),
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
  number((entry.tokenDiameterMm ?? entry.markerDiameterMm) / 10);
  fs.writeFileSync(
    path.join(directory, 'highlight-parts.txt'),
    meshes
      .map((mesh, i) => (entry.kind !== 'marker' || mesh.role !== 'outline' ? String(i) : null))
      .filter(value => value !== null)
      .join('\n'),
  );
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

fs.copyFileSync(
  'examples/token-collider/BuildFireWallTemplate.cs',
  path.join(project, 'Assets/Editor/BuildFireWallTemplate.cs'),
);

const outline = JSON.parse(fs.readFileSync('flamer-template.json')).outlineMm;
const outlineBytes = Buffer.alloc(4 + outline.length * 8);
outlineBytes.writeInt32LE(outline.length, 0);
outline.forEach(([x, z], i) => {
  outlineBytes.writeFloatLE(x / 10, 4 + i * 8);
  outlineBytes.writeFloatLE(z / 10, 8 + i * 8);
});
fs.writeFileSync(
  path.join(project, 'Assets/TokenColliderInput/sc_token_flamer_template/outline.bytes'),
  outlineBytes,
);
fs.copyFileSync(
  'examples/token-collider/BuildFlamerTemplate.cs',
  path.join(project, 'Assets/Editor/BuildFlamerTemplate.cs'),
);
