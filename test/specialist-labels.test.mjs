import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFromCommandCenter } from '../src/convert.mjs';
import { validateData } from '../src/warhall/validate.mjs';

test('native unit creation lists ordinary upgrades before alphabetically sorted specialists', async () => {
  const { data } = await buildFromCommandCenter();
  const links = data['Zerg/modifiedunit.json'].filter(
    row => row.UnitId === 'pdf_Zerg_unit_infested_marine',
  );
  assert.deepEqual(
    links.map(row => row.OptionId),
    [
      'Burrow Ambush',
      'Plagued Munitions',
      'Wild Mutation',
      'Infested Missile Launcher - Acid Blast',
      'Infested Missile Launcher - Scourgeshot',
    ],
  );
  const options = new Map(data['options.json'].map(option => [option.Id, option]));
  for (const file of Object.keys(data).filter(file =>
    /\/modified(?:unit|profile)\.json$/.test(file),
  )) {
    for (const rows of Map.groupBy(
      data[file],
      row => `${row.UnitId}/${row.ProfileId ?? ''}`,
    ).values()) {
      let specialistSeen = false;
      const namesByType = new Map();
      for (const row of rows) {
        const option = options.get(row.OptionId);
        if (option.Type === 4) specialistSeen = true;
        else assert.ok(!specialistSeen, `${file}: ordinary upgrade follows specialist`);
        const names = namesByType.get(option.Type) ?? [];
        names.push(option.Name.replace(/<[^>]+>/g, ''));
        namesByType.set(option.Type, names);
      }
      for (const names of namesByType.values())
        assert.deepEqual(
          names,
          [...names].sort((a, b) => a.localeCompare(b, 'en')),
        );
    }
  }
});

test('data validation rejects an uncoloured specialist label in any faction', async () => {
  const { data } = await buildFromCommandCenter();
  const options = data['options.json'].filter(option =>
    option.ItemsToAdd?.some(item => item.Id === 'rule_keyword_specialist'),
  );
  assert.ok(options.length > 0);
  validateData(data);
  for (const option of options) {
    const original = option.Name;
    try {
      option.Name = original.replace(/<[^>]+>/g, '');
      assert.throws(
        () => validateData(data),
        /Specialist options require a blue clickable description link/,
      );
    } finally {
      option.Name = original;
    }
  }
});
