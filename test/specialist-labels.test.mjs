import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFromCommandCenter } from '../src/convert.mjs';
import { validateData } from '../src/warhall/validate.mjs';

test('data validation rejects an uncoloured specialist label in any faction', async () => {
  const { data } = await buildFromCommandCenter();
  const options = data['options.json'].filter(option =>
    option.ItemsToAdd?.some(item => item.Id === 'rule_keyword_specialist'),
  );
  assert.ok(options.length > 0);
  validateData(data);
  for (const option of options) {
    const original = option.Name;
    try {
      option.Name = original.replace(/<[^>]+>/g, '');
      assert.throws(
        () => validateData(data),
        /Specialist options require a blue clickable description link/,
      );
    } finally {
      option.Name = original;
    }
  }
});
