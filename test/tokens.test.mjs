import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tokenDefinitions, tokenDiameterMm, factionColors } from '../src/tokens/package.mjs';
import { tokenMenuId } from '../src/models/menu-ids.mjs';

const read = async file => JSON.parse(await readFile(new URL(`../${file}`, import.meta.url)));

test('native tokens replace round cards and publish every distinct face', async () => {
  const tokens = (await read('Starcraft/tokens.json')).filter(
    token => token.Id.startsWith('Starcraft - Token - ') && !token.IsTemplate,
  );
  const cards = await read('Starcraft/cards.json');
  const catalogue = (await read('model-catalogue.json')).entries.filter(
    entry =>
      entry.kind === 'token' &&
      !['Token5Inch', 'sc_token_fire_wall', 'sc_token_flamer_template'].includes(entry.profileId),
  );
  const artwork = (await read('token-artwork.json')).artwork;
  assert.equal(tokens.length, 18);
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

test('native Warhall references are removed while the custom Blast Template remains', async () => {
  const { nativeTokens, builtinTokenNames } = await import('../src/tokens/package.mjs');
  assert.deepEqual(builtinTokenNames, []);
  const generated = nativeTokens();
  assert.deepEqual(generated, await read('Starcraft/tokens.json'));
  assert.ok(
    generated.every(token => !token.Id.startsWith('TokenWarhall') && token.Id !== 'Token3Inch'),
  );
  assert.deepEqual(generated[0], {
    Id: 'Token5Inch',
    Name: 'Blast Template',
    Type: 'Token',
    IsTemplate: true,
  });
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
      token.IsTemplate
        ? ['Id', 'Name', 'Type', 'IsTemplate']
        : token.RadiusBaseDiameterMm
          ? ['Id', 'Name', 'Type', 'RadiusBaseDiameterMm']
          : ['Id', 'Name', 'Type'],
    );
});

test('maps place both activation colours in stacks of 15 at each player end', async () => {
  const { tokenTrayPlacements } = await import('../src/tokens/tray.mjs');
  for (const [width, height] of [
    [54, 36],
    [36, 36],
    [54, 48],
  ]) {
    const placements = tokenTrayPlacements({ width, height });
    assert.equal(placements.length, 60);
    const stacks = Map.groupBy(placements, item => JSON.stringify(item));
    assert.equal(stacks.size, 4);
    for (const stack of stacks.values()) assert.equal(stack.length, 15);
    for (const end of Map.groupBy(placements, item => item.LongSide).values()) {
      assert.equal(end.length, 30);
      assert.equal(new Set(end.map(item => item.Id)).size, 2);
      const columns = [...new Set(end.map(item => item.ShortSide))];
      assert.ok(Math.abs(columns[1] - columns[0]) * 25.4 > 32);
    }
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
    ['Token5Inch', 'Starcraft - Token - Flamer Template', 'Starcraft - Token - Wall Template'],
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
    assert.equal(tokens.length, 60);
    assert.equal(tokens.filter(token => token.Id === 'Activation - blue - movement').length, 30);
    assert.equal(tokens.filter(token => token.Id === 'Activation - red - movement').length, 30);
  }
});

test('token menu groups templates, activation, factions, buffs and sorted effects', async () => {
  const tokens = await read('Starcraft/tokens.json');
  assert.deepEqual(
    tokens.map(token => token.Name),
    [
      'Blast Template',
      'Flamer Template',
      'Activation - blue - movement',
      'Activation - red - movement',
      'Terran - blue',
      'Terran - white',
      'Protoss - yellow',
      'Protoss - white',
      'Zerg - purple',
      'Zerg - white',
      'Buff',
      'Debuff',
      'Bile Bomb',
      'Corrosive Bile',
      'Burrowed',
      'Creep Tumor',
      'Wall Template',
      'Hidden',
      'Infestation',
      'Siege Status',
      'Stim',
      ...[1, 2, 3, 4, 5].map(
        number =>
          `Starcraft - Terrain - Mission marker ${number} - ${number === 5 ? 'green' : number % 2 ? 'red' : 'blue'}`,
      ),
    ],
  );
});

test('Blast Template exports only a flat orange ring without fill or cylinder', async () => {
  const { blastTemplateGeometry, blastTemplateOrange } =
    await import('../src/tokens/blast-template.mjs');
  const ring = blastTemplateGeometry();
  assert.deepEqual([...ring.texture.data], [...blastTemplateOrange, 255]);
  const radii = ring.vertices.map(v => Math.hypot(v[0], v[2]));
  assert.ok(Math.abs(Math.max(...radii) - 6.5) < 1e-9);
  assert.ok(Math.abs(Math.min(...radii) - 6.3) < 1e-9);
  assert.ok(ring.vertices.every(v => Math.abs(v[1] - 0.08) < 1e-9));
  assert.ok(ring.vertices.every(v => Math.hypot(v[0], v[2]) >= 6.3 - 1e-9));
  const entry = (await read('model-catalogue.json')).entries.find(
    e => e.profileId === 'Token5Inch',
  );
  const preview = await read(entry.parts[0].previewGeometryFile);
  assert.equal(preview.length, 1);
  assert.ok(preview[0].vertices.every(v => Math.hypot(v[0], v[2]) >= 6.3 - 1e-9));
});

test('all ordinary and objective tokens use native 32mm edge measurement', async () => {
  const { nativeTokens } = await import('../src/tokens/package.mjs');
  const based = nativeTokens().filter(token => token.RadiusBaseDiameterMm !== undefined);
  assert.equal(based.length, 23);
  assert.ok(based.every(token => token.RadiusBaseDiameterMm === 32));
  for (const name of ['Bile Bomb', 'Corrosive Bile'])
    assert.ok(based.some(token => token.Name === name));
  const terrains = await read('Starcraft/terrains.json');
  assert.ok(terrains.every(terrain => !terrain.Id.includes('Mission marker ')));
});

test('all gameplay tokens have 32mm geometry and two native flip faces', async () => {
  const catalogue = await read('model-catalogue.json');
  for (const token of tokenDefinitions) {
    assert.equal(token.diameterMm, 32);
    assert.ok(token.backSymbol);
    const entry = catalogue.entries.find(entry => entry.profileId === `sc_token_${token.id}`);
    const meshes = await read(entry.parts[0].previewGeometryFile);
    assert.equal(entry.tokenDiameterMm, 32);
    assert.ok(meshes[0].vertices.every(v => Math.abs(v[1] - 0.08) < 1e-9));
    const underside = meshes.find(mesh => mesh.vertices.every(v => Math.abs(v[1] + 0.08) < 1e-9));
    assert.ok(underside, token.id);
    const ys = meshes.flatMap(mesh => mesh.vertices.map(v => v[1]));
    assert.ok(Math.abs(Math.max(...ys) + Math.min(...ys)) < 1e-8, token.id);
  }
});

test('Fire Wall is an orange open 40x100mm oval template without a circular measurement base', async () => {
  const { fireWallGeometry } = await import('../src/tokens/fire-wall-template.mjs');
  const token = (await read('Starcraft/tokens.json')).find(t => t.Name === 'Wall Template');
  assert.equal(token.IsTemplate, true);
  assert.ok(!('RadiusBaseDiameterMm' in token));
  const mesh = fireWallGeometry();
  assert.deepEqual([...mesh.texture.data], [255, 132, 24, 255]);
  for (const [axis, size] of [
    [0, 4],
    [2, 10],
  ]) {
    const values = mesh.vertices.map(v => v[axis]);
    assert.ok(Math.abs(Math.max(...values) - Math.min(...values) - size) < 1e-9);
  }
  assert.ok(
    mesh.vertices.every(([x, , z]) => (x * x) / (1.8 * 1.8) + (z * z) / (4.8 * 4.8) > 0.99999),
  );
});

test('Flamer Template uses the TTS dimensions without a 32mm base', async () => {
  const config = await read('flamer-template.json');
  const { flamerTemplateGeometry } = await import('../src/tokens/flamer-template.mjs');
  assert.ok(Math.abs(config.lengthMm - 210.4825627) < 0.01);
  assert.ok(Math.abs(config.widthMm - 61.2930484) < 0.01);
  const t = (await read('Starcraft/tokens.json')).find(t => t.Name === 'Flamer Template');
  assert.equal(t.IsTemplate, true);
  assert.ok(!t.RadiusBaseDiameterMm);
  const mesh = flamerTemplateGeometry();
  for (const [axis, size] of [
    [0, config.widthMm / 10],
    [2, config.lengthMm / 10],
  ]) {
    const values = mesh.vertices.map(p => p[axis]);
    assert.ok(Math.abs(Math.max(...values) - Math.min(...values) - size) < 1e-6);
  }
  assert.ok(
    mesh.vertices.every(v => Number.isFinite(v[0]) && v[1] === 0.08 && Number.isFinite(v[2])),
  );
});
