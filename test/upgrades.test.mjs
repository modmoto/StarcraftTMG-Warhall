import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyProfileOptions, flattenProfile } from '../src/lists/apply-options.mjs';

const data = {};
data['options.json'] = JSON.parse(
  await readFile(new URL('../Starcraft-test/options.json', import.meta.url)),
);
for (const faction of ['Protoss', 'Terran', 'Zerg']) {
  for (const file of [
    'units',
    'profiles',
    'rules',
    'equipment',
    'statlines',
    'options',
    'modifiedprofile',
    'modifiedunit',
  ]) {
    data[`${faction}/${file}.json`] = JSON.parse(
      await readFile(new URL(`../Starcraft-test/${faction}/${file}.json`, import.meta.url)),
    );
  }
}
const plain = text => text.replace(/<[^>]+>/g, '');
function unitProfile(name, choices = []) {
  const unit = Object.values(data)
    .flat()
    .find(record => record.Type === 'Unit' && record.Name === name);
  assert.ok(unit, name);
  const mappings = Object.entries(data)
    .filter(([file]) => file.endsWith('/modifiedunit.json'))
    .flatMap(([, values]) => values);
  const available = new Set(
    mappings.filter(mapping => mapping.UnitId === unit.Id).map(mapping => mapping.OptionId),
  );
  const options = Object.entries(data)
    .filter(([file]) => /(?:^|\/)options\.json$/.test(file))
    .flatMap(([, values]) => values);
  const ids = choices.map(choice => {
    const option = options.find(
      option => available.has(option.Id) && option.Name.toLowerCase() === choice.toLowerCase(),
    );
    assert.ok(option, `${name}: ${choice}`);
    return option.Id;
  });
  return flattenProfile(applyProfileOptions(data, unit.BasicProfileIds[0], unit.Id, ids));
}
const weapons = profile =>
  profile.filter(row => row.Id.endsWith('_heading')).map(row => plain(row.Description));

test('Kinetic Foam changes the top HP row from 5 to 6 and selected blue rules precede weapons', () => {
  const base = unitProfile('Marauders');
  assert.equal(base.find(row => row.Type === 'Statline').Attributes.HP, '5');
  for (const order of [
    ['Kinetic Foam', 'Veteran of Tarsonis'],
    ['Veteran of Tarsonis', 'Kinetic Foam'],
  ]) {
    const selected = unitProfile('Marauders', order);
    const stats = selected.filter(row => row.Type === 'Statline');
    assert.equal(stats.length, 1);
    assert.equal(stats[0].Attributes.HP, '6');
    const defaultRule = selected.findIndex(row => plain(row.Name) === 'Stimpack (Marauders)');
    const phase = selected.findIndex(row => row.Description === '<b>Assault Phase</b>');
    for (const name of order) {
      const index = selected.findIndex(row => plain(row.Name).toLowerCase() === name.toLowerCase());
      assert.ok(defaultRule < index && index < phase);
      assert.match(selected[index].Name, /^<color=#4da6ff>/);
    }
    assert.doesNotMatch(selected[defaultRule].Name, /color=/);
  }
});

test('Raynor C-14 Rifle replaces Commando Rifle without changing the other weapons', () => {
  assert.ok(weapons(unitProfile('Jim Raynor')).includes('COMMANDO RIFLE'));
  const selected = unitProfile('Jim Raynor', ['C-14 Rifle']);
  assert.ok(!weapons(selected).includes('COMMANDO RIFLE'));
  assert.ok(weapons(selected).includes('C-14 RIFLE'));
  assert.equal(weapons(selected).length, 3);
  const choice = selected.find(row => plain(row.Name) === 'C-14 Rifle');
  assert.match(choice.Name, /color=#4da6ff/);
  assert.ok(
    selected.indexOf(choice) <
      selected.findIndex(row => row.Description === '<b>Assault Phase</b>'),
  );
  assert.ok(
    selected
      .filter(row => row.Id.endsWith('_heading'))
      .every(row => !row.Description.includes('color=')),
  );
});

test('Goliath missile choices replace Hellfire and never leave both alternatives displayed', () => {
  for (const name of ['Scatter Missiles', 'Haywire Missiles']) {
    const selected = weapons(unitProfile('Goliath', [name]));
    assert.ok(!selected.includes('HELLFIRE MISSILES'));
    assert.ok(selected.includes(name.toUpperCase()));
    assert.equal(selected.length, 4);
  }
  const selected = weapons(unitProfile('Goliath', ['Scatter Missiles', 'Haywire Missiles']));
  assert.ok(!selected.includes('SCATTER MISSILES'));
  assert.ok(selected.includes('HAYWIRE MISSILES'));
});

test('Immortal replacements preserve the other arm and Fury Unyielding preserves both weapons', () => {
  const left = weapons(unitProfile('Immortal', ['Left Phase Disruptor']));
  assert.ok(left.includes('LEFT PHASE DISRUPTOR'));
  assert.ok(left.includes('RIGHT PHOTON DISRUPTOR'));
  assert.ok(!left.includes('LEFT PHOTON DISRUPTOR'));
  const both = weapons(unitProfile('Immortal', ['Left Phase Disruptor', 'Right Phase Disruptor']));
  assert.deepEqual(both, ['LEFT PHASE DISRUPTOR', 'RIGHT PHASE DISRUPTOR', 'STOMP']);
  const fury = unitProfile('Immortal', ['Fury Unyielding']);
  assert.deepEqual(weapons(fury), ['LEFT PHOTON DISRUPTOR', 'RIGHT PHOTON DISRUPTOR', 'STOMP']);
  assert.ok(fury.some(row => plain(row.Name) === 'Fury Unyielding'));
});

test('Marines and Raiders share Stimpack (Marines), distinct from Marauders', () => {
  const find = name => unitProfile(name).find(row => plain(row.Name) === 'Stimpack (Marines)');
  const marine = find('Marines');
  const raider = find("Raynor's Raiders");
  assert.ok(marine && raider);
  assert.equal(marine.Id, raider.Id);
  assert.ok(
    unitProfile('Marauders').some(
      row => row.Name === 'Stimpack (Marauders)' && row.Id !== marine.Id,
    ),
  );
});

test('option IDs are readable names so the native generic importer can match exported choices', () => {
  assert.ok(data['options.json'].length > 0);
  assert.ok(data['options.json'].every(option => option.Id === option.Name && option.Type === 1));
  assert.ok(data['options.json'].some(option => option.Id === 'Kinetic Foam'));
});
