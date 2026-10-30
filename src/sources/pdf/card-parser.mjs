import { normalizeText, displayName } from './names.mjs';
import { cardText, mergeTokens } from './layout.mjs';
import { readAbilities } from './abilities.mjs';
import { isPhaseName, phaseSections, readWeapons } from './weapons.mjs';

const statLabels = [
  ['SPEED', 'Spd'],
  ['ARMOUR', 'Arm'],
  ['EVADE', 'Eva'],
  ['POINTS', 'HP'],
  ['SIZE', 'Size'],
  ['SHIELD', 'Shd'],
];

function identifyFaces(items, context) {
  const sides = ['rotated', 'upright'].filter(side =>
    items.some(item => item.side === side && item.s === 'SPEED' && item.y > 380 && item.y < 410),
  );

  if (!sides.length) {
    const hasHitPoints = items.some(item => item.s === 'POINTS' && item.x > 310 && item.x < 345);
    const hasBaseSize = items.some(
      item => /MM$/.test(item.s) && item.x < 185 && item.y > 145 && item.y < 165,
    );
    if (hasHitPoints || hasBaseSize) throw new Error(`Unrecognized unit layout: ${context}`);
    return null;
  }

  if (sides.length !== 1) throw new Error(`Ambiguous card faces: ${context}`);

  return {
    front: items.filter(item => item.side === sides[0]),
    back: items.filter(item => item.side !== sides[0]),
  };
}

function readName(front, context) {
  const title = front.filter(
    item => item.x >= 80 && item.x < 190 && item.y > 380 && item.y < 410 && item.h > 10,
  );
  const name = cardText(title).replace(/\n/g, ' ');
  if (!name) throw new Error(`Missing unit name: ${context}`);
  return name;
}

function statPattern(key) {
  if (key === 'Spd') return /^(?:\d+(?:\/\d+)?|-)$/;
  if (['Eva', 'Arm'].includes(key)) return /^(?:\d\+|-)$/;
  return /^(?:\d+|-)$/;
}

function validateStatTokens(tokens, key, context) {
  if (key !== 'Spd' && new Set(tokens.map(item => item.s)).size !== 1) {
    throw new Error(`Conflicting ${key} values: ${context}`);
  }

  for (const token of tokens) {
    const conflict = tokens.some(
      other =>
        other !== token &&
        Math.abs(other.x - token.x) < 0.5 &&
        !other.s.startsWith(token.s) &&
        !token.s.startsWith(other.s),
    );
    if (conflict) throw new Error(`Conflicting ${key} overlays: ${context}`);
  }
}

function readStat(front, label, key, context) {
  const anchor = front.find(item => item.s === label && item.y > 380 && item.y < 392);
  if (!anchor) {
    if (key === 'Shd') return '';
    throw new Error(`Missing ${label} label: ${context}`);
  }

  const center = anchor.x + anchor.w / 2;
  const tokens = front.filter(
    item =>
      item.h >= 12 && item.y > 392 && item.y < 398 && Math.abs(item.x + item.w / 2 - center) < 13,
  );
  validateStatTokens(tokens, key, context);

  const value = mergeTokens(tokens).replace(/ /g, '');
  if (!statPattern(key).test(value) || (key === 'HP' && !/^\d+$/.test(value))) {
    throw new Error(`Ambiguous ${key} (${value}): ${context}`);
  }

  return value;
}

function readSupply(front, context) {
  const bands = front
    .filter(item => item.x > 375 && item.y > 397 && item.y < 402 && /^\d+(?:-\d+)?$/.test(item.s))
    .sort((a, b) => a.x - b.x);

  if (!bands.length) throw new Error(`Missing models/supply bands: ${context}`);

  return bands
    .map(band => {
      const candidates = front.filter(
        item =>
          item.x > band.x &&
          item.x < band.x + band.w &&
          item.y > 387 &&
          item.y < 392 &&
          /^\d+$/.test(item.s),
      );
      const values = [...new Set(candidates.map(item => item.s))];
      if (values.length !== 1) throw new Error(`Ambiguous supply for ${band.s}: ${context}`);
      return `${band.s}: ${values[0]}`;
    })
    .join(' | ');
}

function readCategories(front, back) {
  const category = back.find(
    item =>
      ['CORE', 'ELITE', 'SUPPORT', 'HERO'].includes(item.s) &&
      item.x > 450 &&
      item.y > 385 &&
      item.y < 400,
  );
  const categories = [displayName(category?.s ?? 'OTHER')];
  const tagItems = front.filter(
    item =>
      item.x >= 78 && item.x < 185 && item.y > 120 && item.y < 145 && !/COMBAT TAGS/.test(item.s),
  );
  const tags = cardText(tagItems).replace(/\n/g, ' ');

  if (tags) categories.push(...tags.split(',').map(tag => displayName(tag.trim())));
  return categories;
}

function readBase(back) {
  const tokens = back.filter(item => item.x >= 80 && item.x < 185 && item.y > 145 && item.y < 165);
  const label = mergeTokens(tokens);
  const dimensions = label.match(/(?:(\d+)\s*[×x]\s*)?(\d+)\s*MM/i);

  if (!dimensions) return { label };

  return {
    shape: dimensions[1] ? 'oval' : 'round',
    widthMm: Number(dimensions[1] ?? dimensions[2]),
    lengthMm: Number(dimensions[2]),
  };
}

function readFaceProfiles(face, context) {
  const profiles = [];
  let sourceIndex = 0;

  for (const section of phaseSections(face)) {
    const { weapons, consumed } = readWeapons(face, section, context);
    const weaponType = section.phase === 'COMBAT PHASE' ? 'Combat Weapon' : 'Assault Weapon';

    for (const weapon of weapons) {
      profiles.push({
        name: weapon.name,
        type: weaponType,
        attributes: weapon.attributes,
        sourceIndex: sourceIndex++,
      });
    }

    const body = face.filter(
      item =>
        item.x >= 170 &&
        item.x < 515 &&
        item.y > section.bottom &&
        item.y < section.top - 1 &&
        !consumed.has(item) &&
        !isPhaseName(item.s) &&
        !['UPGRADE', '⬆'].includes(item.s),
    );
    const abilities = readAbilities(cardText(body), section.phase, context);
    profiles.push(...abilities.map(ability => ({ ...ability, sourceIndex })));
    if (abilities.length) sourceIndex++;
  }

  return profiles;
}

export function parseCardPage(items, { file, faction, url }, page) {
  const context = `${file} page ${page}`;
  const faces = identifyFaces(items, context);
  if (!faces) return null;

  const { front, back } = faces;
  const rawName = readName(front, context);
  const attributes = Object.fromEntries(
    statLabels.map(([label, key]) => [key, readStat(front, label, key, context)]),
  );
  attributes.Supply = readSupply(front, context);

  const profiles = readFaceProfiles(front, context);
  if (!profiles.length) throw new Error(`No weapons or abilities parsed: ${context}`);

  return {
    name: displayName(rawName),
    rawName: normalizeText(rawName),
    faction,
    attributes,
    categories: readCategories(front, back),
    profiles,
    optional: readFaceProfiles(back, context),
    provenance: {
      file,
      url,
      page,
      printedName: normalizeText(rawName),
      officialBase: readBase(back),
      frontText: cardText(front.filter(item => item.y > 120 && item.y < 410)),
      upgradeText: cardText(back.filter(item => item.y > 120 && item.y < 410)),
    },
  };
}
