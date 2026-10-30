import { abilityName } from './abilities.mjs';
import { cleanRuleText } from '../../text.mjs';

export function keywordAlias(name) {
  return name
    .replace(/\s*[\[(].*$/, '')
    .replace(/\s+[XY](?:[”"])?(?:\s|$).*$/, '')
    .trim();
}

export function extractKeywords(pages) {
  const start = pages.findIndex(page =>
    page.items.some(item => /KEYWORD GLOSSARY/.test(item.s) && item.h > 15),
  );
  if (start < 0) throw new Error('Official keyword glossary not found');
  const boundary = pages
    .slice(start + 1)
    .findIndex(page => page.items.some(item => /^PART \d+/.test(item.s) && item.h > 15));
  if (boundary < 0) throw new Error('Official keyword glossary boundary not found');
  const rules = [];
  let current;
  for (const page of pages.slice(start, start + boundary + 1)) {
    for (const item of page.items) {
      if (item.y < 45 || item.y > 740 || item.h > 10.1) continue;
      if (Math.abs(item.h - 10) < 0.05) {
        current = { name: item.s, aliases: [keywordAlias(item.s)], page: page.page, tokens: [] };
        rules.push(current);
      } else if (current) {
        current.tokens.push(
          (item.s === 'X' && item.w / item.h > 0.8 ? '•' : item.s).replace(
            /[\uE000-\uF8FF\uF000-\uF0FF]/g,
            '•',
          ),
        );
      }
    }
  }
  const seen = new Set();
  return rules.map(({ tokens, ...rule }) => {
    const alias = rule.aliases[0];
    if (!alias || seen.has(alias)) throw new Error(`Ambiguous official keyword: ${alias}`);
    seen.add(alias);
    const description = cleanRuleText(tokens.join(' '));
    if (!description) throw new Error(`Empty official keyword: ${rule.name}`);
    return { ...rule, displayName: abilityName(alias), description };
  });
}
