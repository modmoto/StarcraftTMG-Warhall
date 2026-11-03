import { textRow, weaponRows, weaponAttributes } from './presentation.mjs';

export const upgradeBlue = '#2596be';
export const conditionalGreen = '#65c879';
export const blue = value => `<color=${upgradeBlue}>${value}</color>`;
export const conditional = value => `<color=${conditionalGreen}>[${value}]</color>`;
const clean = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const weapons = unit => unit.profiles.filter(profile => /Weapon$/.test(profile.type));
const isPassive = profile =>
  /passive/i.test(profile.attributes.Type ?? profile.attributes.Cost ?? '');

export function upgradeEffects(unit, profile) {
  if (!isPassive(profile)) return [];
  const effect = (profile.attributes.Effect ?? '').replace(/[’‘]/g, "'");
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
      conditionalWeapon(select, conditional('ANTI-EVADE (1) — C-14 Rifle, target within 8"'));
    else if (/S Dice is replaced by D6/.test(effect)) {
      for (const weapon of weapons(unit).filter(select))
        result.push({
          kind: 'weaponNote',
          weapon,
          text: `C-14 Rifle Surge: ${weaponAttributes(weapon.attributes).Surge} ${conditional('Light (D6) — target within 8"')}`,
        });
    }
  }
  if (/Armour characteristic is increased by 1/.test(effect)) {
    const base = unit.attributes.Arm;
    result.push({
      kind: 'statNote',
      text: `Armour: ${base} ${conditional(`${Number(base.replace('+', '')) - 1}+ — within 3" of a mission marker`)}`,
    });
  }
  if (/ON CREEP, increase this Unit's Speed characteristic by 2/.test(effect)) {
    const base = unit.attributes.Spd;
    result.push({
      kind: 'statNote',
      text: `Speed: ${base} ${conditional(
        `${base
          .split('/')
          .map(Number)
          .map(value => value + 2)
          .join('/')} — on creep`,
      )}`,
    });
  }
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
      kind: 'statNote',
      text: conditional('Evade eligible — stationary, first ranged attack; +1 on creep'),
    });
  if (/Supply Value counts as 0/.test(effect))
    result.push({
      kind: 'statNote',
      text: `Supply: ${blue('0')} for calculating the Supply Pool only`,
    });
  if (/1 additional model Within Range/.test(effect))
    result.push({
      kind: 'statNote',
      text: `Life Support / Medpack: ${blue('+1 model')} for calculating effects`,
    });
  if (/Gauss Cannon of the Auto-Turret/.test(effect))
    result.push({
      kind: 'statNote',
      text: `Spawned Auto-Turret — Gauss Cannon Surge: ${blue('Light (D3+1)')}`,
    });
  if (/each eligible model generates 1 additional IMPACT die/.test(effect)) {
    const impact = unit.profiles
      .map(rule => rule.attributes.Effect ?? '')
      .join(' ')
      .match(/IMPACT \((\d+)\) (\d\+)/);
    if (impact)
      result.push({
        kind: 'statNote',
        text: `Devastating Charge: IMPACT ${blue(`(${Number(impact[1]) + 1})`)} ${impact[2]}`,
      });
  }
  if (/Corrosive Bile.*DEBUFF Armour/.test(effect))
    result.push({
      kind: 'statNote',
      text: `Corrosive Bile: ${blue('DEBUFF Armour (1)')} before the target resolves its Armour Roll`,
    });
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
    if (effect.kind === 'weapon') {
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
        { ...effect.weapon, attributes },
        id,
        records,
        glossary,
        phase,
        effect.weapon.attributes,
      );
      remove.push({
        Id: `${oldId}_slot`,
        Ref: [{ Id: `${oldId}_body`, Ref: [{ Id: `${oldId}_table` }] }],
      });
      add.push({
        Id: `${oldId}_slot`,
        Ref: [{ Id: `${oldId}_body`, Ref: rows.map(Id => ({ Id })) }],
      });
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
      const description = `<u><link="${recordId}">${effect.text}</link></u>`;
      textRow(records, id, description);
      if (effect.kind === 'weaponNote') {
        const weaponId = defaults[unit.profiles.indexOf(effect.weapon)];
        add.push({
          Id: `${weaponId}_slot`,
          Ref: [{ Id: id }],
        });
      } else add.push({ Id: `${ids.profile}_selected_options`, Ref: [{ Id: id }] });
    }
  }
}

export function upgradeDisplay(unit, profile) {
  if (/Weapon$/.test(profile.type)) return ['replacement weapon; changed fields blue'];
  if (!isPassive(profile)) return ['rule only; active or reactive activation required'];
  if (/^Increase this Unit's Hit Points characteristic/.test(profile.attributes.Effect ?? ''))
    return ['permanent HP; blue'];
  const effects = upgradeEffects(unit, profile);
  return effects.length
    ? [
        ...new Set(
          effects.map(effect => {
            if (effect.kind === 'weapon')
              return `permanent weapon change; blue: ${effect.weapon.name}`;
            if (effect.kind === 'ability') return `ability definition change; blue: ${effect.name}`;
            const mode = effect.text.includes(conditionalGreen)
              ? 'conditional; green brackets'
              : 'permanent; blue';
            return effect.weapon ? `${mode}: ${effect.weapon.name}` : `${mode}: profile note`;
          }),
        ),
      ]
    : ['rule only; deployment, movement permission or resource effect'];
}
