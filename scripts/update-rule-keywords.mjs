import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { projectRoot } from '../src/paths.mjs';
import { sha256, writeJson } from '../src/io.mjs';
import { extractKeywords } from '../src/sources/pdf/keywords.mjs';

const url = 'https://archon-studio.com/files/manuals/sc/StarCraft-TMG_EN.pdf';
const input = process.argv[2];
let bytes;
if (input) bytes = new Uint8Array(await readFile(path.resolve(input)));
else {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Rulebook download failed: ${response.status}`);
  bytes = new Uint8Array(await response.arrayBuffer());
}
const assets = fileURLToPath(new URL('../node_modules/pdfjs-dist/', import.meta.url));
const loading = getDocument({
  data: bytes.slice(),
  useSystemFonts: true,
  verbosity: 0,
  isEvalSupported: false,
  standardFontDataUrl: path.join(assets, 'standard_fonts') + '/',
});
const pages = [];
try {
  const document = await loading.promise;
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    pages.push({
      page: number,
      items: content.items
        .filter(item => item.str?.trim())
        .map(item => ({
          s: item.str,
          x: item.transform[4],
          y: item.transform[5],
          h: item.height,
          w: item.width,
        })),
    });
    page.cleanup();
  }
} finally {
  await loading.destroy();
}
const rules = extractKeywords(pages);
if (rules.length < 50) throw new Error(`Incomplete official glossary: ${rules.length} entries`);
await writeJson(path.join(projectRoot, 'rule-keywords.json'), {
  source: {
    url,
    sha256: sha256(bytes),
    extraction: 'Official Part 11 glossary; PDF text and headings, whitespace normalized.',
  },
  rules,
});
console.log(`Updated ${rules.length} official keyword definitions; review changes before release.`);
