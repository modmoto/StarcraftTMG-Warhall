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
    entry => entry.kind === 'token' && entry.profileId !== 'Token5Inch',
  );
  const artwork = (await read('token-artwork.json')).artwork;
  assert.equal(tokens.length, 17);
  assert.equal(new Set(tokens.map(token => token.Id)).size, tokens.length);
  assert.equal(catalogue.length, tokens.length);
  assert.ok(!cards.some(card => card.Id.startsWith('sc_token_')));
  assert.ok(!('Tokens' in (await read('Starcraft/hierarchy.json')).Cards));
  for (const token of tokens) {
    assert.equal(token.Type, 'Token');
    assert.ok(!token.UIConfig);
    assert.equal('Description' in token, false);
    const skin = catalogue.find(entry => entry.name === token.Id);
    assert.ok(skin);
    assert.ok(Math.abs(skin.parts[0].transforms.scale * 2.54 - 1) < 1e-12);
    const definition = tokenDefinitions.find(
      definition => tokenMenuId(definition.name) === token.Id,
    );
    assert.equal(skin.tokenDiameterMm, definition.diameterMm ?? tokenDiameterMm);
    const url = new URL(artwork[definition.id]);
    assert.equal(url.protocol, 'https:');
    const file = url.pathname.split('/').at(-1);
    const bytes = await readFile(new URL(`../Starcraft/assets/tokens/${file}`, import.meta.url));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), 1024);
    assert.equal(bytes.readUInt32BE(20), 1024);
  }
  for (const id of ['activation_blue_arrow', 'activation_red_arrow', 'buff', 'debuff']) {
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

test('all seven native tokens retain their prefab identities without duplicate uploads', async () => {
  const { nativeTokens, builtinTokenNames } = await import('../src/tokens/package.mjs');
  assert.deepEqual(builtinTokenNames, [
    'TokenWarhallBlue',
    'TokenWarhallOrange',
    'TokenWarhallBlack',
    'TokenWarhallWhite',
    'TokenWarhallPurple',
    'Token3Inch',
    'Token5Inch',
  ]);
  const generated = nativeTokens();
  const shipped = await read('Starcraft/tokens.json');
  const catalogue = await read('model-catalogue.json');
  for (const name of builtinTokenNames) {
    const reference = {
      Id: name,
      Name: name === 'Token5Inch' ? 'Blast Template' : name,
      Type: 'Token',
      ...(name === 'Token5Inch' ? { IsTemplate: true } : {}),
    };
    assert.deepEqual(
      generated.filter(token => token.Id === name),
      [reference],
    );
    assert.deepEqual(
      shipped.filter(token => token.Id === name),
      [reference],
    );
    assert.equal(
      catalogue.entries.some(entry => entry.profileId === name),
      name === 'Token5Inch',
    );
  }
});

test('generator reproduces the editor token records and catalogue order exactly', async () => {
  const { nativeTokens } = await import('../src/tokens/package.mjs');
  const order = await read('token-menu-order.json');
  const tokens = nativeTokens();
  assert.deepEqual(tokens, await read('Starcraft/tokens.json'));
  assert.deepEqual(
    tokens.map(token => token.Id),
    order,
  );
  assert.equal(new Set(order).size, tokens.length);
  for (const token of tokens)
    assert.deepEqual(
      Object.keys(token),
      token.Id === 'Token5Inch' ? ['Id', 'Name', 'Type', 'IsTemplate'] : ['Id', 'Name', 'Type'],
    );
});

test('maps place only two activation stacks of 15 outside the battlefield', async () => {
  const { tokenTrayPlacements } = await import('../src/tokens/tray.mjs');
  for (const [width, height] of [
    [54, 36],
    [36, 36],
    [54, 48],
  ]) {
    const placements = tokenTrayPlacements({ width, height });
    assert.equal(placements.length, 30);
    const stacks = Map.groupBy(placements, item => JSON.stringify(item));
    assert.equal(stacks.size, 2);
    for (const stack of stacks.values()) assert.equal(stack.length, 15);
    assert.ok(
      placements.every(item => item.Id.startsWith('Activation - ') && item.Id.endsWith('movement')),
    );
    const ends = placements.map(item => item.LongSide - 18);
    const radius = 16 / 25.4;
    assert.ok(Math.abs(Math.min(...ends) - radius + height / 2) < 1e-9);
    assert.ok(Math.abs(Math.max(...ends) + radius - height / 2) < 1e-9);
    assert.ok(ends.every(z => Math.abs(z) * 2.54 - 1.6 > 20));
  }
});

test('Blast Template uses the native template flag and a 130 mm circular mesh', async () => {
  const { blastTemplateGeometry } = await import('../src/tokens/blast-template.mjs');
  const tokens = await read('Starcraft/tokens.json');
  assert.deepEqual(
    tokens.filter(token => token.IsTemplate).map(token => token.Id),
    ['Token5Inch'],
  );
  const template = (await read('model-catalogue.json')).entries.find(
    e => e.profileId === 'Token5Inch',
  );
  assert.equal(template.tokenDiameterMm, 130);
  assert.match(template.parts[0].modelUrl, /\.unity3d$/);
  const { vertices } = blastTemplateGeometry();
  for (const axis of [0, 2]) {
    const diameterCm =
      Math.max(...vertices.map(v => v[axis])) - Math.min(...vertices.map(v => v[axis]));
    assert.ok(Math.abs(diameterCm - 13) < 1e-9);
    assert.ok(Math.abs(diameterCm * template.parts[0].transforms.scale * 25.4 - 130) < 1e-9);
  }
});

test('activation markers have Movement fronts and Assault backs without separate Assault records', async () => {
  const activation = tokenDefinitions.filter(token => token.id.startsWith('activation_'));
  assert.equal(activation.length, 2);
  const tokens = await read('Starcraft/tokens.json');
  const maps = await read('Starcraft/maps.json');
  const catalogue = await read('model-catalogue.json');
  assert.ok(tokens.every(token => !/Activation.*assault/.test(token.Id)));
  assert.ok(maps.every(map => map.Items.every(item => !/Activation.*assault/.test(item.Id))));
  for (const token of activation) {
    assert.equal(token.symbol, 'arrow');
    assert.equal(token.backSymbol, 'crosshair');
    const skin = catalogue.entries.find(entry => entry.profileId === `sc_token_${token.id}`);
    const meshes = await read(skin.parts[0].previewGeometryFile);
    assert.equal(meshes.length, 3);
    assert.ok(meshes[0].vertices.every(v => Math.abs(v[1] - 0.08) < 1e-9));
    assert.ok(meshes[2].vertices.every(v => Math.abs(v[1] + 0.08) < 1e-9));
    assert.notEqual(meshes[0].texture.png, meshes[2].texture.png);
  }
});

test('Shield token is absent from definitions, menu, maps and active skins', async () => {
  assert.ok(tokenDefinitions.every(token => token.id !== 'shield'));
  assert.ok(
    (await read('Starcraft/tokens.json')).every(token => token.Id !== 'Starcraft - Token - Shield'),
  );
  assert.ok(
    (await read('model-catalogue.json')).entries.every(
      entry => entry.profileId !== 'sc_token_shield',
    ),
  );
  for (const map of await read('Starcraft/maps.json')) {
    const tokens = map.Items.filter(item => item.Type === 'Token');
    assert.equal(tokens.length, 30);
    assert.equal(tokens.filter(token => token.Id === 'Activation - blue - movement').length, 15);
    assert.equal(tokens.filter(token => token.Id === 'Activation - red - movement').length, 15);
  }
});
