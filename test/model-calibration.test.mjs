import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { normalizedObjScale, bounds } from '../src/models/calibration.mjs';
import { skinRequest } from '../src/models/catalogue.mjs';

const image = 'data:image/png;base64,iVBORw0KGgo=';
const json = async name => JSON.parse(await readFile(new URL(`../${name}`, import.meta.url)));

test('Infested Marine figures are centered on their ground contacts, excluding weapons', async () => {
  const catalogue = await json('model-catalogue.json');
  const entries = catalogue.entries.filter(
    e =>
      e.profileId === 'pdf_Zerg_profile_infested_marine' ||
      e.assignmentProfileId === 'pdf_Zerg_profile_infested_marine',
  );
  assert.equal(entries.length, 3);
  for (const entry of entries) {
    const meshes = await json(entry.parts[0].previewGeometryFile);
    const body = bounds(meshes[0].vertices);
    const stand = bounds(meshes[0].vertices.filter(p => p[1] <= body.min[1] + body.size[1] * 0.02));
    for (const axis of [0, 2])
      assert.ok(Math.abs(stand.min[axis] + stand.max[axis]) < 1e-6, entry.name);
  }
});

test('specialist bodies match their reviewed standard unit scale and remain grounded', async () => {
  const catalogue = await json('model-catalogue.json');
  const standard = await json('model-calibration-report.json');
  const specialists = catalogue.entries.filter(e => e.kind === 'specialist');
  assert.equal(specialists.length, 4);
  for (const entry of specialists) {
    const geometry = await json(entry.parts[0].previewGeometryFile);
    const reference = standard.find(r => r.profileId === entry.assignmentProfileId);
    const body = bounds(geometry[0].vertices);
    assert.ok(Math.abs(body.size[1] * 10 - reference.authoredSizeMm[1]) < 1e-6, entry.name);
    assert.ok(Math.abs(bounds(geometry.flatMap(m => m.vertices)).min[1]) < 1e-6, entry.name);
  }
});

test('single OBJ scale compensates client normalization while multipart scale remains authored', () => {
  const bounds = { size: [2, 4, 1] };
  const legacy = 1.725;
  const api = normalizedObjScale(legacy, bounds, 1);
  assert.ok(Math.abs((8 / 3 / 4) * 2.54 * api - 2.54 * legacy) < 1e-10);
  assert.equal(normalizedObjScale(legacy, bounds, 2), legacy);
});

test('source-color exceptions and Zerg retain original materials; other units use faction palettes', async () => {
  const catalogue = await json('model-catalogue.json');
  for (const entry of catalogue.entries.filter(e => e.kind === 'unit')) {
    for (const part of entry.parts) {
      if (entry.faction === 'Zerg' || entry.preserveSourceColors) {
        assert.equal(part.factionPalette, undefined);
        if (!part.hostedAsset) assert.equal(part.textureUrl, part.previewSource.textureUrl);
      } else assert.equal(part.factionPalette, entry.faction);
    }
  }
});

test('Raven and Point Defense Drone retain the reviewed 75 and 25 millimeter clearances', async () => {
  const catalogue = await json('model-catalogue.json');
  const report = await json('model-calibration-report.json');
  for (const name of ['Raven']) {
    const entry = catalogue.entries.find(e => e.name === `Starcraft - ${name}`);
    const measurement = report.find(r => r.profileId === entry.profileId);
    assert.equal(entry.flightClearanceMm, 75);
    assert.equal(measurement.flightClearanceMm, 75);
    assert.ok(measurement.flightLift > 0);
    assert.deepEqual(measurement.correctedSizeMm, measurement.authoredSizeMm);
  }
  const drone = catalogue.entries.find(e => e.name === 'Starcraft - Point Defense Drone');
  assert.equal(drone.flightClearanceMm, 25);
  assert.equal(report.find(r => r.profileId === drone.profileId).flightClearanceMm, 25);
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
  const tokenAssets = new Set(
    catalogue.entries.filter(entry => entry.kind === 'token').map(entry => entry.parts[0].modelUrl),
  );
  const wave4 = await json('wave4-model-report.json');
  assert.equal(
    hosted.length,
    18 +
      catalogue.entries.filter(entry => entry.kind === 'specialist').length +
      new Set(
        catalogue.entries
          .filter(entry => entry.kind === 'marker')
          .map(entry => entry.parts[0].modelUrl),
      ).size +
      wave4.filter(model => !model.reusedFrom).length +
      terrainAssets.size +
      tokenAssets.size,
  );
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
  const report = await json('model-calibration-report.json');
  for (const model of units.models) {
    const entry = catalogue.entries.find(entry => entry.name === `Starcraft - ${model.unitName}`);
    for (const [index, source] of [model.model, ...(model.attachments ?? [])].entries()) {
      const layout = source.layout ?? model.layout ?? {};
      const target = entry.parts[index].transforms;
      assert.deepEqual(
        [target.positionX, target.positionY, target.positionZ],
        (layout.position ?? [0, 0, 0]).map(
          (value, axis) =>
            value +
            (axis === 1
              ? (report.find(item => item.profileId === entry.profileId)?.flightLift ?? 0)
              : 0),
        ),
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

test('Wave 4 exported model feet sit on the base plane without changing authored dimensions', async () => {
  const { readFile } = await import('node:fs/promises');
  const report = JSON.parse(await readFile(new URL('../wave4-model-report.json', import.meta.url)));
  assert.equal(report.length, 14);
  for (const entry of report) {
    if (entry.reusedFrom) continue;
    assert.ok(Math.abs(entry.minimumYmm) < 1e-8, entry.unitId);
    assert.ok(Number.isFinite(entry.removedGroundOffsetMm));
  }
});

test('Tal darim Slayer reuses the normal Stalker and changes only gold pixels to red', async () => {
  const { readFile } = await import('node:fs/promises');
  const { redGoldTexture } = await import('../src/models/faction-colors.mjs');
  const selections = JSON.parse(
    await readFile(new URL('../model-selections.json', import.meta.url)),
  );
  const normal = selections.models.find(m => m.unitId === 'pdf_Protoss_unit_stalker');
  const slayer = selections.models.find(m => m.unitId === 'pdf_Protoss_unit_slayer_stalker');
  assert.equal(slayer.model.meshUrl, normal.model.meshUrl);
  assert.deepEqual(slayer.model.ttsTransform, normal.model.ttsTransform);
  const input = Buffer.from([180, 150, 30, 255, 40, 40, 40, 255, 20, 70, 190, 255]);
  const out = redGoldTexture({ data: input }).data;
  assert.deepEqual([...out.slice(0, 4)], [180, 30, 30, 255]);
  assert.deepEqual(out.slice(4), input.slice(4));
  assert.notEqual(slayer.model.textureUrl, normal.model.textureUrl);
});
