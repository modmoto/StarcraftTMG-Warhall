import path from 'node:path';
import { buildFromNewRecruit, buildFromPdf } from './convert.mjs';
import {
  defaultDataDirectory,
  defaultNewRecruitDirectory,
  defaultPdfCacheDirectory,
} from './paths.mjs';
import { writePackage } from './warhall/package.mjs';

const valueFlags = {
  '--source': 'source',
  '--nr-dir': 'nrDir',
  '--pdf-dir': 'pdfDir',
  '--output': 'output',
  '--cache-dir': 'cacheDir',
};
const booleanFlags = { '--dry-run': 'dryRun', '--offline': 'offline', '--help': 'help' };

export function parseArgs(args) {
  const options = {
    source: 'pdf',
    nrDir: defaultNewRecruitDirectory,
    output: defaultDataDirectory,
    dryRun: false,
    offline: false,
  };
  const remaining = [...args];

  while (remaining.length) {
    const flag = remaining.shift();
    if (booleanFlags[flag]) {
      options[booleanFlags[flag]] = true;
      continue;
    }

    const key = valueFlags[flag];
    if (!key || !remaining[0] || remaining[0].startsWith('--')) {
      throw new Error(`Unknown/incomplete argument: ${flag}`);
    }

    const value = remaining.shift();
    options[key] = key === 'source' ? value : path.resolve(value);
  }

  if (!['pdf', 'new-recruit'].includes(options.source)) {
    throw new Error('--source must be pdf or new-recruit');
  }
  if (options.source === 'new-recruit' && (options.pdfDir || options.cacheDir || options.offline)) {
    throw new Error('PDF options cannot be used with --source new-recruit');
  }

  return options;
}

function assertSeparateDirectories(options) {
  const input =
    options.source === 'new-recruit'
      ? options.nrDir
      : (options.pdfDir ?? options.cacheDir ?? defaultPdfCacheDirectory);
  const outputContainsInput = input.startsWith(`${options.output}${path.sep}`);
  const inputContainsOutput = options.output.startsWith(`${input}${path.sep}`);

  if (input === options.output || outputContainsInput || inputContainsOutput) {
    throw new Error('Source and output directories must be separate');
  }
}

function printHelp() {
  console.log(
    'Usage: npm run convert -- [--source pdf|new-recruit] [--nr-dir PATH] [--pdf-dir PATH] [--offline] [--cache-dir PATH] [--output PATH] [--dry-run]',
  );
  console.log(
    'Default: official PDFs, discovered/downloaded from Archon. --pdf-dir reads local official card sheets; --offline uses the last downloaded set.',
  );
}

function printResult(options, report) {
  const action = options.dryRun ? 'Validated' : 'Generated';
  const bases =
    options.source === 'pdf'
      ? 'base footprints come from the cards (flight stands: 100 mm round)'
      : 'base footprints use base-sizes.json';

  console.log(
    `${action} ${report.counts.units} units across ${report.counts.factions} factions from ${options.source}; ${bases}.`,
  );
  for (const warning of report.warnings) console.warn(`Source warning: ${warning}`);
  if (!options.dryRun) console.log(`Output: ${options.output}`);
}

export async function runConversion(args) {
  const options = parseArgs(args);
  if (options.help) {
    printHelp();
    return;
  }

  assertSeparateDirectories(options);
  const { data, report } =
    options.source === 'new-recruit'
      ? await buildFromNewRecruit(options.nrDir)
      : await buildFromPdf(options);

  if (!options.dryRun) await writePackage(options.output, data, report);
  printResult(options, report);
}
