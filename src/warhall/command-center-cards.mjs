import { databaseText } from '../sources/command-center.mjs';
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const slug = value =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

export function mergeCommandCenterCards(data, hierarchy, cards) {
  hierarchy.Cards ??= {};
  for (const source of cards) {
    const prefix = `sc_card_${source.faction.toLowerCase()}_tactics_`;
    const sourceCardId = prefix + slug(source.sourceId);
    const matches = data['cards.json'].filter(
      card =>
        card.Id === sourceCardId ||
        (card.Id.startsWith(prefix) && normalize(card.Name) === normalize(source.name)),
    );
    if (matches.length > 1) throw new Error(`Ambiguous card: ${source.name}`);
    const card = matches[0] ?? {
      Id: sourceCardId,
      Name: source.name,
      Type: 'Card',
      UIConfig: {
        Width: 63,
        Length: 88,
        IsRound: false,
        ShowInitials: false,
        Border: false,
        Color: '#FFFFFF',
        Color2: '',
      },
    };
    const resource = { Terran: 'CP', Protoss: 'PE', Zerg: 'BM' }[source.faction];
    card.Name = source.name;
    if (
      !Array.isArray(source.boosts) ||
      source.boosts.some(
        boost => typeof boost.description !== 'string' || !boost.description.trim(),
      )
    )
      throw new Error(`Incomplete card: ${source.name}`);
    card.Description = [
      `${resource}: ${source.resource} • Minerals: ${source.cost}`,
      ...source.boosts.map(
        boost => `<b>${databaseText(boost.name)}</b>\n${databaseText(boost.description)}`,
      ),
    ].join('\n\n');
    if (!matches.length) data['cards.json'].push(card);
    const group = `${source.faction} Tactic Cards`;
    hierarchy.Cards[group] ??= [];
    if (!hierarchy.Cards[group].includes(card.Id)) hierarchy.Cards[group].push(card.Id);
  }
}
