import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const assets = fileURLToPath(new URL('../../node_modules/pdfjs-dist/', import.meta.url)).replaceAll(
  '\\',
  '/',
);
const identity = [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
const point = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const inside = (p, b, margin = 0) =>
  p[0] >= b[0] - margin && p[0] <= b[2] + margin && p[1] >= b[1] - margin && p[1] <= b[3] + margin;
const center = b => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function extractPaths(operators) {
  let state = { matrix: identity, fill: '#000000', stroke: '#000000' };
  const stack = [],
    paths = [];
  for (let i = 0; i < operators.fnArray.length; i++) {
    const op = operators.fnArray[i],
      args = operators.argsArray[i];
    if (op === OPS.save) stack.push({ ...state });
    else if (op === OPS.restore) {
      assert.ok(stack.length, 'Unbalanced PDF graphics state');
      state = stack.pop();
    } else if (op === OPS.transform) state = { ...state, matrix: multiply(state.matrix, args) };
    else if (op === OPS.setFillRGBColor) state.fill = args[0];
    else if (op === OPS.setStrokeRGBColor) state.stroke = args[0];
    else if (op === OPS.constructPath) {
      assert.ok(args[2]?.length === 4, 'Unsupported PDF.js path format');
      const [x0, y0, x1, y1] = args[2];
      const pts = [
        [x0, y0],
        [x0, y1],
        [x1, y0],
        [x1, y1],
      ].map(p => point(state.matrix, ...p));
      const bbox = [
        Math.min(...pts.map(p => p[0])),
        Math.min(...pts.map(p => p[1])),
        Math.max(...pts.map(p => p[0])),
        Math.max(...pts.map(p => p[1])),
      ];
      const packed = args[1]?.[0];
      paths.push({
        bbox,
        fill: state.fill,
        stroke: state.stroke,
        paint: args[0],
        rectangle:
          packed?.length === 13 &&
          packed[0] === 0 &&
          packed[3] === 1 &&
          packed[6] === 1 &&
          packed[9] === 1 &&
          packed[12] === 4,
      });
    }
  }
  return paths;
}

const colour = hex =>
  ({
    '#be1d28': 'red',
    '#1d71b8': 'blue',
    '#3fa535': 'green',
    '#f8c7c8': 'red',
    '#bddced': 'blue',
  })[hex];
function textCenter(i) {
  const sign = Math.sign(i.transform[0]);
  return [i.transform[4] + (sign * i.width) / 2, i.transform[5] + sign * i.height * 0.36];
}
function snap(value, context, tolerance = 0.4) {
  const rounded = Math.round(value);
  assert.ok(
    Math.abs(value - rounded) < tolerance,
    `Uncertain printed coordinate ${value.toFixed(3)}: ${context}`,
  );
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function parseDeploymentPage(items, paths, source, page) {
  const dimensions = items.filter(i => /^\d+×\d+[˝″"]$/.test(i.str));
  if (!dimensions.length) return [];
  const tables = paths.filter(
    p =>
      p.rectangle &&
      p.paint === OPS.stroke &&
      p.bbox[3] - p.bbox[1] > 50 &&
      p.bbox[3] - p.bbox[1] < 220 &&
      ['#575756', '#3c3c3b', '#000000'].includes(p.stroke),
  );
  const result = [];
  for (const dimension of dimensions) {
    const [width, height] = dimension.str.match(/\d+/g).map(Number),
      sign = Math.sign(dimension.transform[0]);
    const dc = textCenter(dimension);
    const possible = tables
      .filter(t => {
        const b = t.bbox,
          w = b[2] - b[0],
          h = b[3] - b[1];
        return (
          Math.abs(w / h - width / height) < 0.02 &&
          inside([dc[0], center(b)[1]], [b[0] - 60, b[1], b[2] + 60, b[3]]) &&
          (sign > 0 ? dc[1] > b[3] : dc[1] < b[1]) &&
          near(dc, center(b)) < 160
        );
      })
      .sort((a, b) => near(dc, center(a.bbox)) - near(dc, center(b.bbox)));
    assert.ok(possible.length, `No battlefield rectangle: ${source.file}:${page} ${dimension.str}`);
    const table = possible[0].bbox;
    const title = items
      .filter(
        i =>
          i.height >= 12 &&
          i.height <= 16 &&
          Math.sign(i.transform[0]) === sign &&
          /^[A-Z][A-Z '’-]+$/.test(i.str) &&
          Math.abs(i.transform[5] - dimension.transform[5]) < 5 &&
          sign * (textCenter(i)[0] - dc[0]) < -10 &&
          near(textCenter(i), dc) < 220,
      )
      .sort((a, b) => near(textCenter(a), dc) - near(textCenter(b), dc))[0];
    assert.ok(title, `No deployment title: ${source.file}:${page}`);
    const name = title.str.replaceAll('’', "'");
    const convert = (p, zone = false) => {
      const raw = [
        sign * (((p[0] - table[0]) / (table[2] - table[0])) * width - width / 2),
        sign * (((p[1] - table[1]) / (table[3] - table[1])) * height - height / 2),
      ];
      // Pastel zone artwork bleeds beyond the measured 6-inch boundary. Its
      // printed endpoints use a 3-inch grid; numbered marker centers do not.
      return raw.map(v => 3 * snap(v / 3, name + (zone ? ' zone' : ' marker'), zone ? 0.49 : 0.42));
    };
    const labels = items.filter(
      i => /^[1-5]$/.test(i.str) && i.height >= 6 && i.height < 8 && inside(textCenter(i), table),
    );
    const unique = [...new Map(labels.map(i => [i.str, i])).values()];
    assert.deepEqual(
      unique.map(i => +i.str).sort(),
      width === 36 ? [1, 2, 5] : [1, 2, 3, 4, 5],
      `Unexpected markers: ${name}`,
    );
    const markers = unique
      .map(i => {
        const expected = +i.str === 5 ? 'green' : +i.str % 2 ? 'red' : 'blue';
        const circles = paths.filter(
          p =>
            !p.rectangle &&
            colour(p.fill) === expected &&
            p.bbox[2] - p.bbox[0] > 3 &&
            p.bbox[2] - p.bbox[0] < 13 &&
            p.bbox[3] - p.bbox[1] > 3 &&
            p.bbox[3] - p.bbox[1] < 13 &&
            near(center(p.bbox), textCenter(i)) < 3,
        );
        const c = circles.sort(
          (a, b) => near(center(a.bbox), textCenter(i)) - near(center(b.bbox), textCenter(i)),
        )[0];
        assert.ok(c, `Missing ${expected} marker symbol ${i.str}: ${name}`);
        const [x, y] = convert(center(c.bbox));
        return { number: +i.str, color: expected, x, y };
      })
      .sort((a, b) => a.number - b.number);
    const zones = paths
      .filter(
        p =>
          p.rectangle &&
          ['#f8c7c8', '#bddced'].includes(p.fill) &&
          p.paint !== OPS.stroke &&
          inside(center(p.bbox), table) &&
          p.bbox[2] - p.bbox[0] > 8 &&
          p.bbox[3] - p.bbox[1] > 8,
      )
      .map(p => {
        const a = convert([p.bbox[0], p.bbox[1]], true),
          b = convert([p.bbox[2], p.bbox[3]], true);
        return {
          color: colour(p.fill),
          bounds: [
            Math.min(a[0], b[0]),
            Math.min(a[1], b[1]),
            Math.max(a[0], b[0]),
            Math.max(a[1], b[1]),
          ],
        };
      });
    const measurements = items
      .filter(i => /^\d+["”]$/.test(i.str) && inside(textCenter(i), table, 14))
      .map(i => parseInt(i.str, 10));
    assert.ok(measurements.length, `No printed measurements: ${name}`);
    assert.ok(
      measurements.every(n => n % 3 === 0),
      `Unsupported measurement grid: ${name}`,
    );
    for (const marker of markers) {
      for (const [offset, extent] of [
        [marker.x, width],
        [marker.y, height],
      ]) {
        if (offset !== 0)
          assert.ok(
            measurements.includes(extent / 2 + offset) ||
              measurements.includes(extent / 2 - offset),
            `Marker ${marker.number} does not match printed edge measurements: ${name}`,
          );
      }
    }
    result.push({
      name,
      width,
      height,
      markers,
      zones,
      sources: [{ file: source.file, url: source.url, sha256: source.sha256, page }],
    });
  }
  return result;
}

export async function parseDeploymentPdf(source) {
  const task = getDocument({
    data: source.bytes.slice(),
    useSystemFonts: true,
    cMapUrl: assets + 'cmaps/',
    cMapPacked: true,
    standardFontDataUrl: assets + 'standard_fonts/',
    verbosity: 0,
    isEvalSupported: false,
  });
  try {
    const doc = await task.promise,
      result = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n),
        { items } = await page.getTextContent();
      if (items.some(i => /^\d+×\d+[˝″"]$/.test(i.str)))
        result.push(
          ...parseDeploymentPage(items, extractPaths(await page.getOperatorList()), source, n),
        );
      page.cleanup();
    }
    return result;
  } finally {
    await task.destroy();
  }
}

export function reconcileDeployments(layouts) {
  const unique = new Map();
  for (const layout of layouts) {
    const old = unique.get(layout.name);
    if (old) {
      const shape = ({ name, width, height, markers, zones }) => ({
        name,
        width,
        height,
        markers,
        zones,
      });
      assert.deepEqual(shape(layout), shape(old), `Conflicting deployment copies: ${layout.name}`);
      old.sources.push(...layout.sources);
    } else unique.set(layout.name, layout);
  }
  assert.ok(unique.size, 'No deployments found; existing output was not replaced');
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}
