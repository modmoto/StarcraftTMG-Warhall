import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { terrainMenuId } from '../src/models/menu-ids.mjs';
const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
test('all nine maps use the reviewed PDF centers, rotations and calibrated footprints', async () => {
  const source = await read('../terrain-sources.json');
  const calibration = await read('../terrain-calibration.json');
  const maps = await read('../Starcraft-test/maps.json');
  const models = await read('../terrain-models.json');
  const terrains = await read('../Starcraft-test/terrains.json');
  assert.deepEqual(
    maps.map(map => map.Items.length),
    [30, 30, 30, 30, 32, 32, 15, 15, 16],
  );
  assert.equal(calibration.gridInches, 6);
  for (const [i, map] of maps.entries())
    for (const [j, item] of map.Items.entries()) {
      const original = source.maps[i].items[j];
      const placement = calibration.maps[String(i + 1)][original.ttsGuid];
      const asset = source.assets.find(
        asset => asset.id === (calibration.assetAliases?.[original.id] ?? original.id),
      );
      assert.equal(item.Id, terrainMenuId(asset));
      const [width, length] = calibration.assets[asset.name].footprintInches;
      const terrain = terrains.find(terrain => terrain.Id === item.Id);
      assert.ok(Math.abs(terrain.Width - width * 2.54) <= 0.0177 + 1e-8);
      assert.ok(Math.abs(terrain.Length - length * 2.54) <= 0.0177 + 1e-8);
      assert.ok(Math.abs(27 - item.ShortSide - placement.x) < 1e-8);
      assert.ok(Math.abs(item.LongSide - source.maps[i].height / 2 - placement.z) < 1e-8);
      assert.equal(item.Rotation, Math.round(placement.rotation));
      if (i < 6) assert.equal(item.Rotation % 15, 0);
      const model = models.models.find(model => model.terrainId === asset.id);
      assert.equal(model.calibration, 'pdf-grid-v1');
      assert.match(model.model.meshUrl, /model-assets\/.*\.(glb|unity3d)$/);
      assert.equal(model.attachments.length, 0);
    }
  const highGround = models.models.find(model =>
    model.unitName.startsWith('Terrain - High Ground'),
  );
  assert.equal(highGround.sourcePartCount, 2);
});

test('map six has both east-west ramp assemblies and the reviewed TTS positions', async () => {
  const source = await read('../terrain-sources.json');
  const maps = await read('../Starcraft-test/maps.json');
  const map = source.maps.find(map => map.number === 6);
  assert.equal(map.pdfPage, 123);
  const ramp = source.assets.find(asset => asset.name === 'High Ground');
  const ramps = map.items.filter(item => item.id === ramp.id);
  assert.equal(ramps.length, 2);
  assert.deepEqual(
    ramps.map(item => [item.x, item.z, Math.round(item.rotation)]),
    [
      [18.2777, 2.0579, 360],
      [-18.4466, -2.155, 180],
    ],
  );
  assert.equal(ramp.attachments.length, 1);
  assert.equal(
    maps.find(map => map.Id === 'sc_map_6').Items.filter(item => item.Id === terrainMenuId(ramp))
      .length,
    2,
  );
});

test('cardinal wall centerlines use exact grid subdivisions without angular drift', async () => {
  const source = await read('../terrain-sources.json');
  const calibration = await read('../terrain-calibration.json');
  let count = 0;
  for (const map of source.maps.filter(map => map.width === 54))
    for (const item of map.items) {
      const asset = source.assets.find(asset => asset.id === item.id);
      const definition = calibration.assets[asset.name];
      const p = calibration.maps[String(map.number)][item.ttsGuid];
      if (definition.centerlineZ === undefined || p.rotation % 90) continue;
      const angle = (p.rotation * Math.PI) / 180;
      const normal =
        Math.abs(Math.cos(angle)) > 0.5
          ? p.z + Math.cos(angle) * definition.centerlineZ
          : p.x + Math.sin(angle) * definition.centerlineZ;
      assert.ok(
        Math.abs(normal * 4 - Math.round(normal * 4)) < 1e-7,
        `${map.number}/${asset.name}: ${normal}`,
      );
      count++;
    }
  assert.ok(count >= 20);
});
test('separate XYZ scales are composed through attachments before geometry is centered', async () => {
  const { terrainPoint } = await import('../src/terrain/geometry.mjs');
  assert.deepEqual(
    terrainPoint([1, 2, 3], [2, 3, 4], {
      scaleX: 5,
      scaleY: 6,
      scaleZ: 7,
      posX: 1,
      posY: 2,
      posZ: 3,
    }),
    [-8, 42, 96],
  );
  const terrains = await read('../Starcraft-test/terrains.json');
  const source = await read('../terrain-sources.json');
  const byName = name =>
    terrains.filter(t => source.assets.some(a => terrainMenuId(a) === t.Id && a.name === name));
  const shard = byName('Statue Shard')[0],
    head = byName('Head Statue')[0];
  assert.ok(shard.Width * shard.Length < head.Width * head.Length * 0.7);
  assert.ok(shard.Width < head.Width && shard.Length < head.Length);
});

test('touching PDF wall groups stay within four millimeters at their rendered tips', async () => {
  const source = await read('../terrain-sources.json');
  const calibration = await read('../terrain-calibration.json');
  const models = await read('../terrain-models.json');
  const { rotate } = await import('../src/terrain/geometry.mjs');
  const endpoints = new Map();
  for (const asset of source.assets.filter(asset => asset.name.startsWith('Wall'))) {
    const model = models.models.find(model => model.terrainId === asset.id);
    const geometry = await read(`../${model.model.previewGeometryFile}`);
    const points = geometry.flatMap(mesh => mesh.vertices.map(([x, , z]) => [x / 2.54, z / 2.54]));
    const end = (axis, maximum) => {
      const value = points.reduce(
        (value, p) => (maximum ? Math.max(value, p[axis]) : Math.min(value, p[axis])),
        maximum ? -Infinity : Infinity,
      );
      const tip = points.filter(point => Math.abs(point[axis] - value) < 0.08);
      return [0, 1].map(axis => tip.reduce((sum, p) => sum + p[axis], 0) / tip.length);
    };
    endpoints.set(
      asset.id,
      asset.name === 'Wall Set 4'
        ? [end(0, true), end(1, true)]
        : asset.name === 'Wall Set 5'
          ? [end(0, false), end(1, true)]
          : [end(0, false), end(0, true)],
    );
  }
  for (const join of calibration.connections) {
    const ends = guid => {
      const item = source.maps[join.map - 1].items.find(item => item.ttsGuid === guid);
      const p = calibration.maps[join.map][guid];
      return endpoints.get(item.id).map(([x, z]) => {
        const [xx, , zz] = rotate([x, 0, z], [0, p.rotation, 0]);
        return [xx + p.x, zz + p.z];
      });
    };
    const distance = Math.min(
      ...ends(join.a).flatMap(a => ends(join.b).map(b => Math.hypot(a[0] - b[0], a[1] - b[1]))),
    );
    assert.ok(distance * 25.4 < 4, `${join.map}/${join.a}/${join.b}: ${distance} inches`);
  }
  const ramps = source.maps[4].items.filter(
    item => source.assets.find(a => a.id === item.id).name === 'High Ground',
  );
  for (const ramp of ramps)
    assert.equal(
      Math.abs(calibration.maps['5'][ramp.ttsGuid].x),
      calibration.assets['High Ground'].footprintInches[0] / 2,
    );
});

test('portable terrain drops zero-area source triangles before normal generation', async () => {
  const { assembleTerrain } = await import('../src/terrain/geometry.mjs');
  const { meshes } = assembleTerrain(
    { ttsScale: [1, 1, 1], attachments: [] },
    [{ obj: 'v 0 0 0\nv 1 0 0\nv 0 0 1\nf 1 2 3\nf 1 1 1\n', texture: null }],
    { footprintInches: [1, 1] },
  );
  assert.equal(meshes[0].faces.length, 1);
});

test('wall footprints remain inside the 54 by 36 inch battlefield', async () => {
  const source = await read('../terrain-sources.json'),
    calibration = await read('../terrain-calibration.json');
  for (const map of source.maps.filter(map => map.width === 54))
    for (const item of map.items) {
      const asset = source.assets.find(asset => asset.id === item.id);
      if (!asset.name.startsWith('Wall')) continue;
      const p = calibration.maps[map.number][item.ttsGuid],
        [w, l] = calibration.assets[asset.name].footprintInches;
      const angle = (p.rotation * Math.PI) / 180;
      assert.ok(
        Math.abs(p.x) + (Math.abs(Math.cos(angle)) * w) / 2 + (Math.abs(Math.sin(angle)) * l) / 2 <=
          27 + 1e-8,
      );
      assert.ok(
        Math.abs(p.z) + (Math.abs(Math.sin(angle)) * w) / 2 + (Math.abs(Math.cos(angle)) * l) / 2 <=
          18 + 1e-8,
      );
    }
});

test('temporary built-in hill is absent from terrain and maps', async () => {
  const { builtinTerrains } = await import('../src/terrain/native.mjs');
  const terrains = await read('../Starcraft-test/terrains.json');
  const maps = await read('../Starcraft-test/maps.json');
  assert.equal(builtinTerrains.length, 0);
  assert.deepEqual(
    terrains.filter(t => t.Id === 'Hill snow'),
    builtinTerrains,
  );
  assert.ok(terrains.every(terrain => !('Height' in terrain)));
  assert.ok(maps.every(map => map.Items.every(item => item.Id !== 'Hill snow')));
});
