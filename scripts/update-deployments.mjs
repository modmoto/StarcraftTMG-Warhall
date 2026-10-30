import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { projectRoot, defaultDataDirectory } from '../src/paths.mjs';
import { readJson, sha256 } from '../src/io.mjs';
import { downloadsUrl, loadSources } from '../src/sources/pdf/downloads.mjs';
import { parseDeploymentPdf, reconcileDeployments } from '../src/deployments/pdf.mjs';
import { buildDeployments, deploymentName } from '../src/deployments/package.mjs';
import {
  markerTexture,
  markerDiameterMm,
  controlRangeInches,
} from '../src/deployments/markers.mjs';

const options = {
  offline: false,
  dryRun: false,
  check: false,
  output: defaultDataDirectory,
  cacheDir: path.join(projectRoot, '.cache', 'pdf'),
};
const flags = { '--offline': 'offline', '--dry-run': 'dryRun', '--check': 'check' };
const values = {
  '--output': 'output',
  '--cache-dir': 'cacheDir',
  '--pdf-dir': 'pdfDir',
  '--rules-pdf': 'rulesPdf',
};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (flags[args[i]]) options[flags[args[i]]] = true;
  else if (values[args[i]]) {
    assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), `Missing value: ${args[i]}`);
    options[values[args[i]]] = path.resolve(args[++i]);
  } else throw Error(`Unknown option: ${args[i]}`);
}
if (options.check) options.offline = true;
const cache = path.join(options.cacheDir, 'deployments');
await mkdir(cache, { recursive: true });
const ruleFile = 'StarCraft-TMG_EN.pdf';
let rulesBytes, ruleSource;
if (options.rulesPdf) {
  rulesBytes = await readFile(options.rulesPdf);
  ruleSource = {
    file: path.basename(options.rulesPdf),
    url: downloadsUrl,
    sha256: sha256(rulesBytes),
  };
} else if (options.offline) {
  ruleSource = await readJson(path.join(cache, 'rules-source.json'));
  rulesBytes = await readFile(path.join(cache, ruleFile));
  assert.equal(sha256(rulesBytes), ruleSource.sha256, 'Cached rulebook checksum mismatch');
} else {
  const index = await fetch(downloadsUrl, { signal: AbortSignal.timeout(60000) });
  assert.ok(index.ok, `Downloads index failed: ${index.status}`);
  const html = await index.text();
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(
    m => new URL(m[1].replaceAll('&amp;', '&'), downloadsUrl),
  );
  const url = links.find(u => decodeURIComponent(u.pathname.split('/').at(-1)) === ruleFile);
  assert.ok(
    url &&
      url.protocol === 'https:' &&
      ['archon-studio.com', 'starcraft-tmg.com'].includes(url.hostname),
    'Official English rulebook link missing',
  );
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  assert.ok(response.ok, `Rulebook download failed: ${response.status}`);
  rulesBytes = Buffer.from(await response.arrayBuffer());
  ruleSource = { file: ruleFile, url: url.href, sha256: sha256(rulesBytes) };
  assert.equal(rulesBytes.subarray(0, 5).toString(), '%PDF-', 'Rulebook is not a PDF');
  await writeFile(path.join(cache, ruleFile), rulesBytes);
  await writeFile(
    path.join(cache, 'rules-source.json'),
    JSON.stringify(ruleSource, null, 2) + '\n',
  );
}
const task = getDocument({
  data: new Uint8Array(rulesBytes),
  verbosity: 0,
  useSystemFonts: true,
  isEvalSupported: false,
});
let rules = '';
try {
  const doc = await task.promise;
  for (let i = 1; i <= doc.numPages; i++)
    rules += ' ' + (await (await doc.getPage(i)).getTextContent()).items.map(i => i.str).join(' ');
} finally {
  await task.destroy();
}
rules = rules.replace(/\s+/g, ' ');
// Fail on changed game measurements/affinities rather than publishing stale
// marker assets. A new rules convention requires a deliberate asset migration.
assert.match(rules, /Each Marker is 32mm in diameter/, 'Mission marker diameter changed');
assert.match(
  rules,
  /Markers 1 & 3 are Red, Markers 2 & 4 are Blue, and Marker 5 is Neutral/,
  'Mission marker affinities changed',
);
assert.match(rules, /At least one model is Within 3[”"]/, 'Contesting range changed');
assert.match(rules, /A restricted area extending 6[”"] inward/, 'Influence zone depth changed');
const sources = await loadSources(options);
const parsed = [];
for (const source of sources) parsed.push(...(await parseDeploymentPdf(source)));
const layouts = reconcileDeployments(parsed);
const generated = buildDeployments(layouts);
let previous = { layouts: [] };
try {
  previous = await readJson(path.join(projectRoot, 'deployment-report.json'));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const ownedDeploymentIds = new Set(previous.layouts.map(l => l.templateId));
const outputs = new Map();
const json = (file, data) => outputs.set(file, Buffer.from(JSON.stringify(data, null, 2) + '\n'));
for (const [file, records, owned] of [
  [
    'deployments.json',
    generated.deployments,
    r =>
      ownedDeploymentIds.has(r.deploymentID) ||
      generated.templates.some(t => t.deploymentID === r.deploymentID),
  ],
  ['objectives.json', generated.objectives, r => r.Id?.startsWith('sc_deployment_')],
  ['tokens.json', generated.tokens, r => r.Id?.startsWith('sc_mission_')],
]) {
  let existing = [];
  try {
    existing = await readJson(path.join(options.output, file));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  if (file === 'deployments.json') {
    for (const record of existing) {
      const incoming = records.find(r => r.deploymentID === record.deploymentID);
      assert.ok(
        !incoming ||
          ownedDeploymentIds.has(record.deploymentID) ||
          incoming.deploymentName === record.deploymentName,
        'Deployment ID collides with an unrelated entry',
      );
    }
  }
  json(path.join(options.output, file), [...existing.filter(r => !owned(r)), ...records]);
}
json(path.join(projectRoot, 'deployment-templates.json'), generated.templates);
json(path.join(projectRoot, 'deployment-models.json'), {
  source: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3662791369',
  markerDiameterMm,
  controlRangeInches,
  controlAreaDiameterMm: markerDiameterMm + controlRangeInches * 25.4 * 2,
  models: generated.models,
});
json(path.join(projectRoot, 'deployment-report.json'), {
  rules: ruleSource,
  units: 'inches; origin at battlefield center; X right, Y up in the upright printed card',
  extraction:
    'PDF vector symbols and battlefield bounds; reviewed printed measurements on the current 3-inch grid. Unknown colors, missing symbols, off-grid positions and conflicting copies fail. Review new or changed cards against their printed arrows.',
  deploymentImport:
    'deployment-templates.json must be registered in Warhall DeploymentDB. WDS does not load custom template geometry.',
  modelImport:
    'deployment-models.json uses the TTS CDN disk mesh and repository-hosted numbered textures; register through the Warhall skin catalogue or the local test adapter.',
  layouts: layouts.map((l, i) => ({ ...l, templateId: generated.templates[i].deploymentID })),
});
for (let n = 1; n <= 5; n++)
  for (const halo of [false, true])
    outputs.set(
      path.join(projectRoot, 'assets', 'markers', `${halo ? 'range' : 'marker'}-${n}.png`),
      markerTexture(n, halo),
    );
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const reviews = layouts
  .map(l => {
    const sx = x => x + l.width / 2,
      sy = y => l.height / 2 - y;
    return `<section><h2>${escape(deploymentName(l))}</h2><svg viewBox="-3 -3 ${l.width + 6} ${l.height + 6}"><rect width="${l.width}" height="${l.height}" fill="#eee" stroke="#333" stroke-width=".2"/>${l.zones.map(z => `<rect x="${sx(z.bounds[0])}" y="${sy(z.bounds[3])}" width="${z.bounds[2] - z.bounds[0]}" height="${z.bounds[3] - z.bounds[1]}" fill="${z.color}" opacity=".2"/>`).join('')}${l.markers.map(m => `<circle cx="${sx(m.x)}" cy="${sy(m.y)}" r="${16 / 25.4 + 3}" fill="none" stroke="${m.color}" opacity=".3" stroke-width=".15"/><circle cx="${sx(m.x)}" cy="${sy(m.y)}" r="${16 / 25.4}" fill="${m.color}"/><text x="${sx(m.x)}" y="${sy(m.y) + 0.4}" font-size="1.4" text-anchor="middle" fill="white">${m.number}</text>`).join('')}</svg><p>${l.markers.map(m => `${m.number}: (${m.x}, ${m.y})`).join(' · ')}</p><p>${l.sources.map(s => `<a href="${escape(s.url)}">${escape(s.file)}, page ${s.page}</a>`).join('<br>')}</p></section>`;
  })
  .join('\n');
outputs.set(
  path.join(projectRoot, 'docs', 'deployments.html'),
  Buffer.from(
    `<!doctype html><meta charset="utf-8"><title>StarCraft deployment review</title><style>body{font:16px sans-serif;max-width:1200px;margin:2em auto;background:#fafafa}main{display:grid;grid-template-columns:1fr 1fr;gap:2em}section{background:white;padding:1em;border:1px solid #ddd}svg{width:100%}p{font-size:12px;overflow-wrap:anywhere}</style><h1>StarCraft deployments</h1><p>32 mm numbered markers, with a 3-inch range aid measured from their edges. Coordinates are inches from the table center. Set the table to the printed size and select matching deployment and objective presets. Activation and control remain manual.</p><main>${reviews}</main>\n`,
  ),
);
if (options.check) {
  for (const [file, bytes] of outputs)
    assert.ok((await readFile(file)).equals(bytes), `Stale deployment output: ${file}`);
} else if (!options.dryRun) {
  const originals = new Map();
  for (const file of outputs.keys()) {
    try {
      originals.set(file, await readFile(file));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      originals.set(file, null);
    }
  }
  try {
    for (const [file, bytes] of outputs) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
    }
  } catch (e) {
    for (const [file, bytes] of originals) {
      if (bytes) await writeFile(file, bytes);
      else await unlink(file).catch(() => {});
    }
    throw e;
  }
}
console.log(
  `${options.check ? 'Verified' : options.dryRun ? 'Previewed' : 'Updated'} ${layouts.length} deployments, ${generated.objectives.length} objective presets and ${generated.tokens.length} marker/range tokens. Shared templates and skins require Warhall catalogue import.`,
);
