import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { normalizedObjScale } from '../src/models/calibration.mjs';
import { skinRequest } from '../src/models/catalogue.mjs';

const image = 'data:image/png;base64,iVBORw0KGgo=';
const json = async name => JSON.parse(await readFile(new URL(`../${name}`, import.meta.url)));

test('single OBJ scale compensates client normalization while multipart scale remains authored', () => {
  const bounds = { size: [2, 4, 1] };
  const legacy = 1.725;
  const api = normalizedObjScale(legacy, bounds, 1);
  assert.ok(Math.abs((8 / 3 / 4) * 2.54 * api - 2.54 * legacy) < 1e-10);
  assert.equal(normalizedObjScale(legacy, bounds, 2), legacy);
});

test('calibrated terrain keeps every authored translation and rotation, even with old CLI flags', async () => {
  const catalogue = await json('model-catalogue.json');
  const terrain = await json('terrain-models.json');
  for (const model of terrain.models) {
    const entry = catalogue.entries.find(entry => entry.profileId === model.terrainId);
    const payload = skinRequest(entry, { defaultScale: true, thumbnailDataUrl: image });
    const parts = payload.body.parts ?? [payload.body];
    for (const [i, source] of [model.model, ...(model.attachments ?? [])].entries()) {
      const layout = source.layout ?? model.layout;
      const actual = parts[i].transforms;
      assert.deepEqual(
        [actual.rotationX, actual.rotationY, actual.rotationZ],
        layout.rotation,
        model.unitName,
      );
      assert.deepEqual(
        [actual.positionX, actual.positionY, actual.positionZ],
        layout.position,
        model.unitName,
      );
      assert.ok(actual.scale > 0);
    }
  }
});

test('portable bundle replacements include Adepts and preserve Windows cache dimensions', async () => {
  const catalogue = await json('model-catalogue.json');
  const report = await json('model-calibration-report.json');
  const adept = catalogue.entries.find(entry => entry.name === 'Starcraft - Adepts');
  assert.match(adept.parts[0].modelUrl, /model-assets\/.*\.glb$/);
  assert.equal(adept.parts[0].textureUrl, null);
  assert.equal(adept.parts[0].hostedAsset, true);
  for (const item of report.filter(item => item.kind === 'unit')) {
    assert.deepEqual(item.correctedSizeMm, item.authoredSizeMm, item.name);
    assert.equal(item.scaleAdjustment, 1, item.name);
    assert.ok(item.correctedSizeMm.every(value => value > 0));
  }
  const files = await readdir(new URL('../model-assets/', import.meta.url));
  const hosted = [
    ...new Set(
      catalogue.entries.flatMap(entry =>
        (entry.parts ?? [])
          .filter(part => part.hostedAsset)
          .map(part => part.modelUrl.split('/').at(-1)),
      ),
    ),
  ];
  const terrainModels = await json('terrain-models.json');
  const terrainAssets = new Set(terrainModels.models.map(model => model.model.meshUrl));
  assert.equal(hosted.length, 18 + terrainAssets.size);
  assert.ok(hosted.every(file => files.includes(file)));
  for (const file of files) {
    if (!file.endsWith('.glb')) continue;
    const bytes = await readFile(new URL(`../model-assets/${file}`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(8), bytes.length);
  }
});

test('all profiles preserve the exact Windows cache rotation and translation', async () => {
  const catalogue = await json('model-catalogue.json');
  const units = await json('model-selections.json');
  for (const model of units.models) {
    const entry = catalogue.entries.find(entry => entry.name === `Starcraft - ${model.unitName}`);
    for (const [index, source] of [model.model, ...(model.attachments ?? [])].entries()) {
      const layout = source.layout ?? model.layout ?? {};
      const target = entry.parts[index].transforms;
      assert.deepEqual(
        [target.positionX, target.positionY, target.positionZ],
        layout.position ?? [0, 0, 0],
        model.unitName,
      );
      assert.deepEqual(
        [target.rotationX, target.rotationY, target.rotationZ],
        layout.rotation ?? [0, 0, 0],
        model.unitName,
      );
    }
  }
});

test('unpublished portable assets stop the publisher before credentials or creation', async () => {
  const { verifyHostedAssets } = await import('../src/models/hosted-assets.mjs');
  const catalogue = {
    entries: [{ parts: [{ hostedAsset: true, modelUrl: 'https://example.com/adept.glb' }] }],
  };
  await assert.rejects(
    verifyHostedAssets(catalogue, async () => new Response('', { status: 404 })),
    /Push the model-assets/,
  );
  await verifyHostedAssets(catalogue, async () => new Response('', { status: 200 }));
});

test('all API scales reproduce the Windows cache client multiplier', async () => {
  const report = await json('model-calibration-report.json');
  for (const entry of report)
    for (const part of entry.sourceParts) {
      const normalization =
        part.format === 'obj' && part.partCount === 1 ? 8 / 3 / Math.max(...part.sourceSize) : 1;
      assert.ok(
        Math.abs(normalization * 2.54 * part.apiScale - 2.54 * part.cacheScale) < 1e-8,
        entry.name,
      );
    }
});
