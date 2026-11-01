import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { markerTerrains, markerDiameterMm } from '../src/deployments/markers.mjs';
import { annulus, controlOuterRadiusMm } from '../src/deployments/marker-assets.mjs';

test('markers measure 32 mm while the visual ring extends three inches from their edge', () => {
  for (const marker of markerTerrains()) {
    assert.equal(marker.Width, 3.2);
    assert.equal(marker.Length, 3.2);
    assert.equal(marker.Shape, 1);
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

test('three control rings are skin geometry, not separately spawned interactive terrain', async () => {
  const catalogue = JSON.parse(await readFile(new URL('../model-catalogue.json', import.meta.url)));
  const markers = catalogue.entries.filter(entry => entry.kind === 'marker');
  assert.equal(markers.length, 3);
  for (const marker of markers) {
    assert.equal(marker.markerDiameterMm, 32);
    assert.equal(marker.controlOuterDiameterMm, 184.4);
    assert.equal(marker.parts.length, 1);
    assert.ok(Math.abs(marker.parts[0].transforms.scale * 2.54 - 1) < 1e-12);
    assert.ok(marker.parts[0].hostedAsset);
  }
  const config = JSON.parse(
    await readFile(new URL('../Starcraft/gameconfig.json', import.meta.url)),
  );
  assert.ok(
    config.DeploymentTerrains.every(layout =>
      layout.Items.every(item => /^sc_mission_(red|blue|green)$/.test(item.Name)),
    ),
  );
});
