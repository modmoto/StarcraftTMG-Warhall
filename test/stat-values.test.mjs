import test from 'node:test';
import assert from 'node:assert/strict';
import { upgradedHealth, healthNumber } from '../src/warhall/stat-values.mjs';

test('blue HP displays only the upgraded number and remains readable by the native wounds parser', () => {
  const value = upgradedHealth(6);
  assert.equal(value.replace(/<size=0>[\s\S]*?<\/size>/g, '').replace(/<[^>]+>/g, ''), '6');
  assert.equal(Number(value.match(/\((\d+)\)/)[1]), 6);
  assert.equal(healthNumber(value), 6);
  assert.equal(healthNumber('5'), 5);
  assert.ok(Number.isNaN(healthNumber('<color=#2596be>6</color><size=0>(5)</size>')));
  assert.throws(() => upgradedHealth(0), /Invalid/);
});
