import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadThumbnail, thumbnailDataUrl } from '../src/models/thumbnails.mjs';
import { skinRequest, entryFingerprint } from '../src/models/catalogue.mjs';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);

test('thumbnail files become embedded image data in the API payload', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'warhall-thumbnails-'));
  try {
    await writeFile(path.join(directory, 'marine.png'), png);
    const entry = {
      profileId: 'marine',
      name: 'Marine',
      parts: [{ modelUrl: 'https://example.com/marine.obj', transforms: { scale: 1 } }],
    };
    const dataUrl = await loadThumbnail(entry, { directory, root: directory });
    assert.equal(dataUrl, `data:image/png;base64,${png.toString('base64')}`);
    assert.equal(
      skinRequest(entry, { thumbnailDataUrl: dataUrl }).body.thumbnail_data_url,
      dataUrl,
    );
    assert.equal(
      await loadThumbnail(
        { ...entry, thumbnailFile: 'marine.png' },
        { directory: '/unused', root: directory },
      ),
      dataUrl,
    );
    await assert.rejects(
      loadThumbnail({ profileId: 'missing', name: 'Missing' }, { directory, root: directory }),
      /missing thumbnail/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('new skins cannot silently omit thumbnails and invalid images fail locally', () => {
  assert.throws(() => skinRequest({ name: 'Marine', parts: [] }), /thumbnail data URL/);
  assert.throws(() => thumbnailDataUrl(Buffer.from('not an image')), /PNG, JPEG or WebP/);
  assert.throws(() => thumbnailDataUrl(Buffer.alloc(5 * 1024 * 1024 + 1)), /5 MiB/);
});

test('adding a preview file does not invalidate the saved model identity', () => {
  const entry = { profileId: 'marine', name: 'Marine', parts: [] };
  assert.equal(
    entryFingerprint(entry),
    entryFingerprint({ ...entry, thumbnailFile: 'previews/marine.png' }),
  );
});
