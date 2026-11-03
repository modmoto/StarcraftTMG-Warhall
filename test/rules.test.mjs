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
import { applyProfileOptions, flattenProfile } from '../src/lists/apply-options.mjs';

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
  const rules = data['Terran/rules.json'].filter(rule => /^Stimpack(?: \(|$)/.test(rule.Name));
  assert.equal(rules.length, 2);
  assert.ok(rules.some(rule => rule.Name === 'Stimpack (Marines)'));
  assert.ok(rules.some(rule => rule.Name === 'Stimpack (Marauders)'));
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
  const shield = data['Terran/rules.json'].find(rule => plain(rule.Name) === 'Combat Shield');
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
  const storm = rules.find(rule => plain(rule.Name) === 'Psionic Storm');
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

test('profiles render phase sections and left-aligned full-width weapon tables', async () => {
  const { data } = await build([card('marine'), card('hydra'), card('artanis')]);
  const records = new Map(
    Object.values(data)
      .filter(Array.isArray)
      .flat()
      .filter(item => item?.Id)
      .map(item => [item.Id, item]),
  );
  const profile = data['Terran/profiles.json'].find(profile => profile.Id === 'prof_marine');
  const children = flattenProfile(
    applyProfileOptions(
      data,
      profile.Id,
      data['Terran/units.json'].find(unit => unit.BasicProfileIds.includes(profile.Id)).Id,
      [],
    ),
  )
    .slice(1)
    .filter(child => (child.Type && child.Type !== 'Profile') || child.Description);
  const rifle = children.find(item => item.Id === 'pdf_Terran_equipment_marines_default_1_table');
  assert.equal(rifle.Type, 'Imported');
  assert.equal(rifle.Name, `<color=#ffffff>${rifle.Description}</color>`);
  assert.match(rifle.Description, /<align=left>/);
  assert.match(rifle.Description, /<pos=0%><nobr>RNG<\/nobr>/);
  assert.match(rifle.Description, /Target/);
  assert.match(rifle.Description, /Light \(D3\)/);
  assert.deepEqual(rifle.Children, []);
  assert.equal(children[0].Id, 'stat_marine');
  assert.match(rifle.Description, /^<b>Assault Phase<\/b>\n<b>C-14 RIFLE<\/b>\n<align/);
  const strike = children.find(
    item => item.Id.endsWith('_table') && item.Description.includes('<b>STRIKE</b>'),
  );
  assert.match(strike.Description, /^<b>Melee Phase<\/b>\n<b>STRIKE<\/b>\n<align/);
  assert.ok(children.indexOf(rifle) < children.indexOf(strike));
  assert.ok(children.some(item => item.Name === 'Stimpack (Marines)' && item.Type === 'Rule'));
  assert.equal(data['gameconfig.json'].MaxCloudSeparation, 4);
  assert.equal(data['gameconfig.json'].ShowGroupHeader, false);
  assert.equal(data['gameconfig.json'].ShowStatlineHeader, false);
  assert.equal(children[0].Name, '');
  assert.ok(!('Supply' in children[0].Attributes));
  assert.match(data['Terran/units.json'][0].Description, /^Categories: [^\n]+\nModels \/ Supply:/);
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

test('weapon tables display full targets and combine surge type with its dice', async () => {
  const { weaponAttributes } = await import('../src/warhall/presentation.mjs');
  const base = {
    Rng: '12',
    Tgt: 'Ground',
    RoA: '2',
    Hit: '3+',
    Surge: 'Light',
    'S.Die': 'D3+1',
    Dmg: '1',
    Keyword: '-',
  };
  assert.deepEqual(weaponAttributes(base), {
    RNG: '12',
    Target: 'Ground',
    RoA: '2',
    Hit: '3+',
    Surge: 'Light (D3+1)',
    D: '1',
  });
  assert.equal(
    weaponAttributes({ ...base, Tgt: 'Flying', Surge: 'Light, Armoured' }).Target,
    'Air',
  );
  assert.equal(weaponAttributes({ ...base, Surge: 'Light, Armoured' }).Surge, 'L&A (D3+1)');
  assert.equal(
    weaponAttributes({ ...base, Surge: 'Armoured', 'S.Die': 'D6' }).Surge,
    'Armored (D6)',
  );
  assert.equal(weaponAttributes({ ...base, Surge: '-', 'S.Die': '-' }).Surge, '-');
});
test('wide weapon tables keep full targets and surge values on one data line', async () => {
  const { weaponTable } = await import('../src/warhall/presentation.mjs');
  const attributes = {
    Rng: '8',
    Tgt: 'Ground',
    RoA: '2',
    Hit: '3+',
    Surge: 'Armoured',
    'S.Die': 'D3',
    Dmg: '1',
  };
  const table = weaponTable(attributes);
  assert.equal(table.split('\n').length, 2);
  assert.match(table.split('\n')[1], /<nobr>Armored \(D3\)<\/nobr>/);
  assert.match(table, /<nobr>Ground<\/nobr>/);
  assert.throws(
    () => weaponTable({ ...attributes, Rng: 'unknown' }),
    /Invalid weapon table values/,
  );
});

test('full-width weapon keywords link complete labels and rules precede every weapon phase', async () => {
  const marine = card('marine');
  marine.profiles.find(profile => /Weapon$/.test(profile.type)).attributes.Keyword =
    'CONCENTRATED FIRE (1), LONG RANGE (16), SIDEARM';
  const { data } = await build([marine, card('hydra'), card('artanis')]);
  for (const faction of ['Terran', 'Protoss']) {
    const records = new Map(
      ['profiles', 'statlines', 'rules']
        .flatMap(file => data[`${faction}/${file}.json`])
        .map(row => [row.Id, row]),
    );
    for (const profile of data[`${faction}/profiles.json`]) {
      const children = flattenProfile(
        applyProfileOptions(
          data,
          profile.Id,
          data[`${faction}/units.json`].find(unit => unit.BasicProfileIds.includes(profile.Id)).Id,
          [],
        ),
      )
        .slice(1)
        .filter(child => (child.Type && child.Type !== 'Profile') || child.Description);
      const firstPhase = children.findIndex(child =>
        /^<b>(?:Assault|Melee) Phase<\/b>\n/.test(child.Description ?? ''),
      );
      assert.ok(
        children
          .filter(child => child.Type === 'Rule')
          .every(child => children.indexOf(child) < firstPhase),
      );
      assert.ok(!children.some(child => child.Description === '<b>Any Phase</b>'));
      for (const keyword of children.filter(child => child.Id.endsWith('_keywords'))) {
        assert.equal(keyword.Type, 'Imported');
        assert.equal(keyword.Name, `<color=#ffffff>${keyword.Description}</color>`);
        assert.ok(!keyword.Description.includes('\n'));
        assert.ok(children[children.indexOf(keyword) - 1].Id.endsWith('_table'));
      }
    }
  }
  const line = data['Terran/rules.json'].find(
    row => row.Id === 'pdf_Terran_equipment_marines_default_1_keywords',
  );
  assert.equal(plain(line.Description), 'CONCENTRATED FIRE (1), LONG RANGE (16), SIDEARM');
  assert.match(
    line.Description,
    /<link="rule_keyword_concentrated_fire">CONCENTRATED FIRE \(1\)<\/link>/,
  );
  assert.match(line.Description, /<link="rule_keyword_long_range">LONG RANGE \(16\)<\/link>/);
  assert.match(line.Description, /<link="rule_keyword_sidearm">SIDEARM<\/link>/);
  const charge = data['Protoss/rules.json'].find(row =>
    row.Id.endsWith('_assault_phase_devastating_charge'),
  );
  assert.match(charge.Name, /^Devastating Charge IMPACT \(\d+\) \d\+$/);
  assert.ok(plain(charge.Description).includes(charge.Name.replace('Devastating Charge ', '')));
});
