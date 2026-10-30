import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from '../src/paths.mjs';
import { nativeMarkers } from '../src/deployments/markers.mjs';
const [directory, mode = '--dry-run'] = process.argv.slice(2);
assert.ok(
  directory,
  'Usage: node scripts/install-warhall-marker-cache.mjs DATABASE [--apply|--dry-run]',
);
assert.ok(['--apply', '--dry-run'].includes(mode));
const root = await realpath(directory);
assert.equal(path.basename(root), 'Database');
assert.equal(path.basename(path.dirname(root)), 'WarhallTest');
const decode = bytes => {
  const text = bytes.toString();
  assert.ok(text.startsWith('1L4HR4W'));
  return JSON.parse(Buffer.from(text.slice(7), 'base64').toString());
};
const names = ['AllItems', 'AllItemInstances'],
  originals = {},
  tables = {};
for (const name of names) {
  originals[name] = await readFile(path.join(root, name));
  tables[name] = decode(originals[name]);
}
const games = decode(await readFile(path.join(root, 'GetGames'))),
  game = games.find(g => g.GameName === 'Starcraft');
assert.ok(game);
const skins = decode(await readFile(path.join(root, 'AllSkinData')));
for (const [index, marker] of nativeMarkers.entries()) {
  const id = 1800000001 + index,
    wdsId = `sc_mission_${marker.color}`;
  assert.ok(
    skins.some(s => s.IdSkin === marker.skinId),
    'Existing native skin missing',
  );
  const existing = tables.AllItems.find(i => i.IdItem === id);
  assert.ok(
    !existing || (existing.ItemName === wdsId && existing.FromIdGame === game.IdGame),
    'Item ID collision',
  );
  tables.AllItems = tables.AllItems.filter(i => i.IdItem !== id);
  tables.AllItemInstances = tables.AllItemInstances.filter(i => i.ItemInstanceIdItem !== id);
  tables.AllItems.push({
    IdItem: id,
    ItemName: wdsId,
    FromIdGame: game.IdGame,
    IdModifier: null,
    ModifierName: null,
    BaseWidth: 4,
    BaseHeight: 3.5,
    BaseLength: 4,
    IsRound: 1,
  });
  tables.AllItemInstances.push({
    IdItemInstance: id,
    CostumeIdSkin: marker.skinId,
    ItemInstanceIdItem: id,
    ItemInstanceIdModifier: null,
    ItemInstanceFromGame: game.IdGame,
    ScenarioIndex: 0,
  });
}
if (mode === '--apply') {
  const backup = path.join(projectRoot, '.cache', `warhall-marker-backup-${Date.now()}`);
  await mkdir(backup, { recursive: true });
  for (const n of names) await copyFile(path.join(root, n), path.join(backup, n));
  try {
    for (const n of names)
      await writeFile(
        path.join(root, n),
        '1L4HR4W' + Buffer.from(JSON.stringify(tables[n])).toString('base64'),
      );
  } catch (error) {
    for (const n of names) await writeFile(path.join(root, n), originals[n]);
    throw error;
  }
  console.log(`Backup: ${backup}`);
}
console.log(
  `${mode}: three existing Warhall marker skins associated with Starcraft terrain. No meshes, textures or skins created.`,
);
