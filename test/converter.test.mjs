import test from 'node:test';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildFromNewRecruit as build } from '../src/convert.mjs';
import { projectRoot as project } from '../src/paths.mjs';
import { validateData } from '../src/warhall/validate.mjs';

const source = path.resolve(project, '../StarcraftTMG-NR');
const optionalSource = { skip: !existsSync(source) };

test(
  'real catalogues produce all factions, default Marine weapons, separate shields and clean descriptions',
  optionalSource,
  async () => {
    const { data, report } = await build(source);
    assert.equal(report.counts.units, 31);
    assert.deepEqual(Object.keys(data['hierarchy.json'].Factions).sort(), [
      'Protoss',
      'Terran',
      'Zerg',
    ]);
    assert.equal(data['gameconfig.json'].WoundsAttribute, 'HP');
    const marineStats = data['Terran/statlines.json'].find(s => s.Id === 'stat_marine');
    assert.equal(marineStats.Attributes.HP, '2');
    assert.equal(marineStats.Attributes.Spd, '4/7');
    const marine = data['Terran/units.json'].find(s => s.Id === 'unit_marine');
    assert.doesNotMatch(marine.Description, /OPTIONAL UPGRADE|Source:|manual|not applied/);
    assert.ok(
      report.units.find(u => u.name === 'Marines').optionalUpgrades.includes('Combat Shield'),
    );
    const refs = data['Terran/profiles.json']
      .find(p => p.Id === 'prof_marine')
      .Children.map(c => c.Id);
    const tableRefs = data['Terran/statlines.json']
      .filter(row => refs.includes(row.Id) && row.Attributes.RoA)
      .flatMap(row => row.Children.map(child => child.Id));
    const weapons = data['Terran/equipment.json'].filter(w => tableRefs.includes(w.Id));
    assert.deepEqual(weapons.map(w => w.Name).sort(), ['C-14 Rifle', 'Strike']);
    const zealot = data['Protoss/statlines.json'].find(s => s.Name === 'Zealot');
    assert.equal(zealot.Attributes.HP, '4');
    assert.equal(zealot.Attributes.Shd, '3');
    const expected = {
      Marines: 32,
      Marauders: 50,
      Goliath: 80,
      'Siege Tank': 150,
      'Jim Raynor': 40,
      Artanis: 40,
      Zeratul: 40,
      Kerrigan: 40,
      Zerglings: 32,
      Immortal: 100,
      Ravagers: 80,
      Sentries: 50,
      Zealots: 40,
      Queen: 80,
    };
    for (const [name, size] of Object.entries(expected)) {
      const unit = report.units.find(u => u.name === name);
      assert.equal(unit.baseDiameterMm, size, name);
      const profile = data[`${unit.faction}/profiles.json`].find(p => p.Id === unit.profileId);
      const base = data['bases.json'].find(b => b.Id === profile.BaseId);
      assert.deepEqual([base.Shape, base.Width, base.Length], [1, size, size], name);
    }
    assert.deepEqual(
      data['bases.json'].filter(b => b.Width === b.Length).map(b => b.Width),
      [32, 40, 50, 80, 100, 150],
    );
    const hydra = report.units.find(u => u.name === 'Hydralisks');
    const hydraProfile = data['Zerg/profiles.json'].find(p => p.Id === hydra.profileId);
    const hydraBase = data['bases.json'].find(b => b.Id === hydraProfile.BaseId);
    assert.deepEqual([hydraBase.Shape, hydraBase.Width, hydraBase.Length], [1, 40, 100]);
    assert.equal(hydra.baseShape, 'oval');
    assert.equal(hydra.baseDiameterMm, null);
    assert.equal(report.units.filter(u => u.baseShape === 'oval').length, 1);
    const badLength = structuredClone(data);
    badLength['bases.json'].find(b => b.Id === hydraBase.Id).Length = 0;
    assert.throws(() => validateData(badLength), /positive round\/oval base dimensions/);
    assert.ok(data['rules.json'].some(rule => rule.Name === 'Precision'));
  },
);

test('regeneration is deterministic', optionalSource, async () => {
  assert.deepEqual(await build(source), await build(source));
});

test(
  'validator rejects broken references, duplicate IDs, missing HP and incorrect base size',
  optionalSource,
  async () => {
    const { data } = await build(source);
    const badRef = structuredClone(data);
    badRef['Terran/profiles.json'][0].Children.push({ Id: 'missing' });
    assert.throws(() => validateData(badRef), /Unresolved reference/);
    const duplicate = structuredClone(data);
    duplicate['Terran/units.json'].push(duplicate['Terran/units.json'][0]);
    assert.throws(() => validateData(duplicate), /Duplicate ID/);
    const missingHP = structuredClone(data);
    delete missingHP['Terran/statlines.json'].find(row => row.Id === 'stat_marine').Attributes.HP;
    assert.throws(() => validateData(missingHP), /Invalid configured HP/);
    const wrongBase = structuredClone(data);
    wrongBase['bases.json'][0].Width = 0;
    assert.throws(() => validateData(wrongBase), /positive round\/oval base dimensions/);
  },
);

async function fixture(t, catalogue) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'starcraft-converter-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(
    path.join(dir, 'Test.gst'),
    '<gameSystem id="system" revision="1"><sharedRules><rule id="shared" name="System rule"><description>Wrong scope</description></rule></sharedRules></gameSystem>',
  );
  await writeFile(path.join(dir, 'Test.cat'), catalogue);
  return dir;
}
const catalogue = `<catalogue name="Test" gameSystemId="system" gameSystemRevision="1" revision="1">
<selectionEntries><selectionEntry id="unit" name="Example" type="model"><profiles><profile id="stats" name="Example" typeName="Unit"><characteristics><characteristic name="HP">2</characteristic></characteristics></profile></profiles><infoLinks><infoLink targetId="shared" type="rule" /></infoLinks></selectionEntry></selectionEntries>
<sharedRules><rule id="shared" name="Local rule"><description>Correct catalogue scope</description></rule></sharedRules></catalogue>`;

test('catalogue-local rule wins over a colliding game-system ID', async t => {
  const dir = await fixture(t, catalogue);
  const { data } = await build(dir);
  assert.equal(
    data['Test/rules.json'].find(rule => rule.Name === 'Local rule').Description,
    'Correct catalogue scope',
  );
});

test('missing source references fail before output', async t => {
  const dir = await fixture(t, catalogue.replace('targetId="shared"', 'targetId="missing"'));
  await assert.rejects(build(dir), /Unresolved reference missing/);
});

test('malformed XML is rejected', async t => {
  const dir = await fixture(t, '<catalogue><broken></catalogue>');
  await assert.rejects(build(dir), /Invalid XML/);
});
