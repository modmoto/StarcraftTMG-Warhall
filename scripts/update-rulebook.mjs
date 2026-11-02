import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { projectRoot } from '../src/paths.mjs';
import { sha256, writeJson } from '../src/io.mjs';
import { extractRulebook } from '../src/sources/pdf/rulebook.mjs';
import { extractKeywords } from '../src/sources/pdf/keywords.mjs';

const url = 'https://archon-studio.com/files/manuals/sc/StarCraft-TMG_EN.pdf';
const flags = process.argv.slice(2);
if (flags.some(flag => flag !== '--offline'))
  throw new Error('Use --offline for the cached rulebook');
const cache = path.join(projectRoot, '.cache/pdf/deployments/StarCraft-TMG_EN.pdf');
let bytes;
if (flags.includes('--offline')) bytes = new Uint8Array(await readFile(cache));
else {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Rulebook download failed: ${response.status}`);
  bytes = new Uint8Array(await response.arrayBuffer());
}
const task = getDocument({
  data: bytes.slice(),
  useSystemFonts: true,
  verbosity: 0,
  fontExtraProperties: true,
});
const pages = [];
try {
  const document = await task.promise;
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    await page.getOperatorList();
    const content = await page.getTextContent();
    pages.push({
      page: number,
      items: content.items
        .filter(item => item.str?.trim())
        .map(item => ({
          s: item.str.trim(),
          x: item.transform[4],
          y: item.transform[5],
          h: item.height,
          w: item.width,
          font: page.commonObjs.get(item.fontName)?.name?.split('+').at(-1) ?? '',
        })),
    });
    page.cleanup();
  }
} finally {
  await task.destroy();
}
const chapters = extractRulebook(pages);
const keywords = extractKeywords(pages);
if (keywords.length < 50) throw new Error('Incomplete official keyword glossary');
await writeJson(path.join(projectRoot, 'rulebook.json'), {
  source: { url, sha256: sha256(bytes), excludedParts: [1, 9, 12], printedPageOffset: 2 },
  chapters,
});
await writeJson(path.join(projectRoot, 'rule-keywords.json'), {
  source: {
    url,
    sha256: sha256(bytes),
    extraction: 'Official Part 11 glossary; PDF text and headings, whitespace normalized.',
  },
  rules: keywords,
});
await mkdir(path.dirname(cache), { recursive: true });
await writeFile(cache, bytes);
console.log(`Extracted ${chapters.length} numbered gameplay chapters. Review before publication.`);
