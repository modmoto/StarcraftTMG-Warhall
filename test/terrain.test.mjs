import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
test('five standard terrain maps retain all TTS pieces and world model positions', async () => {
  const source = await read('../terrain-sources.json');
  const maps = await read('../Starcraft/maps.json');
  const models = await read('../terrain-models.json');
  const terrains = await read('../Starcraft/terrains.json');
  assert.equal(maps.length, 5);
  assert.deepEqual(
    maps.map(m => m.Items.length),
    [30, 30, 30, 30, 32],
  );
  for (const [i, map] of maps.entries()) {
    assert.equal(source.maps[i].width, 54);
    assert.equal(source.maps[i].height, 36);
    for (const [j, item] of map.Items.entries()) {
      const original = source.maps[i].items[j];
      const model = models.models.find(m => m.terrainId === item.Id);
      assert.ok(model && terrains.some(t => t.Id === item.Id && t.Type === 'Terrain'));
      const [dx, , dz] = model.layout.position.map(v => v / 2.54);
      const a = (item.Rotation * Math.PI) / 180;
      const x = 27 - item.ShortSide + Math.cos(a) * dx + Math.sin(a) * dz;
      const z = item.LongSide - 18 - Math.sin(a) * dx + Math.cos(a) * dz;
      assert.ok(Math.abs(x - original.x) < 1e-9);
      assert.ok(Math.abs(z - original.z) < 1e-9);
      assert.equal(item.Type, 'Terrain');
      assert.equal(new URL(model.model.meshUrl).protocol, 'https:');
      assert.equal(new URL(model.model.textureUrl).protocol, 'https:');
    }
  }
});
