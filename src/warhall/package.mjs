import { manifestUrl } from '../channel.mjs';
import path from 'node:path';
import { readJson, writeJson } from '../io.mjs';
import { defaultDataDirectory } from '../paths.mjs';
import { baseDefinition, loadBaseMapping, resolveFootprint } from './bases.mjs';
import { profileChildren } from './presentation.mjs';
import { describeProfile, describeUnit } from './descriptions.mjs';
import { createReport, unitReport } from './report.mjs';
import { loadKeywordRules, linkKeywordRules, linkFactionRules } from './rule-links.mjs';
import { validateData } from './validate.mjs';
import { nativeTokens, factionIcons, builtinTokenNames } from '../tokens/package.mjs';
import { projectRoot } from '../paths.mjs';

const staticFiles = [
  'tokens.json',
  'terrains.json',
  'objectives.json',
  'deployments.json',
  'maps.json',
  'cards.json',
  'icons.json',
  'gameconfig.json',
  'version.json',
];
const unitCategories = ['Core', 'Elite', 'Support', 'Hero', 'Other'];

function recordId(faction, kind, sourceId) {
  return sourceId.startsWith('pdf_')
    ? `pdf_${faction}_${kind}_${sourceId.slice(4)}`
    : `nr_${faction}_${kind}_${sourceId}`;
}

function unitIds(unit, faction) {
  const marineIds = ['46b6-0bfa-70ea-ba86', 'pdf_marines'];
  if (faction === 'Terran' && marineIds.includes(unit.sourceId)) {
    return { unit: 'unit_marine', profile: 'prof_marine', statline: 'stat_marine' };
  }

  return {
    unit: recordId(faction, 'unit', unit.sourceId),
    profile: recordId(faction, 'profile', unit.sourceId),
    statline: recordId(faction, 'stat', unit.sourceId),
  };
}

function addProfileRecord(profile, faction, records) {
  const type = /Weapon$/.test(profile.type) ? 'Equipment' : 'Rule';
  const id = recordId(faction, type.toLowerCase(), profile.sourceId);
  const target = type === 'Equipment' ? records.equipment : records.rules;

  if (!target.has(id)) {
    target.set(id, {
      Id: id,
      Name: profile.name,
      Type: type,
      Description: describeProfile(profile),
    });
  }

  return id;
}

function addUnitRecords(unit, faction, records, bases, groups, report, baseMapping, glossary) {
  if (!/^\d+$/.test(unit.attributes.HP ?? '') || Number(unit.attributes.HP) <= 0) {
    throw new Error(`Missing/invalid HP: ${faction}/${unit.name}`);
  }

  const ids = unitIds(unit, faction);
  const footprint = resolveFootprint(unit, faction, baseMapping);
  const base = baseDefinition(footprint);
  const category = unit.categories.find(value => unitCategories.includes(value)) ?? 'Other';
  const references = unit.profiles.map(profile => addProfileRecord(profile, faction, records));

  const upgrades = unit.optionalUpgrades
    .flatMap(upgrade => upgrade.profiles)
    .filter(profile => profile.type === 'Ability' || profile.type?.startsWith('Rules ('))
    .map(profile => addProfileRecord({ ...profile, isUpgrade: true }, faction, records));
  records.contexts.push([...references, ...upgrades]);
  bases.set(base.Id, base);
  records.units.push({
    Id: ids.unit,
    Name: unit.name,
    Type: 'Unit',
    Description: describeUnit(unit),
    BasicProfileIds: [ids.profile],
    Children: [],
    DefaultFront: 1,
    Formation: 0,
  });
  records.profiles.push({
    Id: ids.profile,
    Name: unit.statlineName,
    Type: 'Profile',
    BaseId: base.Id,
    Children: profileChildren(unit, ids, references, records, glossary),
  });
  records.statlines.push({
    Id: ids.statline,
    Name: '',
    Type: 'Statline',
    Attributes: Object.fromEntries(
      Object.entries(unit.attributes).filter(([key]) => !/^(?:Supply|Supl)$/i.test(key)),
    ),
    Children: [],
  });

  (groups[category] ??= []).push(ids.unit);
  report.units.push(unitReport(unit, faction, ids, footprint));
}

async function initialData(template) {
  const data = {};
  for (const name of staticFiles) {
    try {
      data[name] = await readJson(path.join(template, name));
    } catch (error) {
      if (['maps.json', 'cards.json'].includes(name) && error.code === 'ENOENT') data[name] = [];
      else throw error;
    }
  }

  const tokenArtwork = await readJson(path.join(projectRoot, 'token-artwork.json'));
  data['cards.json'] = data['cards.json'].filter(card => !card.Id.startsWith('sc_token_'));
  data['tokens.json'] = [
    ...data['tokens.json'].filter(
      token =>
        !builtinTokenNames.includes(token.Id) &&
        !token.Id.startsWith('sc_token_') &&
        !token.Id.startsWith('Starcraft - Token - '),
    ),
    ...nativeTokens(),
  ];
  data['icons.json'] = [
    ...data['icons.json'].filter(icon => !icon.Id.startsWith('sc_icon_')),
    ...factionIcons(tokenArtwork.icons),
  ];

  data['gameconfig.json'].WoundsAttribute = 'HP';
  data['gameconfig.json'].ShowObjectiveSection = false;
  data['gameconfig.json'].ShowDeploymentSection = true;
  data['objectives.json'] = [];
  data['gameconfig.json'].ShowGroupHeader = false;
  data['gameconfig.json'].ShowStatlineHeader = false;
  data['bases.json'] = [];
  for (const name of ['rules', 'equipment', 'options']) data[`${name}.json`] = [];
  data['dummylist.json'] = '';

  return data;
}

function factionFiles(records) {
  return {
    units: records.units,
    profiles: records.profiles,
    statlines: records.statlines,
    equipment: [...records.equipment.values()],
    rules: [...records.rules.values()],
    options: [],
    modifiedprofile: [],
    modifiedunit: [],
  };
}

export async function buildWarhallPackage(source, template = defaultDataDirectory) {
  const data = await initialData(template);
  const baseMapping = await loadBaseMapping(source.metadata.mode);
  const report = createReport(source.metadata, baseMapping);
  const glossary = await loadKeywordRules();
  report.ruleCleanup = {
    keywordSource: glossary.source,
    keywordDefinitions: glossary.entries.length,
    links: linkKeywordRules(glossary),
  };
  data['rules.json'] = glossary.entries.map(entry => entry.record);
  const hierarchy = { Factions: {} };
  try {
    const previous = await readJson(path.join(template, 'hierarchy.json'));
    if (previous.Cards) hierarchy.Cards = previous.Cards;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (hierarchy.Cards) delete hierarchy.Cards.Tokens;
  const bases = new Map();

  for (const faction of source.factions) {
    if (!/^[\w -]+$/.test(faction.name) || hierarchy.Factions[faction.name]) {
      throw new Error(`Unsafe/duplicate faction: ${faction.name}`);
    }

    const records = {
      units: [],
      profiles: [],
      statlines: [],
      equipment: new Map(),
      rules: new Map(),
      contexts: [],
    };
    const groups = {};

    for (const unit of faction.units) {
      addUnitRecords(unit, faction.name, records, bases, groups, report, baseMapping, glossary);
    }

    report.ruleCleanup.links += linkFactionRules(records, glossary);
    for (const rule of records.rules.values()) {
      if (!/^Devastating Charge$/i.test(rule.Name)) continue;
      const effect = rule.Description.replace(/<[^>]*>/g, '');
      const impact = effect.match(/\bIMPACT\s*\([^)]+\)\s*\d\+/i);
      if (impact) rule.Name += ` ${impact[0]}`;
    }

    hierarchy.Factions[faction.name] = groups;
    for (const [name, values] of Object.entries(factionFiles(records))) {
      data[`${faction.name}/${name}.json`] = values.sort((a, b) => a.Id.localeCompare(b.Id, 'en'));
    }
  }

  data['bases.json'] = [...bases.values()].sort((a, b) => a.Width - b.Width || a.Length - b.Length);
  data['hierarchy.json'] = hierarchy;

  const previousManifest = await readJson(path.join(template, 'manifest.json'));
  data['manifest.json'] = { version: previousManifest.version, files: Object.keys(data).sort() };
  data['version.json'].version = previousManifest.version;
  data['version.json'].url = manifestUrl;
  report.counts = { factions: source.factions.length, units: report.units.length };

  validateData(data);
  return { data, report };
}

export async function writePackage(output, data, report) {
  const files = Object.keys(data).filter(name => name !== 'manifest.json');
  for (const name of files) await writeJson(path.join(output, name), data[name]);

  await writeJson(path.join(output, 'import-report.json'), report);
  await writeJson(path.join(output, 'manifest.json'), data['manifest.json']);
}
