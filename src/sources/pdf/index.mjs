import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { downloadsUrl, loadSources } from './downloads.mjs';
import { normalizeItems } from './layout.mjs';
import { parseCardPage } from './card-parser.mjs';
import { normalizeCards } from './adapter.mjs';

const pdfAssets = fileURLToPath(new URL('../../../node_modules/pdfjs-dist/', import.meta.url));

async function parseDocument(source, getDocument) {
  const loading = getDocument({
    data: source.bytes.slice(),
    useSystemFonts: true,
    cMapUrl: path.join(pdfAssets, 'cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: path.join(pdfAssets, 'standard_fonts/'),
    verbosity: 0,
    isEvalSupported: false,
  });
  const cards = [];
  const coverage = [];

  try {
    const document = await loading.promise;

    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const items = normalizeItems(content.items, page.view[2], page.view[3]);
      const card = parseCardPage(items, source, number);

      coverage.push({
        file: source.file,
        page: number,
        kind: card ? 'unit' : 'non-unit',
        ...(card ? { unit: card.name } : {}),
      });

      if (card) cards.push(card);
      page.cleanup();
    }

    if (!cards.length) throw new Error(`No readable unit pages: ${source.file}`);
    return { cards, coverage };
  } finally {
    await loading.destroy();
  }
}

export async function loadPdf(options = {}) {
  const sources = await loadSources(options);
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const cards = [];
  const coverage = [];

  for (const source of sources) {
    const parsed = await parseDocument(source, getDocument);
    cards.push(...parsed.cards);
    coverage.push(...parsed.coverage);
  }

  return normalizeCards(cards, {
    source: downloadsUrl,
    sources: sources.map(({ bytes, ...source }) => source),
    coverage,
    warnings: [],
  });
}
