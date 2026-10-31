import test from 'node:test';
import assert from 'node:assert/strict';
import { wirePayload, repairSkinTransforms, verifyLayer } from '../src/models/wire-transforms.mjs';

const transform = {
  scale: 1,
  positionX: -12.105874556609464,
  positionY: 3.5225010612138803,
  positionZ: 0,
  rotationX: 0,
  rotationY: 359.992828,
  rotationZ: 0,
};
const layer = {
  AuxIdSkinLayer: 33410,
  SkinLayerIdCount: 2,
  SkinLayerSize: 1,
  SocketPositionX: transform.positionX,
  SocketPositionY: transform.positionY,
  SocketPositionZ: null,
  SocketRotationX: null,
  SocketRotationY: transform.rotationY,
  SocketRotationZ: null,
};

test('zero vector components survive the server zero-to-null create behaviour', () => {
  const body = { parts: [{ model_url: 'https://example.com/ramp.obj', transforms: transform }] };
  const wire = wirePayload('/api/tripo/create-and-link-skin-multipart', body);
  const stored = Object.fromEntries(
    Object.entries(wire.parts[0].transforms).map(([key, value]) => [key, value || null]),
  );
  assert.ok(
    ['positionX', 'positionY', 'positionZ', 'rotationX', 'rotationY', 'rotationZ'].every(
      key => stored[key] !== null,
    ),
  );
  assert.equal(body.parts[0].transforms.positionZ, 0);
  assert.ok(Math.abs(stored.positionZ) < 1e-6);
  assert.equal(stored.positionX, transform.positionX);
  const single = wirePayload('/api/tripo/create-and-link-skin', { transforms: transform });
  assert.ok(single.transforms.positionZ > 0);
  assert.equal(wirePayload('/UnrelatedEndpoint', body), body);
});

test('null ramp positions are rejected and targeted update is read back before reporting success', async () => {
  assert.throws(() => verifyLayer(layer, transform), /SocketPositionZ/);
  let current = { ...layer };
  const calls = [];
  const request = async (endpoint, body) => {
    calls.push(endpoint);
    if (endpoint.startsWith('/SelectSkinParts/')) return [{ ...current }];
    assert.equal(endpoint, '/UpdateSkinLayerTransforms');
    const update = wirePayload(endpoint, body).layers[0];
    current = {
      ...layer,
      SocketPositionX: update.posX,
      SocketPositionY: update.posY,
      SocketPositionZ: update.posZ,
      SocketRotationX: update.rotX,
      SocketRotationY: update.rotY,
      SocketRotationZ: update.rotZ,
      SkinLayerSize: update.scale,
    };
    return { error: 0 };
  };
  await repairSkinTransforms({ name: 'Ramp', parts: [{ transforms: transform }] }, 13182, request);
  assert.deepEqual(calls, [
    '/SelectSkinParts/13182',
    '/UpdateSkinLayerTransforms',
    '/SelectSkinParts/13182',
  ]);
  verifyLayer(current, transform);
});

test('a server that still loses components fails verification instead of claiming repair', async () => {
  const request = async endpoint =>
    endpoint.startsWith('/SelectSkinParts/') ? [{ ...layer }] : { error: 0 };
  await assert.rejects(
    repairSkinTransforms({ name: 'Ramp', parts: [{ transforms: transform }] }, 13182, request),
    /verification failed/,
  );
});
