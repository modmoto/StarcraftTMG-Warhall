import assert from 'node:assert/strict';
import path from 'node:path';
import { readJson, sha256 } from '../io.mjs';
import { projectRoot } from '../paths.mjs';

// Same public endpoint as StarcraftTMG-NR/warhall-import-script (92fa314).
// Deliberately never request rules_sections: the maintained rulebook stays local.
export const commandCenterUrl =
  'https://firestore.googleapis.com/v1/projects/starcrafttmgbeta/databases/starcrafttmgbeta/documents';
export const commandCenterSnapshot = path.join(projectRoot, 'sources/command-center.json');
export function sourceFingerprint(source) {
  const canonical = value =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map(key => [key, canonical(value[key])]),
          )
        : value;
  return sha256(JSON.stringify(canonical(source)));
}
export const databaseText = value =>
  String(value)
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, '&');
const normalize = value =>
  value
    .toLowerCase()
    .replace(/riffle/g, 'rifle')
    .replace(/[^a-z0-9]/g, '');
const slug = value =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
const factions = ['Protoss', 'Terran', 'Zerg'];

export function decodeValue(value) {
  if ('mapValue' in value) return decodeFields(value.mapValue.fields);
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ('integerValue' in value) {
    const number = Number(value.integerValue);
    assert.ok(Number.isSafeInteger(number), 'Unsafe Firestore integer');
    return number;
  }
  const [type, data] = Object.entries(value)[0] ?? [];
  assert.ok(
    ['stringValue', 'doubleValue', 'booleanValue', 'timestampValue', 'nullValue'].includes(type),
    `Unsupported Firestore type: ${type}`,
  );
  return data;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
  );
}

export async function downloadCommandCenter(fetcher = fetch) {
  const source = {};
  for (const collection of ['army_units', 'tactical_cards']) {
    const records = [];
    const tokens = new Set();
    let token;
    do {
      const url = new URL(`${commandCenterUrl}/${collection}`);
      url.searchParams.set('pageSize', '100');
      if (token) url.searchParams.set('pageToken', token);
      const response = await fetcher(url, { signal: AbortSignal.timeout(60000) });
      assert.ok(response.ok, `Command Center ${collection}: HTTP ${response.status}`);
      const page = await response.json();
      assert.ok(Array.isArray(page.documents), `Missing ${collection} documents`);
      for (const document of page.documents) {
        const fields = decodeFields(document.fields);
        records.push({ ...fields, sourceId: document.name.split('/').at(-1) });
      }
      token = page.nextPageToken;
      if (token) {
        assert.ok(!tokens.has(token), 'Repeated Firestore page token');
        tokens.add(token);
      }
    } while (token);
    source[collection] = records.sort((a, b) => a.sourceId.localeCompare(b.sourceId, 'en'));
  }
  validateSnapshot(source);
  return source;
}

export function validateSnapshot(source) {
  for (const collection of ['army_units', 'tactical_cards']) {
    assert.ok(
      Array.isArray(source[collection]) && source[collection].length,
      `Empty ${collection}`,
    );
    const ids = new Set();
    for (const record of source[collection]) {
      assert.ok(factions.includes(record.faction), `Unknown faction: ${record.faction}`);
      assert.ok(
        typeof record.sourceId === 'string' &&
          record.sourceId &&
          typeof record.name === 'string' &&
          record.name.trim(),
        `Invalid ${collection} identity`,
      );
      assert.ok(!ids.has(record.sourceId), `Duplicate ${collection} ID: ${record.sourceId}`);
      ids.add(record.sourceId);
    }
    for (const faction of factions)
      assert.ok(
        source[collection].some(record => record.faction === faction),
        `Missing ${collection}/${faction}`,
      );
  }
}

export function parseWeapon(ability) {
  const description = databaseText(ability.description);
  const match =
    /^RANGE:\s*(.*?)\s*\|\s*TARGET:\s*(.*?)\s*\|\s*RoA:\s*(.*?)\s*\|\s*HIT:\s*(.*?)\s*\|\s*DMG:\s*(.*?)\s*\r?\nSURGE:\s*([^\r\n(]*?)(?:\s+\(([^\r\n]*)\))?[ \t]*(?:\r?\n([\s\S]*))?$/i.exec(
      description,
    );
  if (!match) {
    assert.ok(!/^RANGE:/i.test(ability.description.trim()), `Unreadable weapon: ${ability.name}`);
    return null;
  }
  const attributes = Object.fromEntries(
    ['Rng', 'Tgt', 'RoA', 'Hit', 'Dmg', 'Surge', 'S.Die', 'Keyword'].map((key, index) => [
      key,
      (match[index + 1] ?? '-').trim() || '-',
    ]),
  );
  attributes.Rng = attributes.Rng.replace(/''|["”]/g, '');
  if (attributes.Tgt.toLowerCase() === 'flying') attributes.Tgt = 'Air';
  const phase = ability.phase === 'Cobmbat Phase' ? 'Combat Phase' : ability.phase;
  assert.ok(
    ['Assault Phase', 'Combat Phase'].includes(phase),
    `Invalid weapon phase: ${ability.name}`,
  );
  return { type: phase === 'Combat Phase' ? 'Combat Weapon' : 'Assault Weapon', attributes };
}

export function normalizeCommandUnit(unit, mapping) {
  const identity = mapping[`${unit.faction}/${unit.sourceId}`];
  assert.ok(identity, `Missing stable identity: ${unit.faction}/${unit.sourceId}`);
  assert.ok(unit.stats && Array.isArray(unit.upgrades), `Incomplete unit: ${unit.name}`);
  for (const [label, squad] of [
    ['small', unit.small],
    ['large', unit.large],
  ]) {
    assert.ok(
      squad &&
        ['models', 'cost', 'supply'].every(
          field => Number.isSafeInteger(squad[field]) && squad[field] >= 0,
        ),
      `Invalid ${label} squad: ${unit.name}`,
    );
  }
  const attributes = Object.fromEntries(
    Object.entries({
      Spd: 'speed',
      Arm: 'armor',
      Eva: 'evade',
      HP: 'hp',
      Size: 'size',
      Shd: 'shield',
    }).map(([key, field]) => {
      const value = String(unit.stats[field] ?? '');
      assert.match(value, /^(?:-|\d+(?:[+/]\d*)?)$/, `${unit.name}/${field}`);
      return [key, key === 'Shd' && value === '-' ? '' : value];
    }),
  );
  attributes.Supply = (unit.squadProfile ?? [])
    .filter(tier => tier.modelCount && tier.modelCount !== '-')
    .map(tier => `${tier.modelCount.replace(/\s*-\s*/g, '-')}: ${tier.supply}`)
    .join(' | ');
  const profiles = [],
    optional = [];
  const seen = new Set();
  for (const ability of unit.upgrades) {
    assert.ok(
      ['costS', 'costL'].every(
        field => Number.isSafeInteger(ability[field]) && ability[field] >= 0,
      ),
      `Invalid upgrade costs: ${unit.name}/${ability.name}`,
    );
    assert.ok(
      !ability.optionGroup,
      `Grouped DB upgrade needs an explicit display mapping: ${unit.name}/${ability.name}`,
    );
    assert.ok(
      typeof ability.description === 'string' &&
        ability.description.trim() &&
        !ability.description.includes('\uFFFD'),
      `Invalid ability: ${unit.name}/${ability.name}`,
    );
    const phase = ability.phase === 'Cobmbat Phase' ? 'Combat Phase' : ability.phase;
    const weapon = parseWeapon({ ...ability, phase });
    const type = weapon?.type ?? 'Ability';
    const previous = identity.profiles[`${type}:${normalize(ability.name)}`];
    const linked = Boolean(ability.linkedTo && ability.linkedTo !== '-');
    const isOptional = previous?.optional ?? (ability.costS > 0 || ability.costL > 0 || linked);
    const id =
      previous?.sourceId ??
      `${identity.sourceId}_${isOptional ? 'upgrade_' : ''}${weapon ? 'weapon_' : ''}${slug(phase + '_' + ability.name)}`;
    assert.ok(!seen.has(id), `Duplicate ability identity: ${unit.name}/${ability.name}`);
    seen.add(id);
    const activation = (ability.activation ?? '').replace(/[<>]/g, '').trim();
    const profile = {
      sourceId: id,
      name: previous?.name ?? ability.name,
      type,
      attributes: weapon?.attributes ?? {
        Phase: phase,
        Type:
          activation
            .match(/^(Active|Passive|Reaction|Reactive)/i)?.[1]
            ?.replace(/^Reactive$/i, 'Reaction') ?? '',
        ...(activation.includes('(')
          ? {
              Cost:
                activation
                  .match(/\(([^)]+)\)/)?.[1]
                  ?.replace(/Command Points?/g, 'CP')
                  .replace(/Biomass/g, 'BM')
                  .replace(/Psionic Energy/g, 'PE') ?? '',
            }
          : {}),
        Effect: databaseText(ability.description),
      },
      description: '',
    };
    if (weapon && isOptional && linked) profile.attributes.Notes = `FOR ${ability.linkedTo}`;
    (isOptional ? optional : profiles).push(profile);
  }
  return {
    sourceId: identity.sourceId,
    documentName: 'Command Center/army_units',
    name: identity.name,
    statlineId: `${identity.sourceId}_stats`,
    statlineName: identity.name,
    attributes,
    categories: [
      unit.unitType,
      ...(unit.tags ?? '')
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean),
    ],
    profiles,
    modelCounts: [],
    costLabels: [
      `Minerals: ${unit.small.cost} (${unit.small.models} models)`,
      ...(unit.large.models > unit.small.models
        ? [`Reinforced: ${unit.large.cost} (${unit.large.models} models)`]
        : []),
    ],
    optionalUpgrades: [{ name: 'Command Center upgrades', profiles: optional }],
    modifierCount: 0,
    restricted: false,
    provenance: {
      sourceId: unit.sourceId,
      url: `${commandCenterUrl}/army_units/${unit.sourceId}`,
      officialBase: identity.base,
    },
    roster: {
      small: unit.small,
      large: unit.large,
      squadProfile: unit.squadProfile,
      keywords: unit.keywords,
      upgrades: unit.upgrades.map(ability => ({
        name: ability.name,
        costS: ability.costS,
        costL: ability.costL,
        linkedTo: ability.linkedTo,
        optionGroup: ability.optionGroup,
      })),
    },
  };
}

export async function loadCommandCenter({ snapshot = commandCenterSnapshot, mapping } = {}) {
  const raw = await readJson(snapshot);
  validateSnapshot(raw);
  mapping ??= await readJson(path.join(projectRoot, 'command-center-mapping.json'));
  return {
    factions: factions.map(name => ({
      name,
      units: raw.army_units
        .filter(unit => unit.faction === name)
        .map(unit => normalizeCommandUnit(unit, mapping)),
    })),
    metadata: {
      mode: 'command-center',
      source: commandCenterUrl,
      sources: [{ file: path.relative(projectRoot, snapshot), sha256: sourceFingerprint(raw) }],
      warnings: [],
      cards: raw.tactical_cards,
    },
  };
}
