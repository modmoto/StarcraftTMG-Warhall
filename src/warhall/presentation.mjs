export const weaponColumns = {
  RNG: 'Rng',
  T: 'Tgt',
  RoA: 'RoA',
  Hit: 'Hit',
  Surge: 'Surge',
  D: 'Dmg',
};

export function weaponAttributes(attributes) {
  const values = Object.fromEntries(
    Object.entries(weaponColumns).map(([name, key]) => [name, attributes[key] || '-']),
  );
  const targets = { ground: 'G', air: 'A', flying: 'A', all: 'All' };
  values.T = targets[values.T.toLowerCase()] ?? values.T;
  const light = /\blight\b/i.test(values.Surge);
  const armoured = /\barmou?red\b/i.test(values.Surge);
  const type = light && armoured ? 'L&A' : light ? 'Light' : armoured ? 'Arm.' : values.Surge;
  const dice = attributes['S.Die'];
  values.Surge = type === '-' ? '-' : dice && dice !== '-' ? `${type}\n${dice}` : type;
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

export function weaponRows(profile, id) {
  const columns = Object.entries(weaponAttributes(profile.attributes)).map(([key, value]) => [
    key,
    value.split('\n'),
  ]);
  const count = Math.max(...columns.map(([, lines]) => lines.length));
  return Array.from({ length: count }, (_, index) => ({
    Id: `${id}_table${index ? `_line_${index + 1}` : ''}`,
    Name: '',
    Type: 'Statline',
    Attributes: Object.fromEntries(columns.map(([key, lines]) => [key, lines[index] ?? ''])),
    Children: [],
  }));
}

function textRow(records, id, description) {
  records.rules.set(id, { Id: id, Name: '', Type: '', Description: description, Children: [] });
  return id;
}

export function weaponKeywords(text, glossary) {
  if (!text || text.trim() === '-') return '';
  const aliases = glossary.entries
    .flatMap(entry => entry.aliases.map(alias => ({ alias, id: entry.record.Id })))
    .sort((a, b) => b.alias.length - a.alias.length);
  return text
    .split(/,\s*/)
    .map(keyword => {
      const target = aliases.find(
        ({ alias }) =>
          keyword.toLowerCase() === alias.toLowerCase() ||
          keyword.toLowerCase().startsWith(`${alias.toLowerCase()} `),
      );
      return target ? `<u><link="${target.id}">${keyword}</link></u>` : keyword;
    })
    .join(', ');
}

export function profileChildren(unit, ids, references, records, glossary) {
  const groups = new Map(phases.map(phase => [phase, []]));
  const rules = [];
  for (const [index, profile] of unit.profiles.entries()) {
    const id = references[index];
    if (!/Weapon$/.test(profile.type)) {
      rules.push(id);
      continue;
    }
    const phase = profilePhase(profile);
    const group = groups.get(phase);
    if (!group) throw new Error(`Unknown display phase: ${unit.name}/${phase}`);
    group.push(textRow(records, `${id}_heading`, `<b>${profile.name}</b>`));
    for (const row of weaponRows(profile, id)) {
      records.weaponTables.set(row.Id, row);
      group.push(row.Id);
    }
    const keywords = weaponKeywords(profile.attributes.Keyword, glossary);
    if (keywords) group.push(textRow(records, `${id}_keywords`, keywords));
  }
  const children = [{ Id: ids.statline }, ...[...new Set(rules)].map(Id => ({ Id }))];
  for (const [phase, weapons] of groups) {
    if (!weapons.length) continue;
    const headerId = `${ids.profile}_phase_${phase.toLowerCase().replace(/ /g, '_')}`;
    textRow(records, headerId, `<b>${phase}</b>`);
    children.push({ Id: headerId }, ...[...new Set(weapons)].map(Id => ({ Id })));
  }
  return children;
}
