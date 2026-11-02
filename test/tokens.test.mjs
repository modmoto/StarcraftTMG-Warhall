import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tokenDefinitions, tokenDiameterMm, factionColors } from '../src/tokens/package.mjs';
import { tokenMenuId } from '../src/models/menu-ids.mjs';

const read = async file => JSON.parse(await readFile(new URL(`../${file}`, import.meta.url)));

test('native tokens replace round cards and publish every distinct face', async () => {
  const tokens = (await read('Starcraft/tokens.json')).filter(token =>
    token.Id.startsWith('Starcraft - Token - '),
  );
  const cards = await read('Starcraft/cards.json');
  const catalogue = (await read('model-catalogue.json')).entries.filter(
    entry => entry.kind === 'token',
  );
  const artwork = (await read('token-artwork.json')).artwork;
  assert.equal(tokens.length, 16);
  assert.equal(new Set(tokens.map(token => token.Id)).size, tokens.length);
  assert.equal(catalogue.length, tokens.length);
  assert.ok(!cards.some(card => card.Id.startsWith('sc_token_')));
  assert.ok(!('Tokens' in (await read('Starcraft/hierarchy.json')).Cards));
  for (const token of tokens) {
    assert.equal(token.Type, 'Token');
    assert.ok(!token.UIConfig);
    assert.doesNotMatch(token.Description, /flip/i);
    const skin = catalogue.find(entry => entry.name === token.Id);
    assert.ok(skin);
    assert.equal(skin.tokenDiameterMm, tokenDiameterMm);
    assert.ok(Math.abs(skin.parts[0].transforms.scale * 2.54 - 1) < 1e-12);
    const definition = tokenDefinitions.find(
      definition => tokenMenuId(definition.name) === token.Id,
    );
    const url = new URL(artwork[definition.id]);
    assert.equal(url.protocol, 'https:');
    const file = url.pathname.split('/').at(-1);
    const bytes = await readFile(new URL(`../Starcraft/assets/tokens/${file}`, import.meta.url));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), 1024);
    assert.equal(bytes.readUInt32BE(20), 1024);
  }
  for (const id of [
    'activation_blue_arrow',
    'activation_blue_crosshair',
    'activation_red_arrow',
    'activation_red_crosshair',
    'buff',
    'debuff',
  ]) {
    assert.ok(
      tokens.some(
        token =>
          token.Id === tokenMenuId(tokenDefinitions.find(definition => definition.id === id).name),
      ),
    );
  }
  for (const faction of Object.keys(factionColors)) {
    const pair = tokenDefinitions.filter(token => token.symbol === faction.toLowerCase());
    assert.deepEqual(
      pair.map(token => token.inverted),
      [false, true],
    );
    assert.notEqual(artwork[pair[0].id], artwork[pair[1].id]);
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
