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
      option =>
        available.has(option.Id) &&
        [option.Name, option.Id].some(label => label.toLowerCase() === choice.toLowerCase()),
    );
    assert.ok(option, `${name}: ${choice}`);
    return option.Id;
  });
  return flattenProfile(applyProfileOptions(data, unit.BasicProfileIds[0], unit.Id, ids));
}
const weapons = profile =>
  profile
    .filter(row => row.Id.endsWith('_table'))
    .map(row =>
      plain(row.Description)
        .split('\n')
        .find(line => !line.endsWith('Phase')),
    );

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
    assert.equal(stats[0].Attributes.HP, '<color=#2596be>6</color><size=0>(6)</size>');
    const defaultRule = selected.findIndex(row => plain(row.Name) === 'Stimpack (Marauders)');
    const phase = selected.findIndex(row => row.Description?.startsWith('<b>Assault Phase</b>\n'));
    for (const name of order) {
      const index = selected.findIndex(row => plain(row.Name).toLowerCase() === name.toLowerCase());
      assert.ok(defaultRule < index && index < phase);
      assert.match(selected[index].Name, /^<color=#2596be>/);
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
  assert.match(choice.Name, /color=#2596be/);
  assert.match(choice.Description, /Replace COMMANDO RIFLE with C-14 RIFLE\./);
  assert.match(choice.Description, /<pos=0%><nobr>RNG/);
  assert.match(choice.Description, /Light \(D3\+1\)/);
  assert.ok(
    selected.indexOf(choice) <
      selected.findIndex(row => row.Description?.startsWith('<b>Assault Phase</b>\n')),
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

test('Marines and Raiders share Stimpack, distinct from Marauders', () => {
  const find = name => unitProfile(name).find(row => plain(row.Name) === 'Stimpack');
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
  assert.ok(data['options.json'].every(option => option.Type === 1));
  assert.equal(
    data['options.json'].find(option => option.Id === 'Slugthrower').Name,
    'Slugthrower',
  );
  assert.equal(data['options.json'].find(option => option.Id === 'Agg-12').Name, 'AGG-12');
  assert.ok(data['options.json'].some(option => option.Id === 'Kinetic Foam'));
});

test('profile groups render inline and weapon headers stay unlinked', () => {
  const records = Object.values(data).flat();
  const groups = records.filter(row => /_(?:stats|selected_options|slot)$/.test(row.Id ?? ''));
  assert.ok(groups.length > 0);
  for (const row of groups) assert.equal(row.Type, 'Profile', row.Id);
  const tables = records.filter(row => row.Id?.endsWith('_table'));
  assert.ok(tables.length > 0);
  for (const row of tables) {
    assert.doesNotMatch(row.Description.split('\n<b>')[0], /<link=/, row.Id);
    assert.match(row.Description, /<color=#2596be>/);
  }
});

const weaponText = (name, options = []) =>
  unitProfile(name, options)
    .filter(
      row =>
        row.Id.endsWith('_table') || row.Id.endsWith('_keywords') || /_effect_\d+$/.test(row.Id),
    )
    .map(row => row.Description || row.Name || '')
    .join('\n');

test('Guidance changes Anti-Evade while the paid Resonating Glaves buff stays inactive', () => {
  const text = weaponText('Adepts', ['Guidance', 'Resonating Glaves']);
  assert.match(text, /<color=#2596be>ANTI-EVADE \(2\)<\/color>/);
  assert.match(text, /<pos=32%><nobr>2 <u><link="[^"]+"><color=#65c879>\(3\)<\/color>/);
  assert.doesNotMatch(text, /<pos=32%><nobr><color=/);
  assert.doesNotMatch(weaponText('Adepts', ['Guidance']), /#65c879/);
  const active = unitProfile('Adepts', ['Resonating Glaves']).find(
    row => plain(row.Name) === 'Resonating Glaves',
  );
  assert.match(active.Description, /Upgrade ability/);
  assert.match(active.Description, /Active/);
  assert.match(active.Description, /1 PE/);
});

test('replacement profiles color only changed values and new keywords', () => {
  const text = weaponText('Adepts', ['Glaive Strike']);
  const melee = text.split('<b>Melee Phase</b>')[1];
  assert.match(melee, /<color=#2596be>Light \(D3\)<\/color>/);
  assert.match(melee, /<color=#2596be>PIERCE Light \(2\)<\/color>/);
  assert.match(melee, /<pos=32%><nobr>1<\/nobr>/);
  assert.match(melee, /<pos=86%><nobr>1<\/nobr>/);
  assert.doesNotMatch(melee, /<pos=86%><nobr><color=/);
});

test('permanent ranged keywords and surge upgrades appear on the affected weapon', () => {
  assert.match(
    weaponText('Marauders', ['Laser Targeting Systems']),
    /<color=#2596be>LONG RANGE \(16"\)<\/color>/,
  );
  assert.match(
    weaponText('Hydralisks', ['Grooved Spines']),
    /<color=#2596be>LONG RANGE \(16"\)<\/color>/,
  );
  const goliath = weaponText('Goliath', ['Ares-Class Targeting System', 'Haywire Missiles']);
  assert.equal((goliath.match(/<color=#2596be>PRECISION \(1\)<\/color>/g) ?? []).length, 2);
  for (const name of ['Roaches', 'Corpsers (Roach)', 'Viles (Roach)']) {
    assert.match(weaponText(name, ['Hydriodic Bile']), /<color=#2596be>Light \(D3\+1\)<\/color>/);
  }
});

test('conditional Armour remains informational and composes with numeric HP in either order', () => {
  assert.doesNotMatch(
    unitProfile('Marauders', ['Kinetic Foam'])
      .map(row => row.Description)
      .join('\n'),
    /#65c879/,
  );
  for (const order of [
    ['Kinetic Foam', 'Veteran of Tarsonis'],
    ['Veteran of Tarsonis', 'Kinetic Foam'],
  ]) {
    const profile = unitProfile('Marauders', order);
    const stats = profile.find(row => row.Type === 'Statline');
    assert.equal(stats.Attributes.Arm, '4+');
    assert.equal(stats.Attributes.HP, '<color=#2596be>6</color><size=0>(6)</size>');
    assert.match(
      profile
        .map(row => row.Description)
        .join('\n')
        .replace(/<\/?u>|<\/?link(?:="[^"]*")?>/g, ''),
      /Armour: 4\+ <color=#65c879>\(3\+ — within 3" of a mission marker\)<\/color>/,
    );
  }
});

test('multiple conditional ranged bonuses survive replacement weapon selections in either order', () => {
  for (const options of [
    ['Fury Unyielding', 'For The Ancients', 'Left Phase Disruptor'],
    ['Left Phase Disruptor', 'For The Ancients', 'Fury Unyielding'],
  ]) {
    const text = weaponText('Immortal', options);
    assert.match(text, /<b>LEFT PHASE DISRUPTOR<\/b>/);
    assert.equal((text.match(/<color=#65c879>CRITICAL HIT/g) ?? []).length, 2);
    assert.equal((text.match(/<color=#65c879>PRECISION/g) ?? []).length, 2);
  }
});

test('Adrenal Glands stays below the selected Claws profile and survives either selection order', () => {
  for (const name of ['Zerglings', 'Raptors (Zergling)']) {
    for (const choices of [
      ['Adrenal Glands', 'Shredding Claws'],
      ['Shredding Claws', 'Adrenal Glands'],
    ]) {
      const text = weaponText(name, choices);
      assert.equal((text.match(/<color=#2596be>PRECISION \(2\)<\/color>/g) ?? []).length, 1);
      assert.ok(text.indexOf('<b>SHREDDING CLAWS</b>') < text.indexOf('PRECISION (2)'));
    }
  }
});

test('conditional weapon effects are green and identify their weapon and condition', () => {
  const text = weaponText('Marines', ['Slugthrower', 'Grenades - Frag']);
  assert.match(text, /<color=#65c879>ANTI-EVADE \(1\)<\/color>/);
  assert.match(text, /Light \(D3\) <u><link="[^"]+"><color=#65c879>\(D6\)<\/color>/);
  assert.match(weaponText('Zealots', ['We Stand As One']), /<color=#65c879>PRECISION \(2\)/);
  assert.match(weaponText('Stalker', ['Fury Of The Nerazim']), /<color=#65c879>INSTANT/);
});

test('passive upgrades to named abilities update the rule definition with blue values', () => {
  const medic = unitProfile('Medics', ['A-13 Flash Grenade Launcher']);
  const flare = medic.find(row => plain(row.Name).startsWith('Optical Flare (Range'));
  assert.ok(flare);
  assert.match(flare.Description, /<color=#2596be>16"<\/color>/);
  assert.match(flare.Description, /Upgrade ability/);
  assert.equal(medic.filter(row => plain(row.Name) === 'Optical Flare').length, 0);
  const ravager = unitProfile('Ravagers', ['Bloated Bile Ducts']);
  const bile = ravager.find(row => plain(row.Name).startsWith('Corrosive Bile (Area'));
  assert.match(bile.Description, /<color=#2596be>2"<\/color>/);
});

test('the upgrade audit covers every source profile and active options change only the selected-rule list', async () => {
  const report = JSON.parse(
    await readFile(new URL('../Starcraft-test/import-report.json', import.meta.url)),
  );
  const options = data['options.json'];
  const allModifiers = Object.entries(data)
    .filter(([file]) => file.endsWith('/modifiedprofile.json'))
    .flatMap(([, rows]) => rows);
  const byId = new Map(
    Object.values(data)
      .flat()
      .filter(row => row.Id)
      .map(row => [row.Id, row]),
  );
  for (const unit of report.units) {
    assert.equal(unit.upgradeDisplay.length, unit.upgradeProfiles.length);
    for (const source of unit.upgradeProfiles) {
      if (!/active|reaction|reactive/i.test(source.attributes.Type ?? source.attributes.Cost ?? ''))
        continue;
      const option = options.find(
        option => option.Name.toLowerCase() === source.name.toLowerCase(),
      );
      assert.ok(option, source.name);
      const modifier = allModifiers.find(
        row => row.UnitId === unit.unitId && row.OptionId === option.Id,
      );
      if (modifier.OptionId === 'Resonating Glaves') continue;
      assert.deepEqual(modifier.ReferencedItemsToRemove, []);
      assert.ok(modifier.ReferencedItemsToAdd.every(row => row.Id.endsWith('_selected_options')));
      for (const ref of modifier.ReferencedItemsToAdd.flatMap(row => row.Ref)) {
        assert.match(byId.get(ref.Id).Description, /Upgrade ability/);
        assert.match(byId.get(ref.Id).Name, /^<color=#2596be>/);
      }
    }
  }
});

test('Marines retain the C-14 alongside the selected specialist launcher', () => {
  const profile = unitProfile('Marines', ['Rocket Launcher', 'Slugthrower', 'Grenades - Frag']);
  assert.ok(weapons(profile).includes('C-14 RIFLE'));
  assert.ok(weapons(profile).includes('ROCKET LAUNCHER'));
  const choice = profile.find(row => plain(row.Name) === 'Rocket Launcher');
  assert.match(choice.Description, /Add ROCKET LAUNCHER for the specialist model/);
  for (const row of [
    choice,
    profile.find(row => row.Description?.startsWith('<b>ROCKET LAUNCHER</b>')),
  ]) {
    assert.doesNotMatch(row.Description.split('\n<b><pos=')[1], /<color=#2596be>/);
  }
});

test('Marine specialist choices retain the rifle and each selected specialist', () => {
  const profile = unitProfile('Marines', ['Rocket Launcher', 'Agg-12']);
  assert.ok(weapons(profile).includes('C-14 RIFLE'));
  assert.ok(weapons(profile).includes('ROCKET LAUNCHER'));
  assert.ok(weapons(profile).includes('AGG-12'));
});

test('each Immortal weapon groups default and conditional keywords with original rule links', () => {
  const profile = unitProfile('Immortal', ['For The Ancients', 'Fury Unyielding']);
  const groups = profile.filter(
    row => row.Id.endsWith('_keyword_row') && row.Children.length === 3,
  );
  assert.equal(groups.length, 2);
  for (const group of groups) {
    assert.ok(group.Children.every(row => row.Type === 'Imported'));
    assert.match(group.Children[0].Name, /CONCENTRATED FIRE/);
    assert.match(group.Children[1].Name, /<link="[^"]*for_the_ancients">/);
    assert.match(group.Children[2].Name, /<link="[^"]*fury_unyielding">/);
  }
});
