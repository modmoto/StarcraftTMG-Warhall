import assert from 'node:assert/strict';
import { sha256 } from '../io.mjs';
import { markerTerrains, markerMenuId } from './markers.mjs';

export const deploymentName = l => l.name;
export const sharedDeploymentTemplateId = 12;
export const overlayId = template => `sc_deployment_${template.deploymentID}`;
export const sharedDeployment = name => ({
  deploymentID: sharedDeploymentTemplateId,
  deploymentName: name,
  X: 0,
  Y: 0,
  showCenterline: false,
});
export const overlayPlacement = template => ({
  Name: overlayId(template),
  X: 0,
  Y: 0.02,
  Z: 0,
  IsToken: false,
});
export const overlayTerrain = template => ({
  Id: overlayId(template),
  Name: `Deployment lines - ${template.deploymentName}`,
  Type: 'Terrain',
  Description:
    'Decorative deployment entry lines. Automatically placed with the deployment; no filled deployment zones.',
  Width: 0.1,
  Length: 0.1,
  Shape: 1,
});
export function deploymentId(name) {
  // Reserved local/import IDs; refuse collisions rather than renumbering layouts.
  return 100000 + parseInt(sha256(name).slice(0, 6), 16);
}

export function deploymentTemplate(layout) {
  const edges = new Map();
  // Union pastel rectangles on a 3-inch grid. Shared edges disappear, leaving
  // the complete L-shaped or rectangular zone boundary as Warhall line segments.
  for (const zone of layout.zones) {
    const [x0, y0, x1, y1] = zone.bounds;
    assert.ok(
      x1 > x0 && y1 > y0 && Math.min(x1 - x0, y1 - y0) === 6,
      `Invalid six-inch influence zone: ${layout.name}`,
    );
    assert.ok(
      x0 >= -layout.width / 2 &&
        x1 <= layout.width / 2 &&
        y0 >= -layout.height / 2 &&
        y1 <= layout.height / 2,
      `Zone outside battlefield: ${layout.name}`,
    );
    for (let x = x0; x < x1; x += 3)
      for (let y = y0; y < y1; y += 3) {
        for (const [ax, ay, bx, by] of [
          [x, y, x + 3, y],
          [x + 3, y, x + 3, y + 3],
          [x, y + 3, x + 3, y + 3],
          [x, y, x, y + 3],
        ]) {
          const key = JSON.stringify([zone.color, ax, ay, bx, by]);
          edges.set(key, { color: zone.color, a: [ax, ay], b: [bx, by] });
        }
      }
  }
  // Derive a union from occupied cells, avoiding overlapping rectangles.
  const cells = new Map();
  for (const zone of layout.zones)
    for (let x = zone.bounds[0]; x < zone.bounds[2]; x += 3)
      for (let y = zone.bounds[1]; y < zone.bounds[3]; y += 3)
        cells.set(`${zone.color},${x},${y}`, true);
  const boundary = [];
  for (const [key, e] of edges) {
    const [ax, ay] = e.a,
      [bx, by] = e.b;
    const neighbour =
      ax === bx
        ? [
            [ax - 3, ay],
            [ax, ay],
          ]
        : [
            [ax, ay - 3],
            [ax, ay],
          ];
    const onBorder =
      ax === bx ? Math.abs(ax) === layout.width / 2 : Math.abs(ay) === layout.height / 2;
    if (onBorder && neighbour.filter(([x, y]) => cells.has(`${e.color},${x},${y}`)).length === 1)
      boundary.push({ ...e, key });
  }
  assert.ok(
    layout.zones.some(z => z.color === 'red') && layout.zones.some(z => z.color === 'blue'),
    `Missing entry zones: ${layout.name}`,
  );
  return {
    deploymentID: deploymentId(layout.name),
    deploymentName: layout.name,
    rotationAxis: 0,
    centerlineAxis: '0',
    lines: boundary
      .sort((a, b) => a.key.localeCompare(b.key, 'en'))
      .map(({ a, b, color }) => ({
        color,
        anchor: 'center',
        posX: String((a[0] + b[0]) / 2),
        posY: String((a[1] + b[1]) / 2),
        sizeX: String(Math.hypot(b[0] - a[0], b[1] - a[1])),
        rotationY: a[0] === b[0] ? '90' : '0',
        dummy: true,
      })),
  };
}

export function buildDeployments(layouts) {
  const ids = layouts.map(l => deploymentId(l.name));
  assert.equal(new Set(ids).size, ids.length, 'Deployment template ID collision');
  return {
    deployments: layouts.map(l => sharedDeployment(l.name)),
    objectives: [],
    deploymentTerrains: layouts.map((l, i) => ({
      DeploymentIndex: i + 1,
      Items: [
        ...l.markers.map(m => ({
          Name: markerMenuId(m),
          X: m.x * 2.54,
          Y: 0.04,
          Z: m.y * 2.54,
          IsToken: false,
        })),
        overlayPlacement(deploymentTemplate(l)),
      ],
    })),
    tokens: [],
    markerTerrains: markerTerrains(),
    overlayTerrains: layouts.map(l => overlayTerrain(deploymentTemplate(l))),
    templates: layouts.map(deploymentTemplate),
  };
}
