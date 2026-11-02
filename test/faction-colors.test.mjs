import test from 'node:test';
import assert from 'node:assert/strict';
import { factionTexture } from '../src/models/faction-colors.mjs';

test('faction palettes unify colored pixels while preserving neutral shading and alpha', () => {
  const original = {
    width: 3,
    height: 1,
    data: Buffer.from([200, 20, 20, 255, 100, 100, 100, 90, 10, 4, 4, 0]),
  };
  for (const [faction, dominant] of [
    ['Terran', 2],
    ['Protoss', 0],
    ['Zerg', 2],
  ]) {
    const result = factionTexture(original, faction);
    assert.equal(Math.max(...result.data.subarray(0, 3)), 200);
    assert.equal(result.data[dominant], 200);
    assert.deepEqual(result.data.subarray(4), original.data.subarray(4));
    assert.equal(result.data[3], 255);
  }
  assert.deepEqual([...original.data.subarray(0, 3)], [200, 20, 20]);
  assert.throws(() => factionTexture(original, 'unknown'), /Unknown faction/);
});
