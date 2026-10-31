import test from 'node:test';
import assert from 'node:assert/strict';
import { loginWarhall } from '../src/models/login.mjs';
import { skinRequest } from '../src/models/catalogue.mjs';

test('Warhall login follows Firebase and session exchange without persisting credentials', async () => {
  const calls = [];
  const fetcher = async (input, options) => {
    const url = String(input);
    calls.push({ url, options });
    if (url.endsWith('/'))
      return new Response('<script type="module" src="/assets/index.js"></script>');
    if (url.endsWith('/assets/index.js'))
      return new Response('const config={apiKey:"AIzaPublicTestConfiguration"}');
    if (url.includes('/GetEmail/')) return Response.json({ error: 0, result: 'test@example.com' });
    if (url.includes('identitytoolkit.googleapis.com'))
      return Response.json({ idToken: 'test-token' });
    if (url.endsWith('/sessionLogin'))
      return new Response('{}', {
        headers: { 'Set-Cookie': 'session=test; HttpOnly; Secure; Path=/' },
      });
    throw new Error('Unexpected URL');
  };
  assert.equal(
    await loginWarhall('https://apptest.warhall.eu', {
      fetcher,
      email: 'testuser',
      password: 'test-password',
    }),
    'session=test',
  );
  const credentialRequests = calls.filter(call => call.options.body?.includes('test-password'));
  assert.equal(credentialRequests.length, 1);
  assert.ok(credentialRequests[0].url.startsWith('https://identitytoolkit.googleapis.com/'));
  assert.ok(calls.every(call => call.options.redirect === 'error'));
  await assert.rejects(
    loginWarhall('https://example.com', { fetcher, email: 'x', password: 'x' }),
    /configured Warhall/,
  );
});

test('default-scale upload omits legacy transforms for single and multipart models', () => {
  const entry = {
    name: 'Test',
    parts: [
      { modelUrl: 'https://example.com/model.obj', transforms: { scale: 150, positionX: 5 } },
    ],
  };
  const thumbnailDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const single = skinRequest(entry, { defaultScale: true, thumbnailDataUrl });
  assert.equal(single.body.model_size, 1);
  assert.equal(single.body.transforms, null);
  const multipart = skinRequest(
    { ...entry, parts: [...entry.parts, ...entry.parts] },
    { defaultScale: true, thumbnailDataUrl },
  );
  assert.ok(multipart.body.parts.every(part => part.transforms === null));
});

test('publication defaults to test and isolates production references and progress', async () => {
  const { publicationTarget } = await import('../src/models/servers.mjs');
  const source = {
    serverUrl: 'https://apptest.warhall.eu',
    entries: [
      {
        profileId: 'marine',
        existingSkinId: 12999,
        parts: [{ modelUrl: 'https://example.com/marine.obj' }],
      },
      { profileId: 'marker', existingSkinId: 6201 },
    ],
  };
  assert.equal(publicationTarget(source).catalogue.serverUrl, source.serverUrl);
  for (const option of ['prod', 'https://www.warhall.eu/']) {
    const target = publicationTarget(source, option);
    assert.equal(target.catalogue.entries[0].existingSkinId, undefined);
    assert.deepEqual(target.excluded, ['marker']);
    assert.match(target.stateFile, /prod/);
  }
  assert.equal(source.entries[0].existingSkinId, 12999);
  assert.throws(() => publicationTarget(source, 'https://example.com'), /--server/);
});
