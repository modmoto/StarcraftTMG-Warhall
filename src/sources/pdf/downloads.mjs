import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { sha256, readJson, writeJson } from '../../io.mjs';
import { defaultPdfCacheDirectory } from '../../paths.mjs';

export const downloadsUrl =
  'https://archon-studio.com/downloads/starcraft-tabletop-miniatures-game';
const cardPattern = /^StarCraft-(Terran|Protoss|Zerg)-P2P-(?:W(\d+)-)?Card-Sheets-A4_EN\.pdf$/;
const officialHosts = ['archon-studio.com', 'starcraft-tmg.com'];

export function discoverCards(html) {
  const cards = new Map();

  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const url = new URL(match[1].replace(/&amp;/g, '&'), downloadsUrl);
    const file = decodeURIComponent(url.pathname.split('/').at(-1));
    const card = file.match(cardPattern);
    if (!card) continue;

    if (url.protocol !== 'https:' || !officialHosts.includes(url.hostname)) {
      throw new Error(`Unexpected official card host: ${url.hostname}`);
    }
    if (cards.has(file) && cards.get(file).url !== url.href) {
      throw new Error(`Conflicting card URLs: ${file}`);
    }

    cards.set(file, { file, faction: card[1], wave: Number(card[2] ?? 1), url: url.href });
  }

  for (const faction of ['Terran', 'Protoss', 'Zerg']) {
    const hasBaseSheet = [...cards.values()].some(
      card => card.faction === faction && card.wave === 1,
    );
    if (!hasBaseSheet)
      throw new Error(`Official downloads index missing ${faction} base card sheet`);
  }

  return [...cards.values()].sort((a, b) => a.file.localeCompare(b.file, 'en'));
}

async function fetchChecked(url, binary = false) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60000),
    headers: { 'User-Agent': 'StarcraftTMG-Warhall card converter' },
  });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return binary ? new Uint8Array(await response.arrayBuffer()) : response.text();
}

async function loadLocalSources(directory) {
  const files = (await readdir(directory)).filter(file => cardPattern.test(file)).sort();
  if (!files.length) throw new Error(`No official English P2P card sheets in ${directory}`);

  return Promise.all(
    files.map(async file => {
      const match = file.match(cardPattern);
      const bytes = new Uint8Array(await readFile(path.join(directory, file)));

      return {
        file,
        faction: match[1],
        wave: Number(match[2] ?? 1),
        url: `https://archon-studio.com/files/manuals/sc/${file}`,
        bytes,
        sha256: sha256(bytes),
      };
    }),
  );
}

async function loadCachedSources(directory) {
  const manifest = await readJson(path.join(directory, 'sources.json'));
  if (!Array.isArray(manifest.cards) || !manifest.cards.length) {
    throw new Error('No cached official card set');
  }

  return Promise.all(
    manifest.cards.map(async card => {
      if (!cardPattern.test(card.file)) throw new Error(`Unsafe cached PDF filename: ${card.file}`);

      const bytes = new Uint8Array(await readFile(path.join(directory, card.file)));
      if (sha256(bytes) !== card.sha256) {
        throw new Error(`Cached PDF checksum mismatch: ${card.file}`);
      }

      return { ...card, bytes };
    }),
  );
}

async function downloadSources(directory) {
  const html = await fetchChecked(downloadsUrl);
  const cards = discoverCards(html);
  const sources = [];

  for (const card of cards) {
    const bytes = await fetchChecked(card.url, true);
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') {
      throw new Error(`Not a PDF: ${card.url}`);
    }
    sources.push({ ...card, bytes, sha256: sha256(bytes) });
  }

  for (const source of sources) await writeFile(path.join(directory, source.file), source.bytes);
  await writeJson(path.join(directory, 'sources.json'), {
    index: downloadsUrl,
    cards: sources.map(({ bytes, ...source }) => source),
  });

  return sources;
}

export async function loadSources({
  pdfDir,
  cacheDir = defaultPdfCacheDirectory,
  offline = false,
} = {}) {
  if (pdfDir) return loadLocalSources(pdfDir);

  await mkdir(cacheDir, { recursive: true });
  return offline ? loadCachedSources(cacheDir) : downloadSources(cacheDir);
}
