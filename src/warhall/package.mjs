import { manifestUrl } from '../urls.mjs';
import path from 'node:path';
import { readJson, writeJson } from '../io.mjs';
import { defaultDataDirectory } from '../paths.mjs';
import { baseDefinition, loadBaseMapping, resolveFootprint } from './bases.mjs';
import { profileChildren } from './presentation.mjs';
import { describeProfile, describeUnit } from './descriptions.mjs';
import { createReport, unitReport } from './report.mjs';
import { loadKeywordRules, linkKeywordRules, linkFactionRules } from './rule-links.mjs';
import { loadRulebookRules } from './rulebook.mjs';
import { consolidateRules, linkRuleIndex } from './rule-index.mjs';
import { addUpgradeOptions } from './upgrades.mjs';
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

  const upgradeProfiles = unit.optionalUpgrades
    .flatMap(upgrade => upgrade.profiles)
    .filter(
      profile =>
        profile.type === 'Ability' ||
        profile.type?.startsWith('Rules (') ||
        /Weapon$/.test(profile.type),
    );
  const upgrades = upgradeProfiles.map(profile =>
    addProfileRecord({ ...profile, isUpgrade: true }, faction, records),
  );
  records.contexts.push([...references, ...upgrades]);
  for (const id of [...references, ...upgrades]) {
    if (!records.owners.has(id)) records.owners.set(id, new Set());
    records.owners.get(id).add(unit.name);
  }
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
  // Display the available conditional value alongside the base value.
  // Options that replace whole rows must retain the same annotation.
  const resonating = upgradeProfiles.some(profile =>
    /Glaive Cannon gains BUFF RoA \(1\)/i.test(profile.attributes.Effect ?? ''),
  );
  if (resonating) {
    const weapon = unit.profiles.find(profile => profile.name.toUpperCase() === 'GLAIVE CANNON');
    if (weapon) {
      weapon.attributes = { ...weapon.attributes, RoA: '1' };
      weapon.conditionalRoa = 1;
    }
  }
  const conditionalArmour = upgradeProfiles.some(profile =>
    /Armour characteristic is increased by 1/.test(profile.attributes.Effect ?? ''),
  );
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
      Object.entries(unit.attributes)
        .filter(([key]) => !/^(?:Supply|Supl)$/i.test(key))
        .map(([key, value]) => [
          key,
          key === 'Arm' && conditionalArmour && /^\d+\+$/.test(value)
            ? `${value} <color=#65c879>(${Number(value.slice(0, -1)) - 1}+)</color>`
            : value,
        ]),
    ),
    Children: [],
  });
  addUpgradeOptions(unit, ids, upgradeProfiles, upgrades, references, records, glossary);

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
  for (const card of data['cards.json']) {
    card.Description = card.Description.replace(
      /(?:<u>)?<link="(?:pdf|nr)_[^"]+">([\s\S]*?)<\/link>(?:<\/u>)?/g,
      '$1',
    );
  }
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
  data['gameconfig.json'].DefaultCardConfig.Color2 = '';
  data['gameconfig.json'].Formations = [{ Index: 0, Type: 'Cloud' }];
  data['gameconfig.json'].DefaultFormation = 'Cloud';
  data['gameconfig.json'].MaxCloudSeparation = 4;
  data['gameconfig.json'].ShownButtons = (data['gameconfig.json'].ShownButtons ?? []).filter(
    name => name !== 'Reform' && name !== 'ButtonReform',
  );
  data['gameconfig.json'].HiddenButtons = [
    ...new Set([...(data['gameconfig.json'].HiddenButtons ?? []), 'Reform']),
  ];
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
    modifiedprofile: records.modifiedprofile,
    modifiedunit: records.modifiedunit,
  };
}

export async function buildWarhallPackage(source, template = defaultDataDirectory) {
  const data = await initialData(template);
  const baseMapping = await loadBaseMapping(source.metadata.mode);
  const report = createReport(source.metadata, baseMapping);
  const glossary = await loadKeywordRules();
  const book = await loadRulebookRules();
  book.entries.find(rule => rule.Id === 'rule_chapter_11').Description +=
    '\n\n' +
    glossary.entries
      .map(entry => `<link="${entry.record.Id}">${entry.record.Name}</link>`)
      .join(', ');
  const owners = new Map();
  const options = new Map();
  report.ruleCleanup = {
    keywordSource: glossary.source,
    keywordDefinitions: glossary.entries.length,
    links: linkKeywordRules(glossary),
  };
  data['rules.json'] = [...glossary.entries.map(entry => entry.record), ...book.entries];
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
      owners,
      options,
      modifiedprofile: [],
      modifiedunit: [],
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
      const key = item => item.Id ?? `${item.UnitId}/${item.ProfileId ?? ''}/${item.OptionId}`;
      data[`${faction.name}/${name}.json`] = values.sort((a, b) =>
        key(a).localeCompare(key(b), 'en'),
      );
    }
  }

  data['bases.json'] = [...bases.values()].sort((a, b) => a.Width - b.Width || a.Length - b.Length);
  data['hierarchy.json'] = hierarchy;
  data['options.json'] = [...options.values()].sort((a, b) => a.Id.localeCompare(b.Id, 'en'));
  report.ruleCleanup.rulebookSource = book.source;
  report.ruleCleanup.chapters = book.entries.length;
  report.ruleCleanup.duplicatesRemoved = consolidateRules(data, owners);
  linkRuleIndex(data, glossary, book);
  report.ruleCleanup.links = Object.values(data)
    .filter(Array.isArray)
    .flat()
    .reduce(
      (total, record) => total + [...(record?.Description ?? '').matchAll(/<link=/g)].length,
      0,
    );
  for (const [file, records] of Object.entries(data)) {
    if (!/(?:^|\/)rules\.json$/.test(file)) continue;
    for (const rule of records) {
      if (rule.Name && rule.Description?.includes('<b>Upgrade ability</b>'))
        rule.Name = `<color=#2596be>${rule.Name}</color>`;
    }
  }

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
