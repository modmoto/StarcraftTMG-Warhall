import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {
  parseObj,
  renderGeometry,
  generateThumbnail,
  renderFingerprint,
} from '../src/models/render-thumbnail.mjs';

const obj =
  'v -1 0 0\nv 1 0 0\nv 1 2 0\nv -1 2 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nf -4/-4 -3/-3 -2/-2 -1/-1\n';

test('OBJ polygons and negative UV indices produce visible textured model previews', async () => {
  const mesh = parseObj(obj);
  assert.equal(mesh.faces.length, 2);
  assert.deepEqual(mesh.textureFaces, [
    [0, 1, 2],
    [0, 2, 3],
  ]);
  mesh.texture = { width: 1, height: 1, data: Buffer.from([255, 0, 0, 255]) };
  const png = await renderGeometry([mesh]);
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let redPixels = 0;
  for (let i = 0; i < data.length; i += 4)
    if (data[i] > 90 && data[i + 1] === 0 && data[i + 2] === 0) redPixels++;
  assert.ok(redPixels > 10000);
  assert.throws(() => parseObj('v 0 0 0'), /Invalid or empty/);
});

test('generation downloads the selected geometry, writes PNG and retains a render fingerprint', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'warhall-render-'));
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response(obj);
  };
  try {
    const entry = {
      profileId: 'fixture',
      name: 'Fixture',
      parts: [{ modelUrl: 'https://example.com/fixture.obj' }],
    };
    const options = {
      directory,
      cacheDirectory: path.join(directory, 'assets'),
      defaultScale: true,
    };
    await generateThumbnail(entry, options);
    const bytes = await readFile(path.join(directory, 'fixture.png'));
    assert.equal((await sharp(bytes).metadata()).format, 'png');
    const metadata = JSON.parse(
      await readFile(path.join(directory, 'fixture.png.render.json'), 'utf8'),
    );
    assert.equal(metadata.fingerprint, renderFingerprint(entry, true));
    await generateThumbnail(entry, options);
    assert.equal(requests, 1);
    assert.notEqual(
      renderFingerprint(entry, true),
      renderFingerprint({ ...entry, parts: [{ modelUrl: 'https://example.com/new.obj' }] }, true),
    );
  } finally {
    globalThis.fetch = original;
    await rm(directory, { recursive: true, force: true });
  }
});
