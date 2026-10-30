import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from '../src/paths.mjs';

// Local test adapter for the current Warhall Test catalogue format. This does
// not upload models or modify Warhall's shared database. Close the client first.
const [directory, mode = '--dry-run'] = process.argv.slice(2);
assert.ok(
  directory,
  'Usage: node scripts/install-warhall-model-cache.mjs DATABASE [--apply|--dry-run]',
);
assert.ok(['--apply', '--dry-run'].includes(mode), 'Unknown mode');
const database = await realpath(directory);
assert.equal(path.basename(database), 'Database');
assert.equal(
  path.basename(path.dirname(database)),
  'WarhallTest',
  'Only the test-client cache is supported',
);
const names = ['AllItems', 'AllItemInstances', 'AllSkinData', 'AllSkinParts', 'AllSkinLayers'];
const decode = bytes => {
  const encoded = bytes.toString('utf8');
  assert.ok(encoded.startsWith('1L4HR4W'), 'Unexpected cache format');
  return JSON.parse(Buffer.from(encoded.slice(7), 'base64').toString('utf8'));
};
const originals = {};
const tables = {};
for (const name of names) {
  originals[name] = await readFile(path.join(database, name));
  tables[name] = decode(originals[name]);
  assert.ok(Array.isArray(tables[name]), `Invalid table ${name}`);
}
const games = decode(await readFile(path.join(database, 'GetGames')));
const game = games.find(game => game.GameName === 'Starcraft');
assert.ok(game, 'Exact-case Starcraft game entry not found');
const prefix = '[Starcraft CDN local test] ';
const ownedSkins = new Set(
  tables.AllSkinData.filter(s => s.CompleteSkinName.startsWith(prefix)).map(s => s.IdSkin),
);
const ownedParts = new Set(
  tables.AllSkinLayers.filter(l => ownedSkins.has(l.SkinLayerIdSkin)).map(
    l => l.SkinLayerIdSkinPart,
  ),
);
const ownedItems = new Set(
  tables.AllItemInstances.filter(i => ownedSkins.has(i.CostumeIdSkin)).map(
    i => i.ItemInstanceIdItem,
  ),
);
tables.AllSkinData = tables.AllSkinData.filter(s => !ownedSkins.has(s.IdSkin));
tables.AllSkinLayers = tables.AllSkinLayers.filter(l => !ownedSkins.has(l.SkinLayerIdSkin));
tables.AllSkinParts = tables.AllSkinParts.filter(p => !ownedParts.has(p.IdSkinPart));
tables.AllItemInstances = tables.AllItemInstances.filter(i => !ownedSkins.has(i.CostumeIdSkin));
tables.AllItems = tables.AllItems.filter(i => !ownedItems.has(i.IdItem));
const fields = {
  AllItems: 'IdItem',
  AllItemInstances: 'IdItemInstance',
  AllSkinData: 'IdSkin',
  AllSkinParts: 'IdSkinPart',
  AllSkinLayers: 'AuxIdSkinLayer',
};
const next = Object.fromEntries(
  names.map(n => [n, Math.max(1_000_000_000, ...tables[n].map(row => row[fields[n]] + 1))]),
);
const selection = JSON.parse(
  await readFile(path.join(projectRoot, 'model-selections.json'), 'utf8'),
);
let installed = 0;
for (const model of selection.models.filter(m => m.status === 'selected')) {
  const units = JSON.parse(
    await readFile(path.join(projectRoot, 'Starcraft', model.faction, 'units.json'), 'utf8'),
  );
  const unit = units.find(u => u.Id === model.unitId);
  assert.equal(unit?.BasicProfileIds.length, 1, `Expected one basic profile: ${model.unitName}`);
  const profileId = unit.BasicProfileIds[0];
  assert.ok(
    !tables.AllItems.some(i => i.FromIdGame === game.IdGame && i.ItemName === profileId),
    `Existing shared mapping: ${profileId}`,
  );
  const itemId = next.AllItems++;
  const skinId = next.AllSkinData++;
  const partId = next.AllSkinParts++;
  for (const url of [model.model.meshUrl, model.model.textureUrl]) {
    assert.equal(new URL(url).protocol, 'https:', 'CDN URL must use HTTPS');
  }
  tables.AllItems.push({
    IdItem: itemId,
    ItemName: profileId,
    FromIdGame: game.IdGame,
    IdModifier: null,
    ModifierName: null,
    BaseWidth: null,
    BaseHeight: null,
    BaseLength: null,
    IsRound: 0,
  });
  tables.AllItemInstances.push({
    IdItemInstance: next.AllItemInstances++,
    CostumeIdSkin: skinId,
    ItemInstanceIdItem: itemId,
    ItemInstanceIdModifier: null,
    ItemInstanceFromGame: game.IdGame,
    ScenarioIndex: 0,
  });
  tables.AllSkinData.push({
    IdSkin: skinId,
    CompleteSkinName: prefix + model.unitName,
    SkinUserId: 'local-starcraft-cdn-test',
    Thumbnail: '',
    Shop: null,
    PublicSkin: 1,
    PaidSkin: 0,
  });
  tables.AllSkinParts.push({
    IdSkinPart: partId,
    SkinPartResource: model.model.meshUrl,
    SkinPartTexture: model.model.textureUrl,
  });
  tables.AllSkinLayers.push({
    AuxIdSkinLayer: next.AllSkinLayers++,
    SkinLayerIdSkin: skinId,
    SkinLayerIdSkinPart: partId,
    SkinLayerIdSkinType: 1,
    SkinLayerIdCount: 1,
    ParentIdAuxSkinLayer: null,
    SocketPositionX: 0,
    SocketPositionY: 0,
    SocketPositionZ: 0,
    SocketRotationX: 0,
    SocketRotationY: 0,
    SocketRotationZ: 0,
    SkinLayerSize: Math.abs(model.model.ttsTransform.scaleY),
    UseLegacyScale: 1,
  });
  installed++;
}
if (mode === '--apply') {
  const backup = path.join(projectRoot, '.cache', `warhall-model-backup-${Date.now()}`);
  await mkdir(backup, { recursive: true });
  for (const name of names) await copyFile(path.join(database, name), path.join(backup, name));
  try {
    for (const name of names) {
      const contents =
        '1L4HR4W' + Buffer.from(JSON.stringify(tables[name]), 'utf8').toString('base64');
      await writeFile(path.join(database, name), contents, 'utf8');
    }
  } catch (error) {
    for (const name of names) await writeFile(path.join(database, name), originals[name]);
    throw error;
  }
  console.log(`Backup: ${backup}`);
}
console.log(
  `${mode}: ${installed} CDN model mappings for game ${game.IdGame}. 3 multipart models and Vile remain pending. Shared catalogue updates can replace this local test cache.`,
);
