import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tokenDefinitions, tokenDiameterMm, factionColors } from '../src/tokens/package.mjs';

const read = async file => JSON.parse(await readFile(new URL(`../${file}`, import.meta.url)));

test('round tokens retain both faces, inverted faction sets and remote artwork', async () => {
  const cards = (await read('Starcraft/cards.json')).filter(card =>
    card.Id.startsWith('sc_token_'),
  );
  assert.equal(cards.length, 13);
  assert.equal(new Set(cards.map(card => card.Id)).size, cards.length);
  const group = (await read('Starcraft/hierarchy.json')).Cards.Tokens;
  assert.deepEqual(new Set(group), new Set(cards.map(card => card.Id)));
  for (const card of cards) {
    assert.equal(card.Type, 'Card');
    assert.equal(card.UIConfig.Width, tokenDiameterMm);
    assert.equal(card.UIConfig.Length, tokenDiameterMm);
    assert.equal(card.UIConfig.IsRound, true);
    for (const key of ['ImageURL', 'ImageURLBack']) {
      const url = new URL(card.UIConfig[key]);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.hostname, 'raw.githubusercontent.com');
      const file = url.pathname.split('/').at(-1);
      const bytes = await readFile(new URL(`../Starcraft/assets/tokens/${file}`, import.meta.url));
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      assert.equal(bytes.readUInt32BE(16), 1024);
      assert.equal(bytes.readUInt32BE(20), 1024);
    }
  }
  for (const name of ['activation_blue', 'activation_red', 'buff_debuff']) {
    const token = cards.find(card => card.Id === `sc_token_${name}`);
    assert.notEqual(token.UIConfig.ImageURL, token.UIConfig.ImageURLBack);
  }
  for (const faction of Object.keys(factionColors)) {
    const pair = tokenDefinitions.filter(token => token.front === faction.toLowerCase());
    assert.deepEqual(
      pair.map(token => token.inverted),
      [false, true],
    );
    const faces = pair.map(
      token => cards.find(card => card.Id === `sc_token_${token.id}`).UIConfig.ImageURL,
    );
    assert.notEqual(faces[0], faces[1]);
  }
});

test('all faction names match icon lookup and icons ship in the manifest', async () => {
  const icons = await read('Starcraft/icons.json');
  const factions = Object.keys((await read('Starcraft/hierarchy.json')).Factions);
  assert.ok((await read('Starcraft/manifest.json')).files.includes('icons.json'));
  assert.deepEqual(icons.map(icon => icon.Name).sort(), factions.sort());
  for (const icon of icons) {
    assert.equal(icon.Name, icon.Name.trim());
    assert.equal(icon.Type, 'faction');
    assert.equal(new URL(icon.URL).protocol, 'https:');
    const file = new URL(icon.URL).pathname.split('/').at(-1);
    assert.ok(
      (await readFile(new URL(`../Starcraft/assets/tokens/${file}`, import.meta.url))).length > 100,
    );
  }
});
