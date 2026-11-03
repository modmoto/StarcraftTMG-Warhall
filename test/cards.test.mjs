import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
test('board cards are sharp, contain no unit cards, and have clean descriptions', async () => {
  const cards = (await read('../Starcraft-test/cards.json')).filter(
    card => !card.Id.startsWith('sc_token_'),
  );
  const hierarchy = await read('../Starcraft-test/hierarchy.json');
  const report = await read('../cards-report.json');
  assert.equal(cards.length, 63);
  assert.equal(report.imageDpi, 600);
  assert.equal(report.unitCards, false);
  assert.ok(Object.keys(hierarchy.Cards).every(group => !group.endsWith(' units')));
  for (const card of cards) {
    assert.ok(!card.Description.startsWith(card.Name));
    assert.equal(card.UIConfig.Color2, '');
    assert.doesNotMatch(card.Description, /©|Blizzard|Archon|v\s*1\.\d/i);
    for (const key of ['ImageURL', 'ImageURLBack']) {
      const name = new URL(card.UIConfig[key]).pathname.split('/').at(-1);
      assert.match(name, /^[a-z0-9_-]+-[a-f0-9]{12}\.png$/);
      const image = await readFile(
        new URL(`../Starcraft-test/assets/cards/${name}`, import.meta.url),
      );
      assert.equal(image.subarray(1, 4).toString(), 'PNG');
      assert.equal(image[25], 6, 'Card image must retain RGBA transparency');
      assert.ok(
        Math.max(image.readUInt32BE(16), image.readUInt32BE(20)) === 2048,
        `${card.Name} is too small`,
      );
    }
  }
  const objectives = await read('../Starcraft-test/objectives.json');
  assert.deepEqual(objectives, []);
  const config = await read('../Starcraft-test/gameconfig.json');
  assert.equal(config.ShowObjectiveSection, false);
  assert.equal(config.ShowDeploymentSection, true);
  assert.equal((await read('../Starcraft-test/deployments.json')).length, 7);
});
