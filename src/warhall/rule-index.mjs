const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const key = rule => `${rule.Name.toLowerCase()}\n${rule.Description.replace(/\s+/g, ' ').trim()}`;

function rewrite(value, aliases) {
  if (Array.isArray(value)) return value.map(item => rewrite(item, aliases));
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v, aliases)]));
  if (typeof value !== 'string') return value;
  return (
    aliases.get(value) ??
    value.replace(/<link="([^"]+)">/g, (tag, id) => `<link="${aliases.get(id) ?? id}">`)
  );
}

export function consolidateRules(data, owners) {
  const unique = new Map();
  const aliases = new Map();
  for (const [filename, records] of Object.entries(data)) {
    if (!/(?:^|\/)rules\.json$/.test(filename)) continue;
    data[filename] = records.filter(rule => {
      if (!rule.Name || rule.Type !== 'Rule') return true;
      const previous = unique.get(key(rule));
      if (!previous) {
        unique.set(key(rule), rule);
        return true;
      }
      aliases.set(rule.Id, previous.Id);
      for (const name of owners.get(rule.Id) ?? []) owners.get(previous.Id)?.add(name);
      return false;
    });
  }
  const names = Map.groupBy([...unique.values()], rule => rule.Name.toLowerCase());
  for (const group of names.values()) {
    if (group.length < 2 && !/^Stimpack$/i.test(group[0].Name)) continue;
    for (const rule of group) {
      const unitNames = [...(owners.get(rule.Id) ?? [])];
      const context =
        /^Stimpack$/i.test(rule.Name) &&
        unitNames.some(name => /^(?:Marines|Raynor.s Raiders)$/.test(name))
          ? 'Marines'
          : unitNames.sort().join(', ');
      rule.Name += ` (${context || rule.Id})`;
    }
  }
  for (const filename of Object.keys(data)) data[filename] = rewrite(data[filename], aliases);
  return aliases.size;
}

export function linkRuleIndex(data, glossary, book) {
  const targets = new Map();
  const add = (alias, id) => targets.set(alias.toLowerCase(), id);
  const chaptersByTitle = Map.groupBy(book.chapters, chapter => chapter.title.toLowerCase());
  for (const [title, chapters] of chaptersByTitle) {
    if (chapters.length === 1)
      add(title, `rule_chapter_${chapters[0].number.replaceAll('.', '_')}`);
  }
  for (const [alias, chapter] of Object.entries({
    Coherency: '4.4',
    'Gap Clearance': '4.6',
    Charge: '8.7.7',
    Surge: '8.7.4',
    'Surge Die': '8.7.4',
    'Surge Dice': '8.7.4',
    'Armour Roll': '8.7.4',
    'Evade Roll': '8.7.4',
    'Active Ability': '10.2',
    'Active Abilities': '10.2',
    'Passive Ability': '10.3',
    'Passive Abilities': '10.3',
    'Reaction Ability': '10.4',
    'Reaction Abilities': '10.4',
  }))
    add(alias, `rule_chapter_${chapter.replaceAll('.', '_')}`);
  for (const entry of glossary.entries)
    for (const alias of entry.aliases) add(alias, entry.record.Id);
  const namedRules = Object.entries(data)
    .filter(([file]) => /(?:^|\/)rules\.json$/.test(file))
    .flatMap(([, rules]) => rules)
    .filter(rule => rule.Name && rule.Type === 'Rule');
  for (const rule of namedRules)
    if (!/^\d/.test(rule.Name) && !targets.has(rule.Name.toLowerCase())) add(rule.Name, rule.Id);
  const aliases = [...targets.keys()].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `\\b(?:Parts?|Sections?|Chapters?)\\s+(\\d+(?:\\.\\d+){0,2})(?!\\d|\\.\\d)|(?<![\\p{L}\\p{N}_.])(\\d+\\.\\d+(?:\\.\\d+)?)(?![\\p{L}\\p{N}_]|\\.\\d|\\s*["”″])|(?<![\\p{L}\\p{N}_])(?:${aliases.map(escape).join('|')})(?![\\p{L}\\p{N}_])`,
    'giu',
  );
  const ids = new Set(namedRules.map(rule => rule.Id));
  let count = 0;
  for (const [file, records] of Object.entries(data)) {
    if (!/(?:^|\/)(?:rules|equipment|cards)\.json$/.test(file)) continue;
    for (const rule of records) {
      if (!rule?.Description) continue;
      rule.Description = rule.Description.split(/(<link="[^"]+">[\s\S]*?<\/link>|<[^>]+>)/g)
        .map(segment => {
          if (segment.startsWith('<')) return segment;
          return segment.replace(pattern, (text, prefixedNumber, bareNumber, offset, original) => {
            const number = prefixedNumber ?? bareNumber;
            if (
              /^(?:move|hold|run|deploy)$/i.test(text) &&
              !/^\s+action\b/i.test(original.slice(offset + text.length))
            )
              return text;
            const id = number
              ? `rule_chapter_${number.replaceAll('.', '_')}`
              : targets.get(text.toLowerCase());
            if (file === 'cards.json' && !/^rule_(?:chapter|keyword)_/.test(id)) return text;
            if (!ids.has(id) || id === rule.Id) return text;
            count++;
            return `<link="${id}">${text}</link>`;
          });
        })
        .join('');
      rule.Description = rule.Description.replace(
        /<link="[^"]+">[\s\S]*?<\/link>/g,
        (tag, offset, original) => {
          if (
            original.slice(0, offset).endsWith('<u>') &&
            original.slice(offset + tag.length).startsWith('</u>')
          )
            return tag;
          return `<u>${tag}</u>`;
        },
      );
    }
  }
  return count;
}
