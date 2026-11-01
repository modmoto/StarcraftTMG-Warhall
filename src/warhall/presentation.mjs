export const weaponColumns = {
  RNG: 'Rng',
  T: 'Tgt',
  RoA: 'RoA',
  Hit: 'Hit',
  Surge: 'Surge',
  Damage: 'Dmg',
  Keywords: 'Keyword',
};

export function wrapTableText(text, width = 12) {
  const lines = [];
  let line = '';
  for (const word of String(text).trim().split(/\s+/)) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = '';
    }
    let rest = word;
    while (rest.length > width) {
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    line = line ? `${line} ${rest}` : rest;
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

export function weaponAttributes(attributes) {
  const values = Object.fromEntries(
    Object.entries(weaponColumns).map(([name, key]) => [name, attributes[key] || '-']),
  );
  const targets = { ground: 'G', air: 'A', flying: 'A', all: 'All' };
  values.T = targets[values.T.toLowerCase()] ?? values.T;
  const light = /\blight\b/i.test(values.Surge);
  const armoured = /\barmou?red\b/i.test(values.Surge);
  const type = light && armoured ? 'L&A' : light ? 'Light' : armoured ? 'Armoured' : values.Surge;
  const dice = attributes['S.Die'];
  values.Surge = type === '-' ? '-' : dice && dice !== '-' ? `${type} (${dice})` : type;
  values.Surge = wrapTableText(values.Surge, 14);
  values.Keywords = values.Keywords.split(/,\s*/)
    .map((keyword, index, list) => wrapTableText(keyword + (index < list.length - 1 ? ',' : '')))
    .join('\n');
  return values;
}

const phases = ['Any Phase', 'Movement Phase', 'Assault Phase', 'Melee Phase'];

export function displayPhase(phase) {
  return phase === 'Combat Phase' ? 'Melee Phase' : phase;
}

function profilePhase(profile) {
  if (profile.type === 'Combat Weapon') return 'Melee Phase';
  if (profile.type === 'Assault Weapon') return 'Assault Phase';
  const phase = profile.attributes?.Phase ?? profile.type?.match(/^Rules \((.*)\)$/)?.[1];
  return displayPhase(phase ?? 'Any Phase');
}

function weaponRow(profile, id, records) {
  const rowId = `${id}_table`;
  if (!records.weaponTables.has(rowId)) {
    records.weaponTables.set(rowId, {
      Id: rowId,
      Name: wrapTableText(profile.name),
      Type: 'Statline',
      Attributes: weaponAttributes(profile.attributes),
      Children: [],
    });
  }
  return rowId;
}

export function profileChildren(unit, ids, references, records) {
  const groups = new Map(phases.map(phase => [phase, { weapons: [], rules: [] }]));
  for (const [index, profile] of unit.profiles.entries()) {
    const phase = profilePhase(profile);
    const group = groups.get(phase);
    if (!group) throw new Error(`Unknown display phase: ${unit.name}/${phase}`);
    const id = references[index];
    if (/Weapon$/.test(profile.type)) group.weapons.push(weaponRow(profile, id, records));
    else group.rules.push(id);
  }
  const children = [{ Id: ids.statline }];
  for (const [phase, group] of groups) {
    if (!group.weapons.length && !group.rules.length) continue;
    const headerId = `${ids.profile}_phase_${phase.toLowerCase().replace(/ /g, '_')}`;
    records.rules.set(headerId, {
      Id: headerId,
      Name: '',
      Type: '',
      Description: `<b>${phase}</b>`,
      Children: [],
    });
    children.push(
      { Id: headerId },
      ...[...new Set([...group.weapons, ...group.rules])].map(Id => ({ Id })),
    );
  }
  return children;
}
