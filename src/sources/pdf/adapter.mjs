function sourceId(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `pdf_${slug}`;
}

function normalizeProfile(profile, id) {
  return {
    sourceId: id,
    name: profile.name,
    type: profile.type,
    attributes: profile.attributes,
    description: '',
  };
}

function normalizeUnit(card, id) {
  const optionalUpgrades = card.optional.length
    ? [
        {
          name: 'Official upgrade card',
          profiles: card.optional.map((profile, index) =>
            normalizeProfile(
              profile,
              profile.type === 'Ability'
                ? `${id}_upgrade_${sourceId(`${profile.attributes.Phase}_${profile.name}`).slice(4)}`
                : `${id}_upgrade_${profile.sourceIndex ?? index}`,
            ),
          ),
        },
      ]
    : [];

  return {
    sourceId: id,
    documentName: card.provenance.file,
    name: card.name,
    statlineId: `${id}_stats`,
    statlineName: card.name,
    attributes: card.attributes,
    categories: card.categories,
    profiles: card.profiles.map((profile, index) =>
      normalizeProfile(
        profile,
        profile.type === 'Ability'
          ? `${id}_${sourceId(`${profile.attributes.Phase}_${profile.name}`).slice(4)}`
          : `${id}_default_${profile.sourceIndex ?? index}`,
      ),
    ),
    modelCounts: [],
    costLabels: [],
    optionalUpgrades,
    modifierCount: 0,
    restricted: false,
    provenance: card.provenance,
  };
}

export function normalizeCards(cards, metadata = {}) {
  const factions = ['Protoss', 'Terran', 'Zerg'].map(name => {
    const factionCards = cards.filter(card => card.faction === name);
    if (!factionCards.length) throw new Error(`No parsed unit cards for ${name}`);

    const seen = new Set();
    const units = factionCards.map(card => {
      const id = sourceId(card.name);
      if (seen.has(id)) {
        throw new Error(
          `Duplicate official unit card: ${name}/${card.name}; resolve conflicting releases explicitly`,
        );
      }

      seen.add(id);
      return normalizeUnit(card, id);
    });

    return { name, units };
  });

  return { factions, metadata: { ...metadata, mode: 'pdf' } };
}
