import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
test('board cards are sharp, contain no unit cards, and have clean descriptions', async () => {
  const cards = await read('../Starcraft/cards.json');
  const hierarchy = await read('../Starcraft/hierarchy.json');
  const report = await read('../cards-report.json');
  assert.equal(cards.length, 63);
  assert.equal(report.imageDpi, 360);
  assert.equal(report.unitCards, false);
  assert.ok(Object.keys(hierarchy.Cards).every(group => !group.endsWith(' units')));
  for (const card of cards) {
    assert.ok(card.Description.startsWith(card.Name));
    assert.doesNotMatch(card.Description, /©|Blizzard|Archon|v\s*1\.\d/i);
    for (const key of ['ImageURL', 'ImageURLBack']) {
      const name = new URL(card.UIConfig[key]).pathname.split('/').at(-1);
      assert.match(name, /^[a-f0-9]+\.png$/);
      const image = await readFile(new URL(`../Starcraft/assets/cards/${name}`, import.meta.url));
      assert.equal(image.subarray(1, 4).toString(), 'PNG');
      assert.ok(
        Math.min(image.readUInt32BE(16), image.readUInt32BE(20)) >= 850,
        `${card.Name} is too small`,
      );
    }
  }
  const objectives = await read('../Starcraft/objectives.json');
  assert.equal(objectives.length, 7);
  assert.ok(objectives.every(o => o.Items.length === 0));
});
