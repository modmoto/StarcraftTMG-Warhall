import assert from 'node:assert/strict';
import { upgradedHealth } from './stat-values.mjs';
import { applyUpgradeEffects } from './upgrade-effects.mjs';
import { abilityName } from '../sources/pdf/abilities.mjs';
import { weaponRows, weaponTable, weaponKeywords } from './presentation.mjs';

const normalized = value =>
  value
    .toLowerCase()
    .replace(/riffle/g, 'rifle')
    .replace(/[^a-z0-9]/g, '');

const specialist = profile => /\bSPECIALIST\b/i.test(profile.attributes.Keyword ?? '');

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
        ? [
            [
              profileIds[index],
              weaponRows(
                profile,
                profileIds[index],
                records,
                glossary,
                specialist(profile)
                  ? ''
                  : (records.rules
                      .get(
                        `${defaults[unit.profiles.indexOf(replacedWeapon(unit, profile))]}_table`,
                      )
                      ?.Description.match(/^<b>([^<]*Phase)<\/b>\n/)?.[1] ?? ''),
                specialist(profile) ? profile.attributes : replacedWeapon(unit, profile).attributes,
              ),
            ],
          ]
        : [],
    ),
  );
  for (const [index, profile] of profiles.entries()) {
    const recordId = profileIds[index];
    const optionId = abilityName(profile.name);
    const isWeapon = /Weapon$/.test(profile.type);
    const displayName = isWeapon && /^[A-Z]+-\d+$/.test(profile.name) ? profile.name : optionId;
    const replaced = replacedWeapon(unit, profile);
    let labelId = recordId;
    if (isWeapon) {
      labelId = `${recordId}_choice`;
      const baseline = specialist(profile) ? profile.attributes : replaced.attributes;
      records.rules.set(labelId, {
        Id: labelId,
        Name: displayName,
        Type: 'Rule',
        Description: [
          '<b>Upgrade ability</b>',
          specialist(profile)
            ? `Add ${profile.name} for the specialist model.`
            : `Replace ${replaced.name} with ${profile.name}.`,
          `<b>${profile.name}</b>\n${weaponTable(profile.attributes, baseline)}`,
          weaponKeywords(profile.attributes.Keyword, glossary, baseline.Keyword),
        ]
          .filter(Boolean)
          .join('\n\n'),
      });
      records.owners.set(labelId, new Set([unit.name]));
    }
    const add = [{ Id: `${ids.profile}_selected_options`, Ref: [{ Id: labelId }] }];
    const remove = [];
    if (replaced && specialist(profile)) {
      const oldId = defaults[unit.profiles.indexOf(replaced)];
      add.push({ Id: `${oldId}_slot`, Ref: rows.get(recordId).map(Id => ({ Id })) });
    } else if (replaced) {
      const oldId = defaults[unit.profiles.indexOf(replaced)];
      const alternatives = profiles.flatMap((candidate, candidateIndex) =>
        !specialist(candidate) && replacedWeapon(unit, candidate) === replaced
          ? rows.get(profileIds[candidateIndex])
          : [],
      );
      for (const [suffix, rowSuffix] of [
        ['_body', '_table'],
        ['_keyword_row', '_keywords'],
      ]) {
        const group = oldId + suffix;
        const refs = [
          ...records.rules.get(group).Children,
          ...alternatives.filter(id => id.endsWith(rowSuffix)).map(Id => ({ Id })),
        ];
        if (refs.length) remove.push({ Id: `${oldId}_slot`, Ref: [{ Id: group, Ref: refs }] });
        const replacement = rows.get(recordId).filter(id => id.endsWith(rowSuffix));
        if (replacement.length)
          add.push({
            Id: `${oldId}_slot`,
            Ref: [{ Id: group, Ref: replacement.map(Id => ({ Id })) }],
          });
      }
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
        Attributes: {
          ...base.Attributes,
          HP: upgradedHealth(Number(base.Attributes.HP) + Number(hp[1])),
        },
      });
      remove.push({ Id: `${ids.profile}_stats`, Ref: [{ Id: ids.statline }] });
      add.push({ Id: `${ids.profile}_stats`, Ref: [{ Id: upgraded }] });
    }
    applyUpgradeEffects(unit, profile, recordId, ids, defaults, records, glossary, add, remove);
    records.options.set(optionId, {
      Id: optionId,
      Name: displayName,
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
