import assert from 'node:assert/strict';
import { abilityName } from '../sources/pdf/abilities.mjs';
import { weaponRows } from './presentation.mjs';

const normalized = value =>
  value
    .toLowerCase()
    .replace(/riffle/g, 'rifle')
    .replace(/[^a-z0-9]/g, '');

function replacedWeapon(unit, profile) {
  if (!/Weapon$/.test(profile.type)) return undefined;
  const weapons = unit.profiles.filter(candidate => /Weapon$/.test(candidate.type));
  const note = profile.attributes.Notes ?? profile.attributes.Upgrade ?? '';
  const explicit = note.match(/\bFOR\s+(.+)$/i)?.[1];
  if (explicit) {
    const matches = weapons.filter(
      candidate => normalized(candidate.name) === normalized(explicit),
    );
    assert.equal(
      matches.length,
      1,
      `Unknown replacement: ${unit.name}/${profile.name}/${explicit}`,
    );
    return matches[0];
  }
  const candidates = weapons.filter(candidate => candidate.type === profile.type);
  if (candidates.length === 1) return candidates[0];
  const side = profile.name.match(/^(LEFT|RIGHT)\b/i)?.[0];
  const lastWord = profile.name.trim().split(/\s+/).at(-1);
  const matches = candidates.filter(candidate =>
    side
      ? candidate.name.toLowerCase().startsWith(side.toLowerCase() + ' ')
      : normalized(candidate.name.split(/\s+/).at(-1)) === normalized(lastWord),
  );
  assert.equal(matches.length, 1, `Ambiguous replacement: ${unit.name}/${profile.name}`);
  return matches[0];
}

export function addUpgradeOptions(unit, ids, profiles, profileIds, defaults, records, glossary) {
  const rows = new Map(
    profiles.flatMap((profile, index) =>
      /Weapon$/.test(profile.type)
        ? [[profileIds[index], weaponRows(profile, profileIds[index], records, glossary)]]
        : [],
    ),
  );
  for (const [index, profile] of profiles.entries()) {
    const recordId = profileIds[index];
    const optionId = abilityName(profile.name);
    const isWeapon = /Weapon$/.test(profile.type);
    let labelId = recordId;
    if (isWeapon) {
      labelId = `${recordId}_choice`;
      records.rules.set(labelId, {
        Id: labelId,
        Name: abilityName(profile.name),
        Type: 'Rule',
        Description: `<b>Upgrade ability</b>\n\n${records.equipment.get(recordId).Description}`,
      });
      records.owners.set(labelId, new Set([unit.name]));
    }
    const add = [{ Id: `${ids.profile}_selected_options`, Ref: [{ Id: labelId }] }];
    const remove = [];
    const replaced = replacedWeapon(unit, profile);
    if (replaced) {
      const oldId = defaults[unit.profiles.indexOf(replaced)];
      const slot = `${oldId}_slot`;
      const alternatives = profiles.flatMap((candidate, candidateIndex) => {
        if (!/Weapon$/.test(candidate.type) || replacedWeapon(unit, candidate) !== replaced)
          return [];
        return rows.get(profileIds[candidateIndex]);
      });
      remove.push({
        Id: slot,
        Ref: [...records.rules.get(slot).Children, ...alternatives.map(Id => ({ Id }))],
      });
      if (isWeapon) add.push({ Id: slot, Ref: rows.get(recordId).map(Id => ({ Id })) });
    }
    const hp = profile.attributes.Effect?.match(
      /^Increase this Unit's Hit Points characteristic by (\d+)\.$/i,
    );
    if (hp && /Passive/i.test(profile.attributes.Type ?? profile.attributes.Cost ?? '')) {
      const upgraded = `${ids.statline}_${optionId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      const base = records.statlines.find(record => record.Id === ids.statline);
      records.statlines.push({
        ...structuredClone(base),
        Id: upgraded,
        Attributes: { ...base.Attributes, HP: String(Number(base.Attributes.HP) + Number(hp[1])) },
      });
      remove.push({ Id: `${ids.profile}_stats`, Ref: [{ Id: ids.statline }] });
      add.push({ Id: `${ids.profile}_stats`, Ref: [{ Id: upgraded }] });
    }
    records.options.set(optionId, {
      Id: optionId,
      Name: optionId,
      Type: 1,
      ItemsToAdd: [],
    });
    records.modifiedunit.push({ UnitId: ids.unit, OptionId: optionId });
    records.modifiedprofile.push({
      UnitId: ids.unit,
      ProfileId: ids.profile,
      OptionId: optionId,
      ReferencedItemsToRemove: remove,
      ReferencedItemsToAdd: add,
    });
  }
}
