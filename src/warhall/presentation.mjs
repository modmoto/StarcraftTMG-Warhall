export const weaponColumns = {
  Range: 'Rng',
  Target: 'Tgt',
  RoA: 'RoA',
  Hit: 'Hit',
  'Surge Type': 'Surge',
  'Surge Dice': 'S.Die',
  Damage: 'Dmg',
  Keywords: 'Keyword',
};

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
      Name: profile.name,
      Type: 'Statline',
      Attributes: Object.fromEntries(
        Object.entries(weaponColumns).map(([name, key]) => [name, profile.attributes[key] || '-']),
      ),
      Children: [{ Id: id }],
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
