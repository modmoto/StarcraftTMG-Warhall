import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { loadPdf } from '../src/sources/pdf/index.mjs';
import { loadNewRecruit } from '../src/sources/new-recruit.mjs';
import { defaultNewRecruitDirectory, projectRoot } from '../src/paths.mjs';
import { readJson, writeJson, sha256 } from '../src/io.mjs';
import { cleanRuleText } from '../src/text.mjs';

const directory = path.resolve(process.argv[2] ?? defaultNewRecruitDirectory);
const official = await loadPdf({ offline: true });
const catalogue = await loadNewRecruit(directory);
const glossary = await readJson(path.join(projectRoot, 'rule-keywords.json'));
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: false,
});
const keywordRules = [];
const referenceCounts = new Map();
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) visit(child);
    return;
  }
  if (node['@targetId'])
    referenceCounts.set(node['@targetId'], (referenceCounts.get(node['@targetId']) ?? 0) + 1);
  if (node.description && node['@name'] && node['@id'])
    keywordRules.push({ id: node['@id'], name: node['@name'], alias: node.alias });
  for (const child of Object.values(node)) visit(child);
}
const files = [];
for (const file of (await readdir(directory)).filter(name => /\.(cat|gst)$/.test(name)).sort()) {
  const raw = await readFile(path.join(directory, file), 'utf8');
  visit(parser.parse(raw));
  files.push({ file, sha256: sha256(raw) });
}
const key = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const canonical = value =>
  cleanRuleText(value).toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
const units = [];
for (const faction of official.factions) {
  const nrFaction = catalogue.factions.find(candidate => candidate.name === faction.name);
  for (const unit of faction.units) {
    const nrUnit = nrFaction?.units.find(candidate => key(candidate.name) === key(unit.name));
    const abilities = unit.profiles
      .filter(profile => profile.type === 'Ability')
      .map(profile => {
        const match = nrUnit?.profiles.find(candidate => key(candidate.name) === key(profile.name));
        const nestedKeywords = glossary.rules.filter(rule =>
          new RegExp(`\\b${rule.aliases[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
            profile.attributes.Effect,
          ),
        );
        return {
          name: profile.name,
          phase: profile.attributes.Phase,
          officialEffect: profile.attributes.Effect,
          officialType: profile.attributes.Type,
          officialCost: profile.attributes.Cost ?? null,
          costComparison: !match
            ? 'not-in-catalogue'
            : key(match.attributes.Cost ?? '') ===
                key(`${profile.attributes.Type}${profile.attributes.Cost ?? ''}`)
              ? 'matches'
              : 'differs',
          phaseComparison: !match
            ? 'not-in-catalogue'
            : match.type === `Rules (${profile.attributes.Phase})`
              ? 'matches'
              : 'differs',
          ...(match
            ? {
                catalogueId: match.sourceId,
                catalogueEffect: match.attributes.Effect ?? match.description,
                catalogueCost: match.attributes.Cost,
              }
            : {}),
          comparison: !match
            ? 'not-in-catalogue'
            : canonical(profile.attributes.Effect) ===
                canonical(match.attributes.Effect ?? match.description)
              ? 'wording-matches'
              : 'wording-differs',
          nestedKeywords: nestedKeywords.map(rule => {
            const nrKeyword = keywordRules.find(
              candidate =>
                key(candidate.alias ?? candidate.name.replace(/\s*[\[(].*$/, '')) ===
                key(rule.aliases[0]),
            );
            return {
              name: rule.displayName,
              officialPage: rule.page,
              ...(nrKeyword
                ? {
                    catalogueId: nrKeyword.id,
                    catalogueInfoLinks: referenceCounts.get(nrKeyword.id) ?? 0,
                  }
                : {}),
            };
          }),
        };
      });
    units.push({ faction: faction.name, name: unit.name, catalogueUnit: !!nrUnit, abilities });
  }
}
const comparisons = units.flatMap(unit => unit.abilities);
await writeJson(path.join(projectRoot, 'rules-reference-report.json'), {
  policy:
    'Official current PDFs own gameplay wording. Catalogue IDs/references and wording differences are comparison evidence only.',
  officialSources: official.metadata.sources,
  keywordSource: glossary.source,
  catalogueSource: catalogue.metadata.source,
  catalogueSources: files,
  catalogueWarnings: catalogue.metadata.warnings,
  counts: {
    units: units.length,
    catalogueUnits: units.filter(unit => unit.catalogueUnit).length,
    abilities: comparisons.length,
    wordingMatches: comparisons.filter(rule => rule.comparison === 'wording-matches').length,
    wordingDifferences: comparisons.filter(rule => rule.comparison === 'wording-differs').length,
    costDifferences: comparisons.filter(rule => rule.costComparison === 'differs').length,
    phaseDifferences: comparisons.filter(rule => rule.phaseComparison === 'differs').length,
    missingInCatalogue: comparisons.filter(rule => rule.comparison === 'not-in-catalogue').length,
  },
  units,
});
console.log('Wrote rules-reference-report.json; no catalogue values applied.');
