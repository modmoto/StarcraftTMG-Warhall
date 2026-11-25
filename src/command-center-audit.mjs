import {
  normalizeCommandUnit,
  validateSnapshot,
  commandCenterUrl,
  sourceFingerprint,
} from './sources/command-center.mjs';
import { upgradeDisplay } from './warhall/upgrade-effects.mjs';

const plain = value =>
  String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const normalize = value =>
  plain(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function auditCommandCenter(raw, mapping, previous, catalogue = { entries: [] }) {
  validateSnapshot(raw);
  const result = {
    source: commandCenterUrl,
    fingerprint: sourceFingerprint(raw),
    counts: { units: raw.army_units.length, cards: raw.tactical_cards.length },
    newUnits: [],
    existingUnits: [],
    missingBases: [],
    missingModels: [],
    blue: [],
    green: [],
    ruleOnly: [],
    reserveReview: [],
    tokenReview: [],
    conflicts: [],
    generalRules: 'Preserved; rules_sections is never downloaded.',
  };
  const keys = new Set(raw.army_units.map(unit => `${unit.faction}/${unit.sourceId}`));
  result.missingFromDatabase = Object.keys(mapping).filter(key => !keys.has(key));
  for (const unit of raw.army_units) {
    const key = `${unit.faction}/${unit.sourceId}`;
    const identity = mapping[key];
    if (!identity?.base) result.missingBases.push({ key, name: unit.name });
    const old = previous.units.find(
      record => record.faction === unit.faction && record.sourceEntryId === identity?.sourceId,
    );
    (old ? result.existingUnits : result.newUnits).push({ key, name: identity?.name ?? unit.name });
    const profileId =
      old?.profileId ?? (identity && `pdf_${unit.faction}_profile_${identity.sourceId.slice(4)}`);
    if (!catalogue.entries.some(entry => entry.profileId === profileId))
      result.missingModels.push({ key, name: unit.name, profileId });
    if (!identity) {
      result.conflicts.push({
        key,
        reason: 'Add an explicit stable identity to command-center-mapping.json.',
      });
      continue;
    }
    let normalized;
    try {
      normalized = normalizeCommandUnit(unit, mapping);
    } catch (error) {
      result.conflicts.push({ key, reason: error.message });
      continue;
    }
    for (const profile of normalized.optionalUpgrades.flatMap(group => group.profiles)) {
      const current = old?.upgradeProfiles.find(
        candidate =>
          normalize(candidate.name) === normalize(profile.name) && candidate.type === profile.type,
      );
      if (current && JSON.stringify(current.attributes) === JSON.stringify(profile.attributes))
        continue;
      const display = upgradeDisplay(normalized, profile);
      const proposal = {
        unit: normalized.name,
        faction: unit.faction,
        option: profile.name,
        sourceWording: profile.attributes.Effect ?? profile.attributes,
        affected: profile.type,
        current: current?.attributes ?? null,
        proposed: profile.attributes,
        display,
        click: `pdf_${unit.faction}_${/Weapon$/.test(profile.type) ? 'equipment' : 'rule'}_${profile.sourceId.slice(4)}${/Weapon$/.test(profile.type) ? '_choice' : ''}`,
      };
      (display.some(text => /conditional|green/i.test(text))
        ? result.green
        : display.some(text => /blue|replacement|specialist/i.test(text))
          ? result.blue
          : result.ruleOnly
      ).push(proposal);
    }
    for (const ability of unit.upgrades) {
      if (
        /\b(?:SUMMON|SPAWN|SET|replace|template|Faction Indicator|token)\b/i.test(
          ability.description,
        )
      )
        result.reserveReview.push({
          unit: normalized.name,
          option: ability.name,
          wording: ability.description,
        });
      if (/\b(?:token|status|template)\b/i.test(ability.description))
        result.tokenReview.push({
          unit: normalized.name,
          option: ability.name,
          wording: ability.description,
        });
    }
  }
  for (const card of raw.tactical_cards)
    for (const boost of card.boosts ?? []) {
      if (
        /\b(?:SUMMON|SPAWN|SET|replace|template|Faction Indicator|token)\b/i.test(boost.description)
      )
        result.reserveReview.push({
          card: card.name,
          option: boost.name,
          wording: boost.description,
        });
    }
  return result;
}
