import { abilityName } from './abilities.mjs';

const includedParts = new Set([2, 3, 4, 5, 6, 7, 8, 10]);
const numberedHeading = /^(\d+\.\d+(?:\.\d+)?)\s+(.+)/;
const normalize = value => value.replace(/\s+/g, ' ').trim();

function paragraphText(items) {
  const lines = [];
  for (const item of items) {
    const previous = lines.at(-1);
    if (
      previous &&
      previous.page === item.page &&
      Math.abs(previous.y - item.y) < 1 &&
      item.x >= previous.end - 1
    ) {
      previous.text += item.x > previous.end + 1 ? ` ${item.s}` : item.s;
      previous.end = item.x + item.w;
    } else {
      lines.push({
        text: item.s,
        y: item.y,
        end: item.x + item.w,
        x: item.x,
        h: item.h,
        page: item.page,
      });
    }
  }
  let text = '';
  let previous;
  for (const line of lines) {
    const value = normalize(line.text);
    const block =
      /^•|^\d+\.\s/.test(value) || line.h >= 10 || (previous && previous.page !== line.page);
    const gap = previous ? Math.abs(previous.y - line.y) : 0;
    const separator = !text ? '' : block || gap > 15 ? '\n\n' : ' ';
    if (text.endsWith('-') && separator === ' ' && /^[a-z]/.test(value)) text = text.slice(0, -1);
    else text += separator;
    text += value;
    previous = line;
  }
  return text.replace(/\s+([,.;:!?])/g, '$1').trim();
}

export function extractRulebook(pages) {
  const start = pages.findIndex(page =>
    page.items.some(item => /^2\.1 MODELS$/.test(item.s) && item.h > 12),
  );
  if (start < 0) throw new Error('Core rules heading 2.1 not found');
  const isHeading = item =>
    [11, 13].some(h => Math.abs(h - item.h) < 0.1) && /Gineso/.test(item.font);
  const isBody = item =>
    /^NotoSans-(?:Condensed|CondensedExtraBold|CondensedBlack)$/.test(item.font) ||
    (/Gineso/.test(item.font) && Math.abs(item.h - 10) < 0.1) ||
    (item.font === 'Wingdings3' && item.s === 'X');
  const chapters = [];
  let current;
  let part;
  let readingTitle = false;
  let summaryPages = false;
  for (const page of pages.slice(start)) {
    if (page.items.some(item => /COVER SUMMARY TABLE/i.test(item.s))) summaryPages = true;
    if (summaryPages && page.items.some(item => isHeading(item) && numberedHeading.test(item.s)))
      summaryPages = false;
    if (summaryPages) continue;
    const summary = page.items.find(item => item.s === 'SUMMARY TABLE');
    const continuation = page.items.some(item => /^10\.5 TACTICAL CARDS$/.test(item.s));
    const items = page.items.filter(
      item =>
        item.y > 45 &&
        item.y < 740 &&
        (!summary || item.y > summary.y + 10) &&
        (!continuation || item.y < 400),
    );
    for (const item of items) {
      const matchPart = item.h >= 15 && item.s.match(/^PART (\d+):$/);
      if (matchPart) {
        part = Number(matchPart[1]);
        current = undefined;
        readingTitle = includedParts.has(part);
        if (readingTitle) {
          current = { number: String(part), title: '', page: page.page, items: [] };
          chapters.push(current);
        }
        continue;
      }
      if (!includedParts.has(part)) continue;
      if (readingTitle && item.h >= 15) {
        current.title = normalize(`${current.title} ${item.s}`);
        continue;
      }
      readingTitle = false;
      const heading = isHeading(item) && item.s.match(numberedHeading);
      if (heading) {
        if (Number(heading[1].split('.')[0]) !== part)
          throw new Error(`Chapter ${heading[1]} appears in Part ${part}`);
        current = { number: heading[1], title: heading[2], page: page.page, items: [] };
        chapters.push(current);
      } else if (current && isHeading(item)) {
        current.title = normalize(`${current.title} ${item.s}`);
      } else if (current && isBody(item)) {
        current.items.push({
          ...item,
          page: page.page,
          s: item.s === 'X' && item.w / item.h > 0.8 ? '•' : item.s,
        });
      }
    }
  }
  const numbers = new Set();
  const result = chapters.map(({ items, ...chapter }) => {
    if (numbers.has(chapter.number)) throw new Error(`Duplicate chapter ${chapter.number}`);
    numbers.add(chapter.number);
    return {
      ...chapter,
      title: abilityName(chapter.title).replace(/\s+\)/g, ')'),
      text: paragraphText(items),
    };
  });
  const toc = pages.find(page => page.items.some(item => item.s === 'TABLE OF CONTENTS'));
  if (!toc) throw new Error('Rulebook contents not found');
  for (const item of toc.items) {
    const match = item.s.replace(/^[•\s]+/, '').match(numberedHeading);
    if (match && includedParts.has(Number(match[1].split('.')[0])) && !numbers.has(match[1]))
      throw new Error(`Missing rulebook chapter ${match[1]}`);
  }
  return result;
}
