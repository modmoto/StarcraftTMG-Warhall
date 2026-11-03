import { textRow, weaponRows, inlineWeaponRow } from './presentation.mjs';

export const upgradeBlue = '#2596be';
export const conditionalGreen = '#65c879';
export const blue = value => `<color=${upgradeBlue}>${value}</color>`;
export const conditional = value => `<color=${conditionalGreen}>(${value})</color>`;
const clean = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const weapons = unit => unit.profiles.filter(profile => /Weapon$/.test(profile.type));
const isPassive = profile =>
  /passive/i.test(profile.attributes.Type ?? profile.attributes.Cost ?? '');

export function upgradeEffects(unit, profile) {
  const effect = (profile.attributes.Effect ?? '').replace(/[’‘]/g, "'");
  if (!isPassive(profile)) {
    const glaive = weapons(unit).find(weapon => clean(weapon.name) === 'glaivecannon');
    if (glaive && /Glaive Cannon gains BUFF RoA \(1\)/i.test(effect)) {
      const base = glaive.attributes.RoA;
      return [
        {
          kind: 'weapon',
          weapon: glaive,
          conditionalRoa: Number(base) + 1,
        },
      ];
    }
    return [];
  }
  const result = [];
  const matchWeapons = names =>
    weapons(unit).filter(weapon => names.some(name => clean(name) === clean(weapon.name)));
  const gain = effect.match(/^This Unit's (.+?) (?:Ranged |ranged )?weapons? gain(?:s)? (.+)\.$/);
  if (gain) {
    const names = gain[1].split(/ and /);
    for (const weapon of matchWeapons(names)) {
      if (/^Surge Type:/i.test(gain[2])) {
        const surge = gain[2].match(/^Surge Type: (\w+),? and S[ -]Dice: (D\d+(?:\+\d+)?)$/i);
        if (surge)
          result.push({
            kind: 'weapon',
            weapon,
            attributes: { Surge: surge[1], 'S.Die': surge[2] },
          });
      } else result.push({ kind: 'weapon', weapon, keyword: gain[2] });
    }
  }
  const conditionalWeapon = (select, text) => {
    for (const weapon of weapons(unit).filter(select))
      result.push({ kind: 'weaponNote', weapon, text });
  };
  const ranged = weapon => weapon.type === 'Assault Weapon';
  const melee = weapon => weapon.type === 'Combat Weapon';
  if (/already been Activated/.test(effect))
    conditionalWeapon(ranged, conditional('INSTANT — target already activated'));
  if (/target is Engaged with at least 1 other Friendly Unit/.test(effect))
    conditionalWeapon(
      melee,
      conditional('PRECISION (2) — target engaged with another friendly unit'),
    );
  if (/its Ranged Weapons gain CRITICAL HIT/.test(effect))
    conditionalWeapon(
      ranged,
      conditional('CRITICAL HIT (1) — both units within 3" of the same mission marker'),
    );
  if (/target Unit is more than 8" away/.test(effect))
    conditionalWeapon(ranged, conditional('PRECISION (1) — target more than 8" away'));
  if (/C-14 Rifle and the target is Within 8"/.test(effect)) {
    const select = weapon => clean(weapon.name) === 'c14rifle';
    if (/ANTI-EVADE/.test(effect))
      conditionalWeapon(select, `<color=${conditionalGreen}>ANTI-EVADE (1)</color>`);
    else if (/S Dice is replaced by D6/.test(effect)) {
      for (const weapon of weapons(unit).filter(select))
        result.push({
          kind: 'weapon',
          weapon,
          conditionalSurge: 'D6',
        });
    }
  }
  if (/ON CREEP, increase this Unit's Speed characteristic by 2/.test(effect))
    result.push({
      kind: 'stat',
      key: 'Spd',
      value: unit.attributes.Spd.split('/')
        .map(value => Number(value) + 2)
        .join('/'),
    });
  if (/Claws and Shredding Claws weapons gain PRECISION/.test(effect)) {
    result.length = 0;
    for (const weapon of weapons(unit).filter(melee))
      result.push({ kind: 'weaponNote', weapon, text: blue('PRECISION (2)') });
  }
  if (/first Armour Roll of each Activation/.test(effect))
    result.push({
      kind: 'statNote',
      text: conditional('TOUGH (1) — first Armour Roll of each activation'),
    });
  if (/Stationary Status.*Evade Roll/.test(effect))
    result.push({
      kind: 'stat',
      key: 'Eva',
      value: `${Number(unit.attributes.Eva.replace('+', '')) - 1}+`,
    });
  if (/each eligible model generates 1 additional IMPACT die/.test(effect)) {
    const original = unit.profiles.find(rule => clean(rule.name) === 'devastatingcharge');
    const impact = original?.attributes.Effect?.match(/IMPACT \((\d+)\) (\d\+)/);
    if (impact)
      result.push({
        kind: 'impact',
        original,
        before: impact[0],
        dice: Number(impact[1]) + 1,
        hit: impact[2],
      });
  }
  const ability =
    effect.match(/^Increase the (Optical Flare) special ability's Range to (16")\.$/) ??
    effect.match(/^Increase the area of effect of this Unit's (Corrosive Bile) ability to (2")\.$/);
  if (ability)
    result.push({
      kind: 'ability',
      name: ability[1],
      value: ability[2],
      area: /area of effect/.test(effect),
    });
  return result;
}

export function applyUpgradeEffects(
  unit,
  profile,
  recordId,
  ids,
  defaults,
  records,
  glossary,
  add,
  remove,
) {
  for (const [index, effect] of upgradeEffects(unit, profile).entries()) {
    const id = `${recordId}_effect_${index}`;
    if (effect.kind === 'stat') {
      const base = records.statlines.find(record => record.Id === ids.statline);
      const value = `<u><link="${recordId}">${conditional(effect.value)}</link></u>`;
      records.statlines.push({
        ...structuredClone(base),
        Id: id,
        Attributes: { ...base.Attributes, [effect.key]: `${base.Attributes[effect.key]} ${value}` },
      });
      const stats = `${ids.profile}_stats`;
      remove.push({ Id: stats, Ref: [{ Id: ids.statline }] });
      add.push({ Id: stats, Ref: [{ Id: id }] });
    } else if (effect.kind === 'weapon') {
      const oldId = defaults[unit.profiles.indexOf(effect.weapon)];
      const attributes = { ...effect.weapon.attributes, ...effect.attributes };
      if (effect.keyword) {
        const parts = (attributes.Keyword ?? '-').split(/,\s*/).filter(value => value !== '-');
        const stem = effect.keyword
          .replace(/\s*\([^)]*\)/g, '')
          .trim()
          .toLowerCase();
        attributes.Keyword = [
          ...parts.filter(
            value =>
              value
                .replace(/\s*\([^)]*\)/g, '')
                .trim()
                .toLowerCase() !== stem,
          ),
          effect.keyword,
        ].join(', ');
      }
      const phase =
        records.rules.get(`${oldId}_table`).Description.match(/^<b>([^<]*Phase)<\/b>\n/)?.[1] ?? '';
      const rows = weaponRows(
        {
          ...effect.weapon,
          attributes,
          conditionalRoa: effect.conditionalRoa && {
            value: effect.conditionalRoa,
            ruleId: recordId,
          },
          conditionalSurge: effect.conditionalSurge && {
            value: effect.conditionalSurge,
            ruleId: recordId,
          },
        },
        id,
        records,
        glossary,
        phase,
        effect.weapon.attributes,
      );
      const tableOnly = effect.conditionalRoa || effect.conditionalSurge;
      const groups = [
        !effect.keyword && [`${oldId}_body`, `${oldId}_table`, rows.slice(0, 1)],
        !tableOnly && [`${oldId}_keyword_row`, `${oldId}_keywords`, rows.slice(1)],
      ].filter(Boolean);
      for (const [group, original, replacements] of groups) {
        if (records.rules.has(original))
          remove.push({ Id: `${oldId}_slot`, Ref: [{ Id: group, Ref: [{ Id: original }] }] });
        if (replacements.length)
          add.push({
            Id: `${oldId}_slot`,
            Ref: [{ Id: group, Ref: replacements.map(Id => ({ Id })) }],
          });
      }
    } else if (effect.kind === 'impact') {
      const oldId = defaults[unit.profiles.indexOf(effect.original)];
      const original = records.rules.get(oldId);
      const impact = `IMPACT ${blue(`(${effect.dice})`)} ${effect.hit}`;
      records.rules.set(id, {
        ...structuredClone(original),
        Id: id,
        Name: `Devastating Charge ${impact}`,
        Description: original.Description.replace(effect.before, impact),
      });
      records.owners.set(id, new Set([unit.name]));
      remove.push({ Id: oldId });
      add.push({ Id: `${ids.profile}_selected_options`, Ref: [{ Id: id }] });
    } else if (effect.kind === 'ability') {
      const original = unit.profiles.find(rule => clean(rule.name) === clean(effect.name));
      const oldId = defaults[unit.profiles.indexOf(original)];
      const originalRule = records.rules.get(oldId);
      const description = effect.area
        ? originalRule.Description.replace(/Within 1"/g, `Within ${blue(effect.value)}`)
        : originalRule.Description.replace(/Within 12"/g, `Within ${blue(effect.value)}`);
      records.rules.set(id, {
        ...structuredClone(originalRule),
        Id: id,
        Name: `${originalRule.Name} (${effect.area ? 'Area' : 'Range'} ${effect.value})`,
        Description: '<b>Upgrade ability</b>\n\n' + description,
      });
      records.owners.set(id, new Set([unit.name]));
      remove.push({ Id: oldId });
      add.push({ Id: `${ids.profile}_selected_options`, Ref: [{ Id: id }] });
    } else {
      const label = effect.text.match(
        /^<color=(#[a-f0-9]+)>\(?(INSTANT|Evade eligible|(?:PRECISION|CRITICAL HIT|ANTI-EVADE|TOUGH) \(\d+\))/i,
      );
      if (label) {
        const [, color, name] = label;
        const link = `<u><link="${recordId}"><color=${color}>${name}</color></link></u>`;
        if (effect.kind === 'weaponNote') inlineWeaponRow(records, id, link);
        else textRow(records, id, link);
      } else {
        const text = effect.text.replace(
          /<color=#65c879>.*?<\/color>/g,
          value => `<link="${recordId}">${value}</link>`,
        );
        textRow(records, id, text);
      }
      if (effect.kind === 'weaponNote') {
        const weaponId = defaults[unit.profiles.indexOf(effect.weapon)];
        add.push({
          Id: `${weaponId}_slot`,
          Ref: [{ Id: `${weaponId}_keyword_row`, Ref: [{ Id: id }] }],
        });
      } else add.push({ Id: `${ids.profile}_selected_options`, Ref: [{ Id: id }] });
    }
  }
}

export function upgradeDisplay(unit, profile) {
  if (/Weapon$/.test(profile.type))
    return /\bSPECIALIST\b/i.test(profile.attributes.Keyword ?? '')
      ? ['additional specialist weapon']
      : ['replacement weapon; changed fields blue'];
  if (/^Increase this Unit's Hit Points characteristic/.test(profile.attributes.Effect ?? ''))
    return ['permanent HP; blue'];
  const effects = upgradeEffects(unit, profile);
  if (!isPassive(profile) && !effects.length)
    return ['rule only; active or reactive activation required'];
  return effects.length
    ? [
        ...new Set(
          effects.map(effect => {
            if (effect.kind === 'stat') return `conditional ${effect.key}; green: stat cell`;
            if (effect.conditionalRoa) return `conditional RoA; green: ${effect.weapon.name}`;
            if (effect.conditionalSurge) return `conditional surge; green: ${effect.weapon.name}`;
            if (effect.kind === 'weapon')
              return `permanent weapon change; blue: ${effect.weapon.name}`;
            if (effect.kind === 'impact') return 'permanent IMPACT dice; blue: Devastating Charge';
            if (effect.kind === 'ability') return `ability definition change; blue: ${effect.name}`;
            const mode = effect.text.includes(conditionalGreen)
              ? 'conditional; green'
              : 'permanent; blue';
            return effect.weapon ? `${mode}: ${effect.weapon.name}` : `${mode}: profile note`;
          }),
        ),
      ]
    : ['rule only; deployment, movement permission or resource effect'];
}
