const phase = /^(Any|Movement|Assault|Combat|Scoring) Phase\s*$/gm;
const ability = /^([A-Z][A-Z !’'0-9(),/&–-]{2,}):\s*(ACTIVE|PASSIVE|REACTION|REACTIVE)?\s*/gm;
const cost = /^(CP|PE|BM):\s*([\dX]+)\s*$/gm;

export function formatCard(card, overrides = {}) {
  const result = structuredClone(card);
  const name = card.Name.replace(/([a-z])'S\b/g, "$1's");
  let text = card.Description.trim();
  if (text.toLowerCase().startsWith(card.Name.toLowerCase()))
    text = text.slice(card.Name.length).trim();
  result.Name = name;
  result.UIConfig.Color2 = '';
  if (!card.Id.includes('_tactics_')) {
    result.Description = text;
    return result;
  }
  const costs = [...new Set([...text.matchAll(cost)].map(match => `${match[1]}: ${match[2]}`))];
  text = text.replace(cost, '').trim();
  if (costs.length) result.Name += ` (${costs.join(', ')})`;
  const phases = [...text.matchAll(phase)];
  const abilities = [...text.matchAll(ability)];
  if (!abilities.length) throw new Error(`No tactic abilities: ${card.Id}`);
  result.Description = abilities
    .map((match, index) => {
      const end = abilities[index + 1]?.index ?? text.length;
      const nextPhase = phases.find(p => p.index > match.index && p.index < end);
      const effect = text
        .slice(match.index + match[0].length, nextPhase?.index ?? end)
        .replace(/\s+/g, ' ')
        .trim();
      const currentPhase = phases
        .filter(p => p.index < match.index)
        .at(-1)?.[0]
        .trim();
      const activation = match[2]?.toLowerCase() ?? overrides[card.Id]?.[match[1]];
      if (!currentPhase || !activation || !effect)
        throw new Error(`Incomplete tactic heading: ${card.Id}/${match[1]}`);
      return `<b>${match[1]} (${currentPhase}, ${activation})</b>\n${effect}`;
    })
    .join('\n\n');
  return result;
}
