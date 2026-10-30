import { cleanRuleText } from '../../text.mjs';
import { normalizeText } from './names.mjs';

const heading = /([A-Z][A-Z0-9'’!(),/& -]*?)\s*:\s*(PASSIVE|ACTIVE|REACTION)\b/g;

export function abilityName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, letter => letter.toUpperCase())
    .replace(/\b(emp|cp|pe|bm)\b/gi, word => word.toUpperCase());
}

export function readAbilities(text, phase, context) {
  text = text.trim();
  let replacement;
  if (/^[↑⬆]\s*FOR\b/.test(text)) {
    const end = text.search(/\n[^\n:]+:\s*(?:PASSIVE|ACTIVE|REACTION)\b/);
    if (end < 0) throw new Error(`Unrecognized upgrade replacement: ${context}`);
    replacement = cleanRuleText(text.slice(0, end).replace(/^[↑⬆]\s*/, ''));
    text = text.slice(end);
  }
  const source = normalizeText(text);
  if (!source) return [];
  const matches = [...source.matchAll(heading)];
  const prefix = source.slice(0, matches[0]?.index ?? source.length).trim();
  if (!matches.length || prefix) {
    throw new Error(`Unrecognized ability heading: ${context} / ${phase}: ${prefix}`);
  }

  const names = new Set();
  return matches.map((match, index) => {
    const name = abilityName(match[1]);
    if (names.has(name)) throw new Error(`Duplicate ability: ${context} / ${phase} / ${name}`);
    names.add(name);
    let effect = source.slice(match.index + match[0].length, matches[index + 1]?.index).trim();
    const cost = effect.match(/^(\d+|X)\s+(CP|PE|BM)\b/);
    if (match[2] !== 'PASSIVE' && !cost) {
      throw new Error(`Missing ability cost: ${context} / ${match[1]}`);
    }
    if (cost) effect = effect.slice(cost[0].length).trim();
    if (!effect) throw new Error(`Missing ability effect: ${context} / ${match[1]}`);
    return {
      name,
      type: 'Ability',
      attributes: {
        Phase: abilityName(phase),
        Type: abilityName(match[2]),
        ...(cost ? { Cost: `${cost[1]} ${cost[2]}` } : {}),
        ...(replacement && index === 0 ? { Upgrade: replacement } : {}),
        Effect: cleanRuleText(effect),
      },
    };
  });
}
