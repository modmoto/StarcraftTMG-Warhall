export const weaponColumns = {
  RNG: 'Rng',
  Target: 'Tgt',
  RoA: 'RoA',
  Hit: 'Hit',
  Surge: 'Surge',
  D: 'Dmg',
};

export function weaponAttributes(attributes) {
  const values = Object.fromEntries(
    Object.entries(weaponColumns).map(([name, key]) => [name, attributes[key] || '-']),
  );
  const targets = { ground: 'Ground', air: 'Air', flying: 'Air', all: 'All' };
  values.Target = targets[values.Target.toLowerCase()] ?? values.Target;
  const light = /\blight\b/i.test(values.Surge);
  const armoured = /\barmou?red\b/i.test(values.Surge);
  const type = light && armoured ? 'L&A' : light ? 'Light' : armoured ? 'Armored' : values.Surge;
  const dice = attributes['S.Die'];
  values.Surge = type === '-' ? '-' : dice && dice !== '-' ? `${type} (${dice})` : type;
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

export function weaponTable(attributes) {
  const values = weaponAttributes(attributes);
  if (
    !/^(?:E|\d+["”]?)$/.test(values.RNG) ||
    !/^(?:All|Ground|Air)$/.test(values.Target) ||
    !/^(?:\d+|BT(?:\+\d+)?)$/.test(values.RoA) ||
    !/^(?:\d\+|-)$/.test(values.Hit) ||
    !/^\d+$/.test(values.D)
  )
    throw new Error('Invalid weapon table values');
  const positions = { RNG: 0, Target: 14, RoA: 32, Hit: 46, Surge: 59, D: 86 };
  const row = entries =>
    Object.entries(positions)
      .map(([key, position]) => `<pos=${position}%><nobr>${entries[key]}</nobr>`)
      .join('');
  const headers = Object.fromEntries(Object.keys(positions).map(key => [key, key]));
  return `<align=left><size=9><color=#2596be>${row(headers)}</color>\n<b>${row(values)}</b></size></align>`;
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
    group.push(textRow(records, `${id}_table`, weaponTable(profile.attributes)));
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
