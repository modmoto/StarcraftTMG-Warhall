import sharp from 'sharp';

export async function encodeGlb(geometry) {
  const chunks = [],
    views = [],
    accessors = [],
    meshes = [],
    nodes = [],
    materials = [],
    images = [],
    textures = [];
  let length = 0;
  const addBuffer = (buffer, target) => {
    const padding = (4 - (length % 4)) % 4;
    if (padding) {
      chunks.push(Buffer.alloc(padding));
      length += padding;
    }
    const view = {
      buffer: 0,
      byteOffset: length,
      byteLength: buffer.length,
      ...(target ? { target } : {}),
    };
    chunks.push(buffer);
    length += buffer.length;
    views.push(view);
    return views.length - 1;
  };
  const addAccessor = (values, width, componentType, type, target) => {
    const array = componentType === 5125 ? new Uint32Array(values) : new Float32Array(values);
    const accessor = {
      bufferView: addBuffer(Buffer.from(array.buffer), target),
      componentType,
      count: values.length / width,
      type,
    };
    if (type === 'VEC3') {
      accessor.min = Array(width).fill(Infinity);
      accessor.max = Array(width).fill(-Infinity);
      for (let i = 0; i < values.length; i++) {
        accessor.min[i % width] = Math.min(accessor.min[i % width], values[i]);
        accessor.max[i % width] = Math.max(accessor.max[i % width], values[i]);
      }
    }
    accessors.push(accessor);
    return accessors.length - 1;
  };
  for (const geometryMesh of geometry) {
    const positions = [],
      uv = [],
      normals = [],
      indices = [];
    for (const [faceIndex, face] of geometryMesh.faces.entries()) {
      const points = face.map(i => geometryMesh.vertices[i]);
      const a = points[1].map((v, i) => v - points[0][i]),
        b = points[2].map((v, i) => v - points[0][i]);
      const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const norm = Math.hypot(...n) || 1;
      const first = positions.length / 3;
      for (let i = 0; i < 3; i++) {
        positions.push(-points[i][0], points[i][1], points[i][2]);
        normals.push(-n[0] / norm, n[1] / norm, n[2] / norm);
        const tex = geometryMesh.uv?.[geometryMesh.textureFaces?.[faceIndex]?.[i] ?? face[i]] ?? [
          0, 0,
        ];
        uv.push(tex[0], 1 - tex[1]);
      }
      indices.push(first + 2, first + 1, first);
    }
    let material = {
      doubleSided: true,
      pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: geometryMesh.roughness ?? 1 },
    };
    if (geometryMesh.unlit) material.extensions = { KHR_materials_unlit: {} };
    if (geometryMesh.texture) {
      const t = geometryMesh.texture;
      const png = await sharp(t.data, { raw: { width: t.width, height: t.height, channels: 4 } })
        .png()
        .toBuffer();
      images.push({ bufferView: addBuffer(png), mimeType: 'image/png' });
      textures.push({ source: images.length - 1 });
      material.pbrMetallicRoughness.baseColorTexture = { index: textures.length - 1 };
      material.alphaMode = 'MASK';
      material.alphaCutoff = 0.25;
    }
    materials.push(material);
    meshes.push({
      primitives: [
        {
          attributes: {
            POSITION: addAccessor(positions, 3, 5126, 'VEC3', 34962),
            NORMAL: addAccessor(normals, 3, 5126, 'VEC3', 34962),
            TEXCOORD_0: addAccessor(uv, 2, 5126, 'VEC2', 34962),
          },
          indices: addAccessor(indices, 1, 5125, 'SCALAR', 34963),
          material: materials.length - 1,
        },
      ],
    });
    nodes.push({ mesh: meshes.length - 1 });
  }
  const binary = Buffer.concat(chunks);
  const gltf = {
    asset: { version: '2.0', generator: 'Starcraft Warhall portable-model exporter' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials,
    images,
    textures,
    ...(geometry.some(mesh => mesh.unlit) ? { extensionsUsed: ['KHR_materials_unlit'] } : {}),
    buffers: [{ byteLength: binary.length }],
    bufferViews: views,
    accessors,
  };
  const json = Buffer.from(JSON.stringify(gltf));
  const jsonPadding = Buffer.alloc((4 - (json.length % 4)) % 4, 32),
    binaryPadding = Buffer.alloc((4 - (binary.length % 4)) % 4);
  const header = Buffer.alloc(12);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(
    12 + 8 + json.length + jsonPadding.length + 8 + binary.length + binaryPadding.length,
    8,
  );
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length + jsonPadding.length);
  jsonHeader.write('JSON', 4);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binary.length + binaryPadding.length);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([
    header,
    jsonHeader,
    json,
    jsonPadding,
    binaryHeader,
    binary,
    binaryPadding,
  ]);
}
