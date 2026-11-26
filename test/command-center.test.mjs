import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readJson, writeJson } from '../src/io.mjs';
import { projectRoot } from '../src/paths.mjs';
import {
  decodeValue,
  downloadCommandCenter,
  loadCommandCenter,
  parseWeapon,
  validateSnapshot,
} from '../src/sources/command-center.mjs';
import { buildFromCommandCenter } from '../src/convert.mjs';
import { auditCommandCenter } from '../src/command-center-audit.mjs';
import { parseCardBase } from '../src/sources/pdf/card-parser.mjs';
import { applyProfileOptions, flattenProfile } from '../src/lists/apply-options.mjs';
import { mergeCommandCenterCards } from '../src/warhall/command-center-cards.mjs';
import { runConversion } from '../src/cli.mjs';

const raw = await readJson(path.join(projectRoot, 'sources/command-center.json'));
const mapping = await readJson(path.join(projectRoot, 'command-center-mapping.json'));
const previous = await readJson(path.join(projectRoot, 'Starcraft/import-report.json'));

test('Firestore decoding preserves nested arrays, booleans and safe numbers', () => {
  assert.deepEqual(
    decodeValue({
      mapValue: {
        fields: {
          n: { integerValue: '9' },
          list: { arrayValue: { values: [{ booleanValue: false }, { nullValue: null }] } },
        },
      },
    }),
    { n: 9, list: [false, null] },
  );
  assert.throws(() => decodeValue({ integerValue: '9007199254740993' }), /Unsafe/);
  assert.throws(() => decodeValue({ referenceValue: 'secret' }), /Unsupported/);
});

test('DB download paginates only units and tactical cards, never general rules', async () => {
  const requests = [];
  const fetcher = async url => {
    requests.push(String(url));
    const collection = url.pathname.split('/').at(-1);
    const second = url.searchParams.get('pageToken') === 'next';
    const documents = (second ? ['Zerg'] : ['Terran', 'Protoss']).map(faction => ({
      name: `documents/${collection}/${faction}`,
      fields: { faction: { stringValue: faction }, name: { stringValue: faction } },
    }));
    return {
      ok: true,
      json: async () => ({ documents, ...(!second ? { nextPageToken: 'next' } : {}) }),
    };
  };
  const data = await downloadCommandCenter(fetcher);
  assert.equal(requests.length, 4);
  assert.equal(data.army_units.length, 3);
  assert.ok(requests.every(url => !url.includes('rules_sections')));
});

test('incomplete and duplicated DB collections fail closed', () => {
  const broken = structuredClone(raw);
  broken.army_units.push(broken.army_units[0]);
  assert.throws(() => validateSnapshot(broken), /Duplicate/);
  assert.throws(() => validateSnapshot({ ...raw, tactical_cards: [] }), /Empty/);
});

test('legacy converters cannot overwrite the maintained dataset', async () => {
  await assert.rejects(runConversion(['--source', 'pdf']), /Use npm run wave:update/);
  await assert.rejects(
    runConversion(['--source', 'pdf', '--output', path.join(projectRoot, 'Starcraft/Terran')]),
    /Use npm run wave:update/,
  );
});

test('DB card identity survives renaming and retains existing artwork', async () => {
  const data = {
    'cards.json': [
      {
        Id: 'sc_card_terran_tactics_academy',
        Name: 'Old Academy',
        Type: 'Card',
        UIConfig: { ImageURL: 'existing-artwork.png' },
      },
    ],
  };
  const source = structuredClone(raw.tactical_cards.find(card => card.sourceId === 'academy'));
  source.name = 'Renamed Academy';
  await mergeCommandCenterCards(data, {}, [source]);
  assert.equal(data['cards.json'].length, 1);
  assert.equal(data['cards.json'][0].Id, 'sc_card_terran_tactics_academy');
  assert.equal(data['cards.json'][0].Name, 'Renamed Academy');
  assert.equal(data['cards.json'][0].UIConfig.ImageURL, 'existing-artwork.png');
});

test('weapon parser preserves surge dice, BT attacks, keywords and phases', () => {
  const weapon = parseWeapon({
    name: 'Acid',
    phase: 'Assault Phase',
    description:
      'RANGE: 12 | TARGET: All | RoA: BT+1 | HIT: 3+ | DMG: 1\nSURGE: Light, Armoured (D3+1)\n\nINSTANT, SIDEARM',
  });
  assert.equal(weapon.attributes['S.Die'], 'D3+1');
  assert.equal(weapon.attributes.RoA, 'BT+1');
  assert.equal(weapon.attributes.Keyword, 'INSTANT, SIDEARM');
  assert.equal(weapon.type, 'Assault Weapon');
  assert.throws(() => parseWeapon({ name: 'Broken', description: 'RANGE: ??' }), /Unreadable/);
});

test('base fallback ignores unreadable weapons and ability text', async () => {
  const layouts = await readJson(
    path.join(projectRoot, 'test/fixtures/official-card-layouts.json'),
  );
  const fixture = structuredClone(layouts.marine);
  fixture.items = fixture.items.filter(item => !/RNG|RoA|STIMPACK/.test(item.s));
  const result = parseCardBase(fixture.items, fixture, fixture.page);
  assert.deepEqual(result.base, { shape: 'round', widthMm: 32, lengthMm: 32 });
  assert.ok(!('attributes' in result));
});

test('inventory exposes missing bases and models without guessing sizes', () => {
  const audit = auditCommandCenter(raw, mapping, previous);
  assert.equal(audit.counts.units, raw.army_units.length);
  assert.equal(
    audit.missingBases.length,
    raw.army_units.filter(unit => !mapping[`${unit.faction}/${unit.sourceId}`]?.base).length,
  );
  assert.equal(audit.newUnits.length + audit.existingUnits.length, raw.army_units.length);
  assert.equal(audit.conflicts.length, 0);
  assert.ok(audit.reserveReview.some(item => /scarab/i.test(item.wording)));
  assert.ok(audit.tokenReview.some(item => /Fire Wall/.test(item.wording)));
});

test('missing PDF bases block generation before data can be written', async () => {
  const missing = structuredClone(mapping);
  missing['Terran/marine'].base = null;
  await assert.rejects(
    buildFromCommandCenter({ mapping: missing }),
    /Missing or unreadable printed PDF base size/,
  );
});

test('DB adapter retains established unit, profile, weapon and upgrade identities', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'starcraft-db-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const snapshot = path.join(directory, 'source.json');
  await writeJson(snapshot, {
    ...raw,
    army_units: raw.army_units.filter(unit => mapping[`${unit.faction}/${unit.sourceId}`].base),
  });
  const source = await loadCommandCenter({ snapshot });
  const marine = source.factions
    .find(faction => faction.name === 'Terran')
    .units.find(unit => unit.name === 'Marines');
  assert.equal(marine.sourceId, 'pdf_marines');
  assert.equal(
    marine.profiles.find(profile => /c-14/i.test(profile.name)).sourceId,
    'pdf_marines_default_1',
  );
  const { data, report } = await buildFromCommandCenter({ snapshot });
  const reverseKeys = value =>
    Array.isArray(value)
      ? value.map(reverseKeys)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .reverse()
              .map(key => [key, reverseKeys(value[key])]),
          )
        : value;
  const savedSource = await readJson(snapshot);
  await writeJson(snapshot, reverseKeys(savedSource));
  const reordered = await buildFromCommandCenter({ snapshot });
  assert.equal(
    JSON.stringify(reordered),
    JSON.stringify({ data, report }),
    'Firestore map field order must not change generated bytes',
  );
  assert.equal(
    report.counts.units,
    raw.army_units.filter(unit => mapping[`${unit.faction}/${unit.sourceId}`].base).length,
  );
  assert.equal(report.sourceMode, 'command-center');
  assert.equal(
    JSON.stringify(data['rules.json'], null, 2) + '\n',
    await readFile(path.join(projectRoot, 'Starcraft/rules.json'), 'utf8'),
  );
  assert.ok(data['Terran/units.json'].some(unit => unit.Id === 'unit_marine'));
  assert.deepEqual(
    data['Terran/units.json'].find(unit => unit.Id === 'pdf_Terran_unit_raven').ExtraItems,
    [{ Id: 'pdf_Terran_unit_auto_turret', Type: 'Unit' }],
  );
  for (const options of [
    ['AGG-12', 'Rocket Launcher'],
    ['Rocket Launcher', 'AGG-12'],
  ]) {
    const ids = options.map(
      name =>
        data['options.json'].find(option => option.Id.toLowerCase() === name.toLowerCase()).Id,
    );
    const rows = flattenProfile(applyProfileOptions(data, 'prof_marine', 'unit_marine', ids));
    assert.ok(rows.some(row => /AGG-12/.test(row.Description ?? '')));
    assert.ok(rows.some(row => /ROCKET LAUNCHER/.test(row.Description ?? '')));
  }
});

test('all new DB units validate with explicit fixture footprints; general-rule links stay valid', async () => {
  // Synthetic footprints exercise the pipeline only; never write them into the real mapping.
  const fixtures = structuredClone(mapping);
  for (const entry of Object.values(fixtures))
    entry.base ??= { shape: 'round', widthMm: 32, lengthMm: 32 };
  const { data, report } = await buildFromCommandCenter({ mapping: fixtures });
  assert.equal(report.counts.units, raw.army_units.length);
  assert.deepEqual(
    data['rules.json'],
    await readJson(path.join(projectRoot, 'Starcraft/rules.json')),
  );
  const card = data['cards.json'].find(card => card.Name === "Stukov's Forces");
  assert.ok(card && /Infested/.test(card.Description));
});
test('all races expose unit categories in gameplay order', async () => {
  const { data } = await buildFromCommandCenter();
  const factions = data['hierarchy.json'].Factions;
  for (const race of ['Terran', 'Protoss', 'Zerg'])
    assert.deepEqual(
      Object.keys(factions[race]),
      ['Core', 'Elite', 'Support', 'Hero', 'Other'],
      race,
    );
});
test('unit descriptions omit Minerals and Reinforced cost rows for every race', async () => {
  const { data } = await buildFromCommandCenter();
  for (const file of ['Terran/units.json', 'Protoss/units.json', 'Zerg/units.json'])
    for (const unit of data[file]) {
      assert.doesNotMatch(unit.Description, /^(?:Minerals|Reinforced)\s*:/im);
      assert.match(unit.Description, /^Categories:/);
    }
});
