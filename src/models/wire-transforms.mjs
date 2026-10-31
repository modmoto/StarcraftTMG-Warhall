const zeroComponent = 1e-7;
const transformKeys = [
  'positionX',
  'positionY',
  'positionZ',
  'rotationX',
  'rotationY',
  'rotationZ',
];
const layerKeys = ['posX', 'posY', 'posZ', 'rotX', 'rotY', 'rotZ'];

function nonNullComponents(value, keys) {
  if (!value) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, number]) => [
      key,
      keys.includes(key) && number === 0 ? zeroComponent : number,
    ]),
  );
}

export function wirePayload(endpoint, body) {
  if (!body) return body;
  if (endpoint === '/api/tripo/create-and-link-skin')
    return { ...body, transforms: nonNullComponents(body.transforms, transformKeys) };
  if (endpoint === '/api/tripo/create-and-link-skin-multipart')
    return {
      ...body,
      parts: body.parts.map(part => ({
        ...part,
        transforms: nonNullComponents(part.transforms, transformKeys),
      })),
    };
  if (endpoint === '/UpdateSkinLayerTransforms')
    return { ...body, layers: body.layers.map(layer => nonNullComponents(layer, layerKeys)) };
  return body;
}

export function layerUpdate(layer, transform) {
  return {
    auxId: layer.AuxIdSkinLayer,
    posX: transform.positionX,
    posY: transform.positionY,
    posZ: transform.positionZ,
    rotX: transform.rotationX,
    rotY: transform.rotationY,
    rotZ: transform.rotationZ,
    scale: transform.scale,
  };
}

export function verifyLayer(layer, transform) {
  const pairs = [
    ['SocketPositionX', 'positionX'],
    ['SocketPositionY', 'positionY'],
    ['SocketPositionZ', 'positionZ'],
    ['SocketRotationX', 'rotationX'],
    ['SocketRotationY', 'rotationY'],
    ['SocketRotationZ', 'rotationZ'],
    ['SkinLayerSize', 'scale'],
  ];
  for (const [field, key] of pairs) {
    if (
      layer[field] === null ||
      layer[field] === undefined ||
      !Number.isFinite(Number(layer[field])) ||
      Math.abs(Number(layer[field]) - transform[key]) >
        Math.max(1e-5, Math.abs(transform[key]) * 1e-7)
    ) {
      throw new Error(
        `Server transform verification failed for layer ${layer.AuxIdSkinLayer}: ${field}`,
      );
    }
  }
}

export async function repairSkinTransforms(entry, skinId, request) {
  const read = async () => {
    const layers = await request(`/SelectSkinParts/${skinId}`);
    if (!Array.isArray(layers) || layers.length !== entry.parts.length)
      throw new Error(
        `${entry.name}: expected ${entry.parts.length} parts; inspect skin ${skinId}`,
      );
    return layers.sort(
      (a, b) => a.SkinLayerIdCount - b.SkinLayerIdCount || a.AuxIdSkinLayer - b.AuxIdSkinLayer,
    );
  };
  const layers = await read();
  const updates = layers.map((layer, index) => layerUpdate(layer, entry.parts[index].transforms));
  const result = await request('/UpdateSkinLayerTransforms', { skinId, layers: updates });
  if (result.error !== 0) throw new Error(`${entry.name}: transform update rejected`);
  const saved = await read();
  saved.forEach((layer, index) => verifyLayer(layer, entry.parts[index].transforms));
}
