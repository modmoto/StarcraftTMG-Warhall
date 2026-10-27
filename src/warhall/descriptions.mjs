import { describeFootprint } from './bases.mjs';

export function describeAttributes(attributes) {
  return Object.entries(attributes)
    .map(([name, value]) => `${name}: ${value}`)
    .join('\n');
}

export function describeProfile(profile) {
  if (profile.type) return `${profile.type}\n${describeAttributes(profile.attributes)}`;
  return profile.description;
}

function describeUpgrade(upgrade) {
  const details = upgrade.profiles
    .map(profile => {
      const effect = profile.type ? describeAttributes(profile.attributes) : profile.description;
      return `${profile.name}\n${effect}`;
    })
    .join('\n\n');

  return `OPTIONAL UPGRADE (not applied): ${upgrade.name}${details ? `\n${details}` : ''}`;
}

export function describeUnit(unit, footprint) {
  const source = unit.provenance
    ? `Official card values. Source: ${unit.provenance.url}, page ${unit.provenance.page}.`
    : `Default catalogue values. Source: ${unit.documentName} / ${unit.sourceId}.`;

  const paragraphs = [
    source,
    `${describeFootprint(footprint)} base. Place models and apply upgrades manually.`,
    `Categories: ${unit.categories.join(', ')}.`,
    ...unit.costLabels,
    ...unit.modelCounts.map(model => {
      const constraints = model.constraints.map(item => `${item.type} ${item.value}`).join(', ');
      return `${model.name} default model constraints: ${constraints}.`;
    }),
  ];

  if (unit.restricted) {
    paragraphs.push('Faction-restricted or summoned in the source; check eligibility manually.');
  }

  if (unit.modifierCount) {
    paragraphs.push(
      `Contains ${unit.modifierCount} catalogue modifiers; conditional changes are not applied automatically.`,
    );
  }

  if (unit.optionalUpgrades.length) {
    paragraphs.push(...unit.optionalUpgrades.map(describeUpgrade));
    const names = unit.optionalUpgrades.map(upgrade => upgrade.name).join(', ');
    paragraphs.push(`Available upgrade choices (manual): ${names}.`);
  }

  return paragraphs.join('\n\n');
}
