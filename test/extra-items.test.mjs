import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { addImportExtraItems } from '../src/warhall/extra-items.mjs';

const read = async name =>
  JSON.parse(await readFile(new URL(`../Starcraft/${name}.json`, import.meta.url)));
const data = {};
for (const name of ['cards', 'options', 'tokens', 'bases', 'manifest'])
  data[`${name}.json`] = await read(name);
for (const faction of ['Terran', 'Zerg', 'Protoss'])
  for (const name of ['units', 'profiles'])
    data[`${faction}/${name}.json`] = await read(`${faction}/${name}`);

test('native extras preserve existing items and remain idempotent', () => {
  const copy = structuredClone(data);
  const raven = copy['Terran/units.json'].find(item => item.Id === 'pdf_Terran_unit_raven');
  raven.ExtraItems.push({ Type: 'Token', Id: 'Token5Inch' });
  addImportExtraItems(copy);
  const first = structuredClone(copy);
  addImportExtraItems(copy);
  assert.deepEqual(copy, first);
  assert.ok(raven.ExtraItems.some(item => item.Id === 'Token5Inch'));
});

test('all native extra targets and their profile bases ship in the manifest', () => {
  const byType = Object.fromEntries(
    ['Unit', 'Card', 'Token'].map(type => [
      type,
      Object.values(data)
        .filter(Array.isArray)
        .flat()
        .filter(item => item.Type === type),
    ]),
  );
  const records = Object.entries(data).filter(([, value]) => Array.isArray(value));
  for (const [file, items] of records)
    for (const source of items.filter(item => item.ExtraItems?.length)) {
      assert.ok(data['manifest.json'].files.includes(file));
      for (const extra of source.ExtraItems) {
        const target = byType[extra.Type]?.find(item => item.Id === extra.Id);
        assert.ok(target, `${source.Id} -> ${extra.Id}`);
        if (extra.Type !== 'Unit') continue;
        for (const id of target.BasicProfileIds) {
          const profileFile = records.find(([, entries]) =>
            entries.some(item => item.Id === id),
          )?.[0];
          assert.ok(profileFile && data['manifest.json'].files.includes(profileFile));
        }
      }
    }
});

test('repeated card and unit imports retain native quantities without duplicate definitions', () => {
  const options = data['options.json'].filter(item => item.Type === 7);
  assert.equal(new Set(options.map(item => item.Name)).size, options.length);
  const card = data['cards.json'].find(item => item.Name === 'Nova Covert Ops');
  const option = options.find(item => item.Name === card.Name);
  assert.equal(option.ExtraItems.filter(item => item.Id === card.Id).length, 1);
  assert.equal(
    [option, option].flatMap(item => item.ExtraItems).filter(item => item.Type === 'Unit').length,
    2,
  );
  const corpser = data['Zerg/units.json'].find(item => item.Id === 'pdf_Zerg_unit_corpsers_roach');
  assert.equal([corpser, corpser].flatMap(item => item.ExtraItems).length, 6);
  assert.ok(!options.some(item => item.Name === 'Cocoon'));
  assert.ok(
    !data['Terran/units.json'].find(item => item.Id === 'pdf_Terran_unit_nova_stealth_mode')
      .ExtraItems?.length,
  );
});
