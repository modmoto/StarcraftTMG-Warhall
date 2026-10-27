import { cardText, mergeTokens } from './layout.mjs';

export function isPhaseName(value) {
  return /^(ANY|MOVEMENT|ASSAULT|COMBAT) PHASE$/.test(value);
}

export function phaseSections(items) {
  const phases = items
    .filter(item => isPhaseName(item.s) && item.x > 165 && item.y > 135 && item.y < 380)
    .sort((a, b) => b.y - a.y);

  return phases.map((phase, index) => ({
    phase: phase.s,
    top: phase.y + 1,
    bottom: (phases[index + 1]?.y ?? 135) + 5,
  }));
}

function readColumns(items, header, context) {
  const labels = items.filter(item => Math.abs(item.y - header.y) < 1);

  function position(pattern) {
    const label = labels.find(item => pattern.test(item.s));
    if (!label) throw new Error(`Missing weapon column ${pattern}: ${context}`);
    return label.x;
  }

  const range = position(/^RNG$/) - 3;
  const target = position(/^Target$/) - 2;
  const attacks = position(/^RoA$/) - 2;
  const hit = position(/^Hit$/) - 1;
  const surge = position(/^Hit$/) + 11;
  const dice = position(/^(?:S|S Dice|SDice)$/) - 2;
  const damage = position(/^Dmg/) - 1;
  const keyword = position(/^Dmg/) + 16;

  return {
    Rng: { left: range, right: target },
    Tgt: { left: target, right: attacks },
    RoA: { left: attacks, right: hit },
    Hit: { left: hit, right: surge },
    Surge: { left: surge, right: dice },
    'S.Die': { left: dice, right: damage },
    Dmg: { left: damage, right: keyword },
    Keyword: { left: keyword, right: 515 },
  };
}

function inColumn(item, column) {
  return item.x >= column.left && item.x < column.right;
}

function tableBottom(items, headers, header, section) {
  const nextHeader = headers.filter(item => item.y < header.y).sort((a, b) => b.y - a.y)[0];
  const firstAbility = items
    .filter(item => item.y < header.y && /:$/.test(item.s) && item.x < 400)
    .sort((a, b) => b.y - a.y)[0];

  return Math.max(
    section.bottom,
    nextHeader?.y ?? -Infinity,
    firstAbility ? firstAbility.y + 2 : -Infinity,
  );
}

function isRowMarker(item, columns) {
  const hit = inColumn(item, columns.Hit) && /^(?:\d\+|-)$/.test(item.s);
  const range = inColumn(item, columns.Rng) && /^(?:E|\d+)$/.test(item.s);
  return hit || range;
}

function validateRow(values, y, context, phase) {
  const readable =
    /^(?:E|\d+)$/.test(values.Rng) &&
    /^(?:\d+|BT(?:\+\d+)?)$/.test(values.RoA) &&
    /^(?:\d\+|-)$/.test(values.Hit) &&
    /^\d+$/.test(values.Dmg);

  if (!readable) {
    throw new Error(
      `Unreadable weapon row: ${context} / ${phase} at ${y.toFixed(1)} (${JSON.stringify(values)})`,
    );
  }
}

function readRows(items, columns, header, bottom, context, phase) {
  const markers = items.filter(
    item => item.y < header.y - 3 && item.y > bottom && isRowMarker(item, columns),
  );
  const positions = [...new Set(markers.map(item => item.y))].sort((a, b) => b - a);
  const rows = [];

  for (const y of positions) {
    if (rows.some(row => Math.abs(row.y - y) < 2)) continue;

    const tokens = items.filter(item => Math.abs(item.y - y) < 1.6);
    const values = Object.fromEntries(
      Object.entries(columns).map(([name, column]) => [
        name,
        mergeTokens(tokens.filter(item => inColumn(item, column))),
      ]),
    );
    validateRow(values, y, context, phase);
    rows.push({ y, values });
  }

  if (!rows.length) throw new Error(`Weapon table has no readable rows: ${context} / ${phase}`);
  return rows;
}

function readWeapon(row, items, columns, context, phase) {
  const replacementLines = items
    .filter(item => /^FOR\b|^↑|^⬆|^[\uE000-\uF8FF]$/.test(item.s))
    .map(item => item.y);
  const isReplacement = item => replacementLines.some(y => Math.abs(item.y - y) < 1.6);
  const nameItems = items.filter(item => item.x < columns.Rng.left && !isReplacement(item));
  const name = cardText(nameItems).replace(/\n/g, ' ');

  if (!name || /\b(?:This Unit|PASSIVE|ACTIVE)\b/.test(name)) {
    throw new Error(`Ambiguous weapon name: ${context} / ${phase}`);
  }

  for (const key of ['Tgt', 'Surge', 'Keyword']) {
    const tokens = items.filter(item => inColumn(item, columns[key]));
    row.values[key] = cardText(tokens).replace(/\n/g, ' ');
  }

  const replacement = cardText(
    items.filter(item => item.x < columns.Rng.left && isReplacement(item)),
  );
  if (replacement) row.values.Notes = replacement.replace(/\n/g, ' ');

  return { name, phase, attributes: row.values };
}

export function readWeapons(items, section, context) {
  const sectionItems = items.filter(
    item => item.x >= 190 && item.x < 515 && item.y > section.bottom && item.y < section.top,
  );
  const headers = sectionItems.filter(item => item.s === 'NAME');
  const weapons = [];
  const consumed = new Set();

  for (const header of headers) {
    const columns = readColumns(sectionItems, header, context);
    const bottom = tableBottom(sectionItems, headers, header, section);
    const rows = readRows(sectionItems, columns, header, bottom, context, section.phase);

    for (const [index, row] of rows.entries()) {
      const nextRow = rows[index + 1];
      const rowBottom = Math.max(row.y - 11, nextRow ? (row.y + nextRow.y) / 2 : -Infinity);
      const rowItems = sectionItems.filter(item => item.y <= row.y + 4 && item.y >= rowBottom);
      weapons.push(readWeapon(row, rowItems, columns, context, section.phase));
    }

    const tableEnd = Math.min(...rows.map(row => row.y)) - 12;
    for (const item of sectionItems) {
      if (item.y <= header.y + 2 && item.y >= tableEnd) consumed.add(item);
    }
  }

  return { weapons, consumed };
}
