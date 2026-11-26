import sharp from 'sharp';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { projectRoot } from '../paths.mjs';
import { dataAssetBaseUrl } from '../urls.mjs';

const escape = value =>
  value.replace(
    /[&<>"']/g,
    char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char],
  );

export async function placeholderCard(name, faction) {
  const lines = [];
  for (const word of name.split(/\s+/)) {
    if (!lines.length || `${lines.at(-1)} ${word}`.length > 22) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  const color = { Terran: '#2467d1', Protoss: '#b68a20', Zerg: '#9a44bd' }[faction];
  const text = lines
    .map(
      (line, i) =>
        `<text x="733" y="${850 + i * 110}" text-anchor="middle" font-size="88" font-weight="bold">${escape(line)}</text>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1466" height="2048"><rect width="1466" height="2048" rx="45" fill="#101b27"/><rect x="40" y="40" width="1386" height="1968" rx="30" fill="none" stroke="${color}" stroke-width="16"/><g fill="#ffffff" font-family="Arial, sans-serif"><text x="733" y="260" text-anchor="middle" font-size="62">TACTICAL CARD</text>${text}<text x="733" y="1750" text-anchor="middle" font-size="48">ARTWORK PENDING</text></g></svg>`;
  const bytes = await sharp(Buffer.from(svg)).ensureAlpha().png().toBuffer();
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const file = `${faction.toLowerCase()}_${slug}_placeholder-${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}.png`;
  const directory = path.join(projectRoot, 'Starcraft/assets/cards');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, file), bytes);
  return `${dataAssetBaseUrl}/assets/cards/${file}`;
}
