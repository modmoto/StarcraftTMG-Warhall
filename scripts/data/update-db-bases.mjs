import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { readJson, writeJson, sha256 } from '../../src/io.mjs';
import { normalizeItems } from '../../src/sources/pdf/layout.mjs';
import { parseCardBase } from '../../src/sources/pdf/card-parser.mjs';
import { projectRoot, defaultPdfCacheDirectory } from '../../src/paths.mjs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dirIndex = args.indexOf('--pdf-dir');
if (
  args.some(
    (arg, index) =>
      arg !== '--apply' && arg !== '--pdf-dir' && !(dirIndex >= 0 && index === dirIndex + 1),
  )
)
  throw new Error('Usage: npm run wave:bases -- [--pdf-dir PATH] [--apply]');
if (dirIndex >= 0 && !args[dirIndex + 1]) throw new Error('Missing --pdf-dir path');
const directory = dirIndex >= 0 ? path.resolve(args[dirIndex + 1]) : defaultPdfCacheDirectory;
const mappingFile = path.join(projectRoot, 'command-center-mapping.json');
const mapping = await readJson(mappingFile);
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const matches = new Map();
for (const file of (await readdir(directory))
  .filter(file => /StarCraft-(Protoss|Terran|Zerg)-P2P-.*\.pdf$/.test(file))
  .sort()) {
  const bytes = new Uint8Array(await readFile(path.join(directory, file)));
  const faction = file.match(/StarCraft-(Protoss|Terran|Zerg)-/)[1];
  const filename = file.replace(/^current-/, '');
  const source = {
    file: filename,
    faction,
    url: `https://${file.startsWith('current-') ? 'starcraft-tmg.com/files/downloads' : 'archon-studio.com/files/manuals/sc'}/${filename}`,
  };
  const loading = getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
    verbosity: 0,
    isEvalSupported: false,
  });
  try {
    const document = await loading.promise;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const card = parseCardBase(
        normalizeItems(content.items, page.view[2], page.view[3]),
        source,
        pageNumber,
      );
      if (!card || !card.base.shape) continue;
      for (const [key, entry] of Object.entries(mapping)) {
        if (
          entry.base ||
          !key.startsWith(faction + '/') ||
          normalize(entry.name) !== normalize(card.name)
        )
          continue;
        const previous = matches.get(key);
        if (previous && JSON.stringify(previous.base) !== JSON.stringify(card.base))
          throw new Error(`Conflicting PDF base sizes: ${key}`);
        matches.set(key, {
          base: card.base,
          baseSource: { ...card.source, sha256: sha256(bytes) },
        });
      }
      page.cleanup();
    }
  } finally {
    await loading.destroy();
  }
}
for (const [key, value] of matches) {
  console.log(
    `${key}: ${value.base.widthMm} × ${value.base.lengthMm} mm (${value.baseSource.file}, p. ${value.baseSource.page})`,
  );
  Object.assign(mapping[key], value);
}
console.log(
  `Found ${matches.size}; still missing ${Object.values(mapping).filter(entry => !entry.base).length} base sizes. No DB rule/stat fields were read from PDFs.`,
);
if (apply) await writeJson(mappingFile, mapping);
