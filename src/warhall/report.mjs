import { upgradeDisplay } from './upgrade-effects.mjs';

export function createReport(metadata, baseMapping) {
  const pdfMode = metadata.mode === 'pdf';
  const limitations = [
    pdfMode
      ? 'Base footprints come from the printed cards; flight stands use the user-specified 100 mm round footprint.'
      : 'Base footprints use the hard-coded mapping; unset units fall back to the hero/default round diameter.',
    'Manual placement only; army-list import and roster legality are not implemented.',
    'Default profiles remain unchanged until an upgrade is selected. Selected passive HP, weapon and ability changes use WDS option mappings and blue differences. Conditional bonuses are green bracketed alternatives; paid and reactive abilities require activation.',
    'All units are exposed, including faction-restricted and summoned units; eligibility is manual.',
    'Shields are displayed separately from HP; shield loss/healing is manual.',
    'Source completeness against current official releases is not established.',
    'Warhall client compatibility/loading has not been verified.',
  ];

  const report = {
    sourceMode: metadata.mode,
    source: metadata.source,
    sources: metadata.sources,
    ...(pdfMode
      ? {
          baseSizePolicy:
            'Printed PDF footprint; FLIGHT STAND is 100 mm round by user choice. No base-size map is read.',
        }
      : { baseSizeMapping: baseMapping }),
    limitations,
    warnings: [...(metadata.warnings ?? [])],
    units: [],
  };

  if (pdfMode) {
    report.limitations = limitations.filter(
      value => !value.startsWith('Default catalogue') && !value.startsWith('Source completeness'),
    );
    report.limitations.push(
      'Official unit cards are parsed. Selected passive HP, weapon and ability changes are supported. Conditional bonuses are informational; cost spending, condition detection and FAQ/errata reconciliation remain manual.',
      'Tactical, mission and deployment pages are reported separately rather than imported as miniatures.',
    );
    report.cardCoverage = metadata.coverage;
  }

  return report;
}

export function unitReport(unit, faction, ids, footprint) {
  return {
    faction,
    name: unit.name,
    sourceEntryId: unit.sourceId,
    sourceStatId: unit.statlineId,
    unitId: ids.unit,
    profileId: ids.profile,
    statId: ids.statline,
    ...(unit.provenance ? { card: unit.provenance } : {}),
    baseDiameterMm: footprint.shape === 'round' ? footprint.widthMm : null,
    baseShape: footprint.shape,
    baseWidthMm: footprint.widthMm,
    baseLengthMm: footprint.lengthMm,
    baseSizeSource: footprint.source,
    modelCounts: unit.modelCounts,
    optionalUpgrades: unit.optionalUpgrades.map(upgrade => upgrade.name),
    modifierCount: unit.modifierCount,
    upgradeProfiles: unit.optionalUpgrades.flatMap(upgrade => upgrade.profiles),
    upgradeDisplay: unit.optionalUpgrades
      .flatMap(upgrade => upgrade.profiles)
      .map(profile => ({
        name: profile.name,
        display: upgradeDisplay(unit, profile),
      })),
  };
}
