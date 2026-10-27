import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { sha256 } from '../io.mjs';

const sourceUrl = 'https://github.com/modmoto/StarcraftTMG-NR';
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: false,
  trimValues: false,
});

function attribute(node, name) {
  return String(node?.[`@${name}`] ?? '');
}

function text(node) {
  return typeof node === 'string' ? node : String(node?.['#text'] ?? '');
}

function children(node, container, tag) {
  const value = node?.[container]?.[tag];
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function visitNodes(node, visit) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const child of node) visitNodes(child, visit);
    return;
  }

  visit(node);

  for (const [key, child] of Object.entries(node)) {
    if (!key.startsWith('@')) visitNodes(child, visit);
  }
}

function indexNodes(root) {
  const nodes = new Map();

  visitNodes(root, node => {
    const id = attribute(node, 'id');
    if (!id) return;
    if (nodes.has(id)) throw new Error(`Duplicate source ID: ${id}`);
    nodes.set(id, node);
  });

  return nodes;
}

function profileAttributes(profile) {
  return Object.fromEntries(
    children(profile, 'characteristics', 'characteristic').map(characteristic => [
      attribute(characteristic, 'name'),
      text(characteristic).trim(),
    ]),
  );
}

function normalizeProfile(profile) {
  return {
    sourceId: attribute(profile, 'id'),
    name: attribute(profile, 'name'),
    type: attribute(profile, 'typeName'),
    attributes: profileAttributes(profile),
    description: text(profile.description).trim(),
  };
}

function linkedProfiles(entry, resolve) {
  const links = children(entry, 'infoLinks', 'infoLink')
    .filter(link => attribute(link, 'hidden') !== 'true')
    .map(link => resolve(attribute(link, 'targetId')));

  return [...children(entry, 'profiles', 'profile'), ...children(entry, 'rules', 'rule'), ...links];
}

function modelCounts(entry) {
  return children(entry, 'selectionEntries', 'selectionEntry')
    .filter(child => attribute(child, 'type') === 'model')
    .map(model => ({
      name: attribute(model, 'name'),
      constraints: children(model, 'constraints', 'constraint').map(constraint => ({
        type: attribute(constraint, 'type'),
        value: attribute(constraint, 'value'),
      })),
    }));
}

function normalizeUnit(entry, documentName, resolve) {
  const linked = linkedProfiles(entry, resolve);
  const statlines = linked.filter(profile => attribute(profile, 'typeName') === 'Unit');

  if (!statlines.length) return null;
  if (statlines.length !== 1) {
    throw new Error(`Expected one unit statline: ${attribute(entry, 'name')}`);
  }

  const statline = statlines[0];
  const optionalUpgrades = [];
  let modifierCount = 0;

  visitNodes(entry, node => {
    if (attribute(node, 'field') && attribute(node, 'type') && attribute(node, 'value')) {
      modifierCount++;
    }

    if (node !== entry && attribute(node, 'type') === 'upgrade') {
      optionalUpgrades.push({
        name: attribute(node, 'name'),
        profiles: linkedProfiles(node, resolve).map(normalizeProfile),
      });
    }
  });

  const costs = children(entry, 'costs', 'cost')
    .filter(cost => ['Minerals', 'Gas'].includes(attribute(cost, 'name')))
    .map(cost => `${attribute(cost, 'name')}: ${attribute(cost, 'value')}`);

  return {
    sourceId: attribute(entry, 'id'),
    documentName,
    name: attribute(entry, 'name'),
    statlineId: attribute(statline, 'id'),
    statlineName: attribute(statline, 'name'),
    attributes: profileAttributes(statline),
    categories: children(entry, 'categoryLinks', 'categoryLink').map(category =>
      attribute(category, 'name').trim(),
    ),
    profiles: linked.filter(profile => profile !== statline).map(normalizeProfile),
    modelCounts: modelCounts(entry),
    costLabels: [...new Set(costs)],
    optionalUpgrades,
    modifierCount,
    restricted: attribute(entry, 'hidden') === 'true',
  };
}

async function readDocument(directory, name) {
  const raw = await readFile(path.join(directory, name), 'utf8');
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) {
    throw new Error(`DTD/entities are not supported: ${name}`);
  }

  const validation = XMLValidator.validate(raw);
  if (validation !== true) {
    throw new Error(`Invalid XML in ${name}: ${validation.err.msg}`);
  }

  const parsed = parser.parse(raw);
  const root = parsed.catalogue ?? parsed.gameSystem;
  if (!root) throw new Error(`Missing catalogue/gameSystem root: ${name}`);

  return { name, root, index: indexNodes(root), hash: sha256(raw) };
}

function normalizeFaction(document, system, warnings) {
  const name = attribute(document.root, 'name');
  if (attribute(document.root, 'gameSystemId') !== attribute(system.root, 'id')) {
    throw new Error(`Wrong gameSystemId in ${document.name}`);
  }

  const expectedRevision = attribute(document.root, 'gameSystemRevision');
  const actualRevision = attribute(system.root, 'revision');
  if (expectedRevision !== actualRevision) {
    warnings.push(
      `${document.name} requests game system revision ${expectedRevision}; provided revision is ${actualRevision}.`,
    );
  }

  function resolve(id) {
    const node = document.index.get(id) ?? system.index.get(id);
    if (!node) throw new Error(`Unresolved reference ${id} in ${document.name}`);
    return node;
  }

  visitNodes(document.root, node => {
    const targetId = attribute(node, 'targetId');
    if (targetId) resolve(targetId);
  });

  const units = children(document.root, 'selectionEntries', 'selectionEntry')
    .map(entry => normalizeUnit(entry, document.name, resolve))
    .filter(Boolean);

  if (!units.length) throw new Error(`No units found in ${document.name}`);
  return { name, units };
}

export async function loadNewRecruit(directory) {
  const names = (await readdir(directory)).filter(name => /\.(cat|gst)$/.test(name)).sort();
  const documents = [];

  for (const name of names) documents.push(await readDocument(directory, name));

  const systems = documents.filter(document => document.name.endsWith('.gst'));
  if (systems.length !== 1) throw new Error('Expected exactly one .gst game system');

  const catalogues = documents.filter(document => document.name.endsWith('.cat'));
  if (!catalogues.length) throw new Error('No .cat catalogues found');

  const warnings = [];
  const factions = catalogues.map(document => normalizeFaction(document, systems[0], warnings));

  return {
    factions,
    metadata: {
      mode: 'new-recruit',
      source: sourceUrl,
      sources: documents.map(document => ({
        file: document.name,
        sha256: document.hash,
        revision: attribute(document.root, 'revision'),
      })),
      warnings,
    },
  };
}
