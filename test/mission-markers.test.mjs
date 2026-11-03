import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  markerTerrains,
  markerDiameterMm,
  missionMarkers,
  markerProfileId,
  markerMenuId,
} from '../src/deployments/markers.mjs';
import {
  annulus,
  controlOuterRadiusMm,
  createMarkerGeometry,
} from '../src/deployments/marker-assets.mjs';

test('markers measure 32 mm while the visual ring extends three inches from their edge', () => {
  for (const marker of markerTerrains()) {
    assert.equal(marker.Width, 3.2);
    assert.equal(marker.Length, 3.2);
    assert.equal(marker.Shape, 1);
    assert.ok(
      !('SkinId' in marker),
      'Shared marker skins must resolve by profile instead of a pinned sword ID',
    );
  }
  assert.equal(markerDiameterMm, 32);
  assert.equal(controlOuterRadiusMm, 92.2);
  assert.ok(Math.abs(controlOuterRadiusMm - markerDiameterMm / 2 - 3 * 25.4) < 1e-10);
  const mesh = annulus(1.6, 9.22, 0.025);
  assert.ok(
    mesh.vertices.every(
      ([x, , z]) => Math.hypot(x, z) >= 1.6 - 1e-10 && Math.hypot(x, z) <= 9.22 + 1e-10,
    ),
  );
});

test('five mission marker assignments use open control ring geometry, not separately spawned interactive terrain', async () => {
  const catalogue = JSON.parse(await readFile(new URL('../model-catalogue.json', import.meta.url)));
  const markers = catalogue.entries.filter(entry => entry.kind === 'marker');
  assert.equal(markers.length, 5);
  for (const marker of markers) {
    assert.equal(marker.markerDiameterMm, 32);
    assert.equal(marker.controlOuterDiameterMm, 184.4);
    assert.equal(marker.parts.length, 1);
    assert.ok(Math.abs(marker.parts[0].transforms.scale * 2.54 - 1) < 1e-12);
    assert.ok(marker.parts[0].hostedAsset);
  }
  const config = JSON.parse(
    await readFile(new URL('../Starcraft-test/gameconfig.json', import.meta.url)),
  );
  assert.ok(
    config.DeploymentTerrains.every(layout =>
      layout.Items.every(
        item =>
          missionMarkers.some(marker => markerMenuId(marker) === item.Name) ||
          item.Name.startsWith('Starcraft - Terrain - Deployment - '),
      ),
    ),
  );
});

test('control rings stay open outside their decorated 32mm center', () => {
  const meshes = createMarkerGeometry({ color: 'blue', number: 2 });
  assert.equal(meshes.length, 4);
  const outline = meshes.find(mesh => mesh.role === 'outline');
  assert.ok(
    outline.vertices.every(([x, , z]) => Math.hypot(x, z) > 4 && Math.hypot(x, z) <= 9.22 + 1e-9),
  );
  assert.ok(meshes.every(mesh => mesh.role !== 'number'));
  for (const mesh of meshes.filter(mesh => mesh.role !== 'outline')) {
    assert.ok(mesh.vertices.every(([x, , z]) => Math.hypot(x, z) <= 1.6));
  }
  assert.deepEqual(
    [...meshes.find(mesh => mesh.role === 'center').texture.data],
    [24, 103, 208, 255],
  );
  for (const mesh of meshes) {
    assert.equal(mesh.texture.data.length, 4);
    assert.equal(mesh.texture.data[3], 255);
    assert.equal(mesh.unlit, true);
  }
  const covers = (x, z) =>
    outline.faces.some(face => {
      const [a, b, c] = face.map(i => outline.vertices[i]);
      const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      if (Math.abs(d) < 1e-12) return false;
      const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
      const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
      return u >= 0 && v >= 0 && u + v <= 1;
    });
  for (const [x, z] of [
    [0, 0],
    [3, 0],
    [0, 3],
    [5, 5],
  ])
    assert.equal(covers(x, z), false);
});
test('each deployment references the correct numbered marker while keeping the 32mm footprint', async () => {
  const report = JSON.parse(await readFile(new URL('../deployment-report.json', import.meta.url)));
  const config = JSON.parse(
    await readFile(new URL('../Starcraft-test/gameconfig.json', import.meta.url)),
  );
  for (const [index, layout] of report.layouts.entries()) {
    const items = config.DeploymentTerrains.find(row => row.DeploymentIndex === index + 1).Items;
    for (const marker of layout.markers)
      assert.ok(
        items.some(
          item =>
            item.Name === markerMenuId(marker) &&
            item.IsToken === false &&
            item.X === marker.x * 2.54 &&
            item.Z === marker.y * 2.54,
        ),
      );
  }
  assert.deepEqual(
    missionMarkers.map(marker => [marker.number, marker.color]),
    [
      [1, 'red'],
      [2, 'blue'],
      [3, 'red'],
      [4, 'blue'],
      [5, 'green'],
    ],
  );
  assert.throws(() => markerProfileId({ number: 3, color: 'blue' }), /Unknown mission marker/);
});
