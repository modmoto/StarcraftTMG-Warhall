import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readAbilities } from '../src/sources/pdf/abilities.mjs';
import { extractKeywords } from '../src/sources/pdf/keywords.mjs';
import { normalizeCards } from '../src/sources/pdf/adapter.mjs';
import { parseCardPage } from '../src/sources/pdf/card-parser.mjs';
import { buildWarhallPackage } from '../src/warhall/package.mjs';
import { describeProfile } from '../src/warhall/descriptions.mjs';
import { cleanRuleText } from '../src/text.mjs';
import { validateData } from '../src/warhall/validate.mjs';

const snapshots = JSON.parse(
  await readFile(new URL('./fixtures/official-card-layouts.json', import.meta.url), 'utf8'),
);
const card = key => {
  const f = structuredClone(snapshots[key]);
  return parseCardPage(f.items, f, f.page);
};
const build = cards => buildWarhallPackage(normalizeCards(cards));
const plain = text => text.replace(/<[^>]*>/g, '');

test('phase blocks become named abilities with distinct phase, activation and resource cost', () => {
  const rules = readAbilities(
    'LIFE SUPPORT: REACTION 1 CP Reduce Damage by 1. RESTORATION: REACTION 1 CP Remove all DEBUFFS.',
    'ANY PHASE',
    'Medic',
  );
  assert.deepEqual(
    rules.map(rule => rule.name),
    ['Life Support', 'Restoration'],
  );
  assert.equal(rules[0].attributes.Phase, 'Any Phase');
  assert.equal(rules[0].attributes.Type, 'Reaction');
  assert.equal(rules[0].attributes.Cost, '1 CP');
  assert.equal(rules[1].attributes.Effect, 'Remove all DEBUFFS.');
});

test('zero and variable costs survive, and Repeatable and internal phase conditions remain effects', () => {
  const [rule] = readAbilities(
    'ORDERS: ACTIVE X CP REPEATABLE. During the Assault Phase: resolve HEAL (2).',
    'MOVEMENT PHASE',
    'Raynor',
  );
  assert.equal(rule.attributes.Cost, 'X CP');
  assert.match(rule.attributes.Effect, /REPEATABLE/);
  assert.equal(
    readAbilities('BARRIER: REACTION 0 PE Resolve this effect.', 'ANY PHASE', 'test')[0].attributes
      .Cost,
    '0 PE',
  );
  assert.throws(
    () => readAbilities('MISSING: ACTIVE Resolve an effect.', 'ANY PHASE', 'test'),
    /Missing ability cost/,
  );
  assert.throws(
    () => readAbilities('unnamed rules without headings', 'ANY PHASE', 'test'),
    /Unrecognized ability heading/,
  );
});

test('replacement notes do not become part of an ability name', () => {
  const [rule] = readAbilities(
    '↑ FOR RIGHT PHOTON\nDISRUPTOR\nFURY UNYIELDING: PASSIVE Gain PRECISION (1).',
    'ASSAULT PHASE',
    'Immortal',
  );
  assert.equal(rule.name, 'Fury Unyielding');
  assert.equal(rule.attributes.Upgrade, 'FOR RIGHT PHOTON DISRUPTOR');
});

test('Stimpack links to official Precision while different unit values remain distinct', async () => {
  const marine = card('marine');
  const marauder = structuredClone(marine);
  marauder.name = 'Marauders';
  marauder.profiles.find(profile => profile.name === 'Stimpack').attributes.Effect =
    'Its Quad K12 gains PRECISION (2).';
  const { data, report } = await build([marine, marauder, card('hydra'), card('artanis')]);
  const precision = data['rules.json'].find(rule => rule.Name === 'Precision');
  const rules = data['Terran/rules.json'].filter(rule => rule.Name === 'Stimpack');
  assert.equal(rules.length, 2);
  assert.ok(
    rules.every(rule => rule.Description.includes(`<link="${precision.Id}">PRECISION</link>`)),
  );
  assert.ok(rules.some(rule => plain(rule.Description).includes('PRECISION (3)')));
  assert.ok(rules.some(rule => plain(rule.Description).includes('PRECISION (2)')));
  const unit = data['Terran/units.json'].find(unit => unit.Name === 'Marines');
  assert.doesNotMatch(
    unit.Description,
    /Source:|Official card|manual|not applied|OPTIONAL UPGRADE|Base:|\bmm\b/,
  );
  assert.ok(report.units.find(unit => unit.name === 'Marines').card.url);
  const shield = data['Terran/rules.json'].find(rule => rule.Name === 'Combat Shield');
  assert.match(shield.Description, /Upgrade ability/);
  const profile = data['Terran/profiles.json'].find(profile => profile.Id === 'prof_marine');
  assert.ok(!profile.Children.some(child => child.Id === shield.Id));
  assert.ok(
    data['Terran/equipment.json'].some(
      item => item.Id === 'pdf_Terran_equipment_marines_default_1',
    ),
  );
  const bad = structuredClone(data);
  bad['rules.json'][0].Description += '<link="absent_keyword">Missing</link>';
  assert.throws(() => validateData(bad), /Unresolved reference absent_keyword/);
});

test('abilities can reference an upgrade ability without granting that upgrade to the unit', async () => {
  const unit = card('artanis');
  unit.profiles = readAbilities(
    'OUR MINDS AS ONE: PASSIVE Add 1 to its Psionic Storm Special Ability.',
    'ANY PHASE',
    'test',
  );
  unit.optional = readAbilities(
    'PSIONIC STORM: ACTIVE 2 PE Resolve HITS 4 (1).',
    'MOVEMENT PHASE',
    'test',
  );
  const { data } = await build([card('marine'), card('hydra'), unit]);
  const rules = data['Protoss/rules.json'];
  const storm = rules.find(rule => rule.Name === 'Psionic Storm');
  const minds = rules.find(rule => rule.Name === 'Our Minds As One');
  assert.ok(minds.Description.includes(`<link="${storm.Id}">Psionic Storm</link>`));
  assert.ok(!data['Protoss/profiles.json'][0].Children.some(child => child.Id === storm.Id));
});

test('glossary extraction distinguishes list glyphs from the literal X parameter', () => {
  const pages = [
    {
      page: 1,
      items: [
        { s: 'KEYWORD GLOSSARY', h: 20, y: 700 },
        { s: 'BUFF [Characteristic] (X)', h: 10, y: 650 },
        { s: 'Increase by X.', h: 9, y: 630, w: 40 },
        { s: 'X', h: 9, y: 600, w: 7.9 },
        { s: 'Use', h: 9, y: 600, w: 12 },
        { s: 'X', h: 9, y: 600, w: 5 },
      ],
    },
    { page: 2, items: [{ s: 'PART 12:', h: 20, y: 700 }] },
  ];
  const [rule] = extractKeywords(pages);
  assert.equal(rule.aliases[0], 'BUFF');
  assert.equal(rule.description, 'Increase by X.\n• Use X');
});

test('profiles render phase sections and native weapon tables with independent headings', async () => {
  const { data } = await build([card('marine'), card('hydra'), card('artanis')]);
  const records = new Map(
    Object.values(data)
      .filter(Array.isArray)
      .flat()
      .filter(item => item?.Id)
      .map(item => [item.Id, item]),
  );
  const profile = data['Terran/profiles.json'].find(profile => profile.Id === 'prof_marine');
  const children = profile.Children.map(child => records.get(child.Id));
  assert.deepEqual(
    children.filter(item => item.Type === '').map(item => item.Description),
    ['<b>Movement Phase</b>', '<b>Assault Phase</b>', '<b>Melee Phase</b>'],
  );
  const rifle = children.find(item => item.Name === 'C-14 RIFLE');
  assert.equal(rifle.Type, 'Statline');
  assert.deepEqual(rifle.Attributes, {
    Range: '12',
    Target: 'All',
    RoA: '2',
    Hit: '3+',
    'Surge Type': 'Light',
    'Surge Dice': 'D3',
    Damage: '1',
    Keywords: '-',
  });
  assert.ok(!('HP' in rifle.Attributes));
  assert.deepEqual(rifle.Children, []);
  for (const items of Object.values(data).filter(Array.isArray)) {
    for (const item of items.filter(item => item.Type === 'Statline' && item.Id.endsWith('_table'))) {
      assert.deepEqual(item.Children, [], `Weapon row must not repeat its equipment: ${item.Id}`);
    }
  }
  assert.equal(children[0].Id, 'stat_marine');
  const assault = children.findIndex(item => item.Description === '<b>Assault Phase</b>');
  const melee = children.findIndex(item => item.Description === '<b>Melee Phase</b>');
  const rifleIndex = children.indexOf(rifle);
  const strikeIndex = children.findIndex(item => item.Name === 'STRIKE');
  assert.ok(assault < rifleIndex && rifleIndex < melee && melee < strikeIndex);
  assert.ok(children.some(item => item.Name === 'Stimpack' && item.Type === 'Rule'));
  assert.equal(data['gameconfig.json'].ShowGroupHeader, false);
  const broken = structuredClone(data);
  const row = broken['Terran/statlines.json'].find(item => item.Id === rifle.Id);
  row.Attributes.Range = 'unknown';
  assert.throws(() => validateData(broken), /Invalid weapon table values/);
  delete row.Attributes.Range;
  assert.throws(() => validateData(broken), /Invalid weapon table headings/);
});

test('catalogue activation typos and split PDF possessives format cleanly without changing values', () => {
  const description = describeProfile({
    type: 'Rules (Assault Phase)',
    attributes: { Cost: 'Reactive (1 PE)', Effect: "Artanis ' Activation ends." },
  });
  assert.match(description, /Type:<\/b> Reaction/);
  assert.match(description, /Cost:<\/b> 1 PE/);
  assert.match(description, /Artanis' Activation ends/);
  assert.equal(cleanRuleText('A model gains BUFF Speed (3) .'), 'A model gains BUFF Speed (3).');
});
