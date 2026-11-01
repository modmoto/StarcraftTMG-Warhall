import { displayPhase } from './presentation.mjs';
import { cleanRuleText } from '../text.mjs';

export function describeAttributes(attributes) {
  return Object.entries(attributes)
    .map(([name, value]) => `${name}: ${cleanRuleText(String(value))}`)
    .join('\n');
}

export function describeProfile(profile) {
  const phase = profile.attributes?.Phase ?? profile.type?.match(/^Rules \((.*)\)$/)?.[1];
  if (phase) {
    const oldCost = profile.attributes.Cost?.match(
      /^(Active|Passive|Pasive|Reaction|Reactive)(?:\s*\(([^)]+)\))?$/i,
    );
    const activation =
      profile.attributes.Type ??
      oldCost?.[1]?.replace(/^Reactive$/i, 'Reaction').replace(/^Pasive$/i, 'Passive');
    const cost = oldCost ? oldCost[2] : profile.attributes.Cost;
    return [
      `<b>Phase:</b> ${displayPhase(phase)}`,
      ...(activation ? [`<b>Type:</b> ${activation}`] : []),
      ...(cost ? [`<b>Cost:</b> ${cost}`] : []),
      ...(profile.isUpgrade ? ['<b>Upgrade ability</b>'] : []),
      ...(profile.attributes.Upgrade
        ? [`<b>Replaces:</b> ${profile.attributes.Upgrade.replace(/^FOR\s+/i, '')}`]
        : []),
      '',
      cleanRuleText(profile.attributes.Effect ?? profile.description),
    ].join('\n');
  }
  if (profile.type) return `${profile.type}\n${describeAttributes(profile.attributes)}`;
  return cleanRuleText(profile.description ?? '');
}

export function describeUnit(unit) {
  return [
    `Categories: ${unit.categories.join(', ')}`,
    ...(unit.attributes.Supply ? [`Models / Supply: ${unit.attributes.Supply}`] : []),
    ...unit.costLabels,
  ].join('\n');
}
