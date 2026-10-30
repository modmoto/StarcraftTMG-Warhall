import path from 'node:path';
import { readJson } from '../io.mjs';
import { projectRoot } from '../paths.mjs';

const slug = value =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function loadKeywordRules() {
  const glossary = await readJson(path.join(projectRoot, 'rule-keywords.json'));
  return {
    source: glossary.source,
    entries: glossary.rules.map(rule => ({
      record: {
        Id: `rule_keyword_${slug(rule.aliases[0])}`,
        Name: rule.displayName,
        Type: 'Rule',
        Description: rule.description,
      },
      aliases: rule.aliases,
    })),
  };
}

function linkDescription(record, keywords, abilities) {
  const targets = new Map();
  for (const entry of keywords) {
    for (const alias of entry.aliases)
      targets.set(alias.toLowerCase(), { id: entry.record.Id, explicit: false });
  }
  for (const ability of abilities) {
    if (!targets.has(ability.Name.toLowerCase()))
      targets.set(ability.Name.toLowerCase(), { id: ability.Id, explicit: true });
  }
  const aliases = [...targets.keys()].sort((a, b) => b.length - a.length);
  if (!aliases.length) return 0;
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(?:${aliases.map(escape).join('|')})(?![\\p{L}\\p{N}_])`,
    'giu',
  );
  const linked = new Set();
  let count = 0;
  record.Description = record.Description.replace(pattern, (text, offset, original) => {
    const target = targets.get(text.toLowerCase());
    if (target.id === record.Id || linked.has(target.id)) return text;
    if (
      target.explicit &&
      !/^\s+(?:special\s+)?abilit(?:y|ies)\b/i.test(original.slice(offset + text.length))
    )
      return text;
    linked.add(target.id);
    count++;
    return `<link="${target.id}">${text}</link>`;
  });
  return count;
}

export function linkKeywordRules(glossary) {
  return glossary.entries.reduce(
    (count, entry) => count + linkDescription(entry.record, glossary.entries, []),
    0,
  );
}

export function linkFactionRules(records, glossary) {
  let count = 0;
  const visited = new Set();
  for (const context of records.contexts) {
    const abilities = context.map(id => records.rules.get(id)).filter(Boolean);
    for (const id of context) {
      if (visited.has(id)) continue;
      visited.add(id);
      const record = records.rules.get(id) ?? records.equipment.get(id);
      if (record) count += linkDescription(record, glossary.entries, abilities);
    }
  }
  return count;
}
