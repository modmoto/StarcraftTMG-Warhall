import { loadNewRecruit } from './sources/new-recruit.mjs';
import { buildWarhallPackage } from './warhall/package.mjs';

export async function buildFromNewRecruit(directory, template) {
  const source = await loadNewRecruit(directory);
  return buildWarhallPackage(source, template);
}

export async function buildFromPdf(options = {}) {
  const { loadPdf } = await import('./sources/pdf/index.mjs');
  const source = await loadPdf(options);
  return buildWarhallPackage(source, options.template);
}
