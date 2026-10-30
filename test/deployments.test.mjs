import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { loadSources } from '../src/sources/pdf/downloads.mjs';
import { defaultPdfCacheDirectory } from '../src/paths.mjs';
import { parseDeploymentPdf, reconcileDeployments } from '../src/deployments/pdf.mjs';
import { buildDeployments, deploymentTemplate } from '../src/deployments/package.mjs';
import { markerModels, markerTexture } from '../src/deployments/markers.mjs';

const layout = {
  name: 'TEST',
  width: 36,
  height: 36,
  markers: [
    { number: 1, color: 'red', x: -12, y: 0 },
    { number: 2, color: 'blue', x: 12, y: 0 },
    { number: 5, color: 'green', x: 0, y: 0 },
  ],
  zones: [
    { color: 'red', bounds: [-18, 12, 18, 18] },
    { color: 'blue', bounds: [-18, -18, 18, -12] },
  ],
  sources: [{ file: 'a.pdf', page: 1 }],
};
test('conflicting faction copies fail instead of silently choosing a deployment', () => {
  const other = structuredClone(layout);
  other.markers[0].x = -6;
  assert.throws(() => reconcileDeployments([layout, other]), /Conflicting deployment/);
  assert.throws(() => reconcileDeployments([]), /No deployments/);
});
test('markers use exact inches, fixed orientation and distinct range aids', () => {
  const output = buildDeployments([layout]);
  assert.equal(output.objectives[0].Items.length, 6);
  assert.deepEqual(output.objectives[0].Items.at(-1), {
    Id: 'sc_mission_marker_5',
    Type: 'Token',
    PosX: '0',
    PosY: '0',
    IgnoreDeploymentRotation: true,
  });
  assert.equal(buildDeployments([layout], { includeRanges: false }).objectives[0].Items.length, 3);
  const models = markerModels();
  for (const m of models) {
    const actualDiameterMm = 4 * 2.54 * m.layout.size * 10;
    assert.ok(Math.abs(actualDiameterMm - (m.tokenId.includes('range') ? 184.4 : 32)) < 1e-9);
  }
});
test('L-shaped zones have no internal lines or duplicate overlap edges', () => {
  const l = structuredClone(layout);
  l.zones = [
    { color: 'red', bounds: [-18, 12, -6, 18] },
    { color: 'red', bounds: [-18, 6, -12, 18] },
    { color: 'blue', bounds: [6, -18, 18, -12] },
    { color: 'blue', bounds: [12, -18, 18, -6] },
  ];
  const template = deploymentTemplate(l);
  assert.equal(template.lines.length, 32); // perimeter 48 inches per L, in 3-inch segments
  assert.ok(template.lines.every(l => l.dummy));
  const invalid = structuredClone(layout);
  invalid.zones[0].bounds = [-18, 13, 18, 18];
  assert.throws(() => deploymentTemplate(invalid), /six-inch/);
});
test('numbered PNG textures are deterministic RGBA with transparent range interiors', () => {
  const png = markerTexture(1, true);
  assert.ok(png.equals(markerTexture(1, true)));
  assert.equal(png.readUInt32BE(16), 256);
  let offset = 8,
    compressed = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      compressed.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const pixels = inflateSync(Buffer.concat(compressed));
  assert.equal(pixels[128 * 1025 + 1 + 128 * 4 + 3], 0);
  assert.equal(pixels[128 * 1025 + 1 + 253 * 4 + 3], 150);
});

let cached = true;
try {
  await access(path.join(defaultPdfCacheDirectory, 'sources.json'));
} catch {
  cached = false;
}
test(
  'all official cached PDF layouts match independently reviewed printed coordinates',
  { skip: !cached },
  async () => {
    const expected = {
      'ABANDONED CAMP': [
        [-12, 0],
        [12, 0],
        [0, 0],
      ],
      ACROPOLIS: [
        [-15, 6],
        [15, 6],
        [15, -6],
        [-15, -6],
        [0, 0],
      ],
      'AGRIA VALLEY': [
        [-12, -12],
        [12, 12],
        [0, 0],
      ],
      BREACH: [
        [-9, 12],
        [9, 12],
        [9, -12],
        [-9, -12],
        [0, 0],
      ],
      'CHAR PLAINS': [
        [-12, -12],
        [-12, 12],
        [6, 0],
      ],
      'DIRT SIDE': [
        [-12, 0],
        [12, 0],
        [0, 0],
      ],
      FRONTIER: [
        [-12, -12],
        [12, 12],
        [0, 0],
      ],
      GAUNTLET: [
        [-15, 6],
        [15, -6],
        [9, 6],
        [-9, -6],
        [0, 0],
      ],
      'GREEN VALLEYS': [
        [-6, -12],
        [6, 12],
        [0, 0],
      ],
      'MEETING ENGAGEMENT': [
        [-15, 6],
        [15, -6],
        [15, 6],
        [-15, -6],
        [0, 0],
      ],
      'ONE BRIDGE TOO CLOSE': [
        [9, 3],
        [-9, 3],
        [15, -12],
        [-15, -12],
        [0, -12],
      ],
      'POWER LINES': [
        [6, 3],
        [-6, 3],
        [0, -12],
      ],
      'PROVING GROUNDS': [
        [-15, 6],
        [9, -6],
        [15, 6],
        [-9, -6],
        [0, 6],
      ],
      TYPHOON: [
        [-9, 6],
        [-21, 12],
        [21, -12],
        [9, -6],
        [0, 0],
      ],
    };
    const all = [];
    for (const source of await loadSources({ offline: true }))
      all.push(...(await parseDeploymentPdf(source)));
    const layouts = reconcileDeployments(all);
    assert.deepEqual(
      layouts.map(l => l.name),
      Object.keys(expected).sort(),
    );
    for (const l of layouts)
      assert.deepEqual(
        l.markers.map(m => [m.x, m.y]),
        expected[l.name],
        l.name,
      );
    assert.equal(buildDeployments(layouts).templates.length, 14);
    const published = JSON.parse(
      await readFile(new URL('../deployment-report.json', import.meta.url), 'utf8'),
    );
    assert.deepEqual(
      published.layouts.map(l => l.markers),
      layouts.map(l => l.markers),
    );
  },
);
