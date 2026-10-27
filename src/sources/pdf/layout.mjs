import { normalizeText } from './names.mjs';

export function normalizeItems(items, width, height) {
  const seen = new Set();

  return items
    .filter(item => typeof item.str === 'string' && item.str.trim())
    .map((item, order) => {
      const rotated = item.transform[0] < 0;
      return {
        s: normalizeText(item.str),
        x: rotated ? width - item.transform[4] : item.transform[4],
        y: rotated ? height - item.transform[5] : item.transform[5],
        w: item.width,
        h: item.height,
        side: rotated ? 'rotated' : 'upright',
        order,
      };
    })
    .filter(item => {
      const key = `${item.side}:${item.s}:${item.x.toFixed(2)}:${item.y.toFixed(2)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function overlapLength(previous, incoming) {
  for (let length = Math.min(previous.length, incoming.length); length > 0; length--) {
    if (previous.endsWith(incoming.slice(0, length))) return length;
  }
  return 0;
}

export function mergeTokens(items) {
  const sorted = [...items].sort((a, b) => a.x - b.x || b.s.length - a.s.length);
  let result = '';
  let end = -Infinity;

  for (const item of sorted) {
    if (item.x + item.w <= end + 0.8 && result.includes(item.s)) continue;

    const overlap = item.x < end - 0.5 ? overlapLength(result, item.s) : 0;
    const separator = result && item.x > end + 2 ? ' ' : '';
    result += separator + item.s.slice(overlap);
    end = Math.max(end, item.x + item.w);
  }

  return normalizeText(result);
}

export function cardText(items) {
  const ordered = [...items].sort((a, b) => a.order - b.order);
  let result = '';
  let previous;

  for (const item of ordered) {
    let separator = '';
    if (previous) separator = Math.abs(previous.y - item.y) > 2 ? '\n' : ' ';
    result += separator + item.s;
    previous = item;
  }

  return result.replace(/[\uE000-\uF8FF]/g, '↑').trim();
}
