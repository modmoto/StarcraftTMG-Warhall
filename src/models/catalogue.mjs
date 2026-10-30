import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function transforms(layout = {}, fallbackScale = 1) {
  const scale = layout.size ?? Math.abs(fallbackScale);
  const position = layout.position ?? [0, 0, 0];
  const rotation = layout.rotation ?? [0, 0, 0];
  assert.ok(Number.isFinite(scale) && scale > 0, 'Scale must be positive');
  for (const vector of [position, rotation]) {
    assert.ok(vector.length === 3 && vector.every(Number.isFinite), 'Invalid transform');
  }
  return {
    scale,
    rotationX: rotation[0],
    rotationY: rotation[1],
    rotationZ: rotation[2],
    positionX: position[0],
    positionY: position[1],
    positionZ: position[2],
  };
}

export function validateCatalogue(catalogue) {
  assert.equal(catalogue.schemaVersion, 1, 'Unsupported catalogue schema');
  assert.equal(new URL(catalogue.serverUrl).protocol, 'https:');
  const ids = new Set();
  for (const entry of catalogue.entries) {
    assert.ok(entry.profileId && !ids.has(entry.profileId), 'Missing or duplicate profile ID');
    ids.add(entry.profileId);
    if (entry.existingSkinId !== undefined) {
      assert.ok(Number.isSafeInteger(entry.existingSkinId) && entry.existingSkinId > 0);
      continue;
    }
    assert.ok(entry.parts?.length, `Missing parts: ${entry.name}`);
    for (const part of entry.parts) {
      for (const url of [part.modelUrl, part.textureUrl].filter(Boolean)) {
        assert.equal(new URL(url).protocol, 'https:', 'Assets must use HTTPS');
      }
      assert.ok(part.modelUrl, 'Missing model URL');
      const t = part.transforms;
      assert.ok(t && Object.values(t).every(Number.isFinite) && t.scale > 0);
    }
  }
  return catalogue;
}

export function entryFingerprint(entry) {
  return createHash('sha256').update(JSON.stringify(entry)).digest('hex');
}

export function skinRequest(entry) {
  const parts = entry.parts.map(part => ({
    model_url: part.modelUrl,
    texture_url: part.textureUrl ?? null,
    transforms: part.transforms,
  }));
  const body = { skin_name: entry.name, is_public: 1, thumbnail_data_url: null };
  if (parts.length > 1) {
    return { path: '/api/tripo/create-and-link-skin-multipart', body: { ...body, parts } };
  }
  return {
    path: '/api/tripo/create-and-link-skin',
    body: { ...body, ...parts[0], model_size: parts[0].transforms.scale },
  };
}

export async function publishCatalogue(catalogue, { request, state, save, log = () => {} }) {
  validateCatalogue(catalogue);
  const listing = await request('/GetGamesWeb/');
  assert.ok(listing.success && Array.isArray(listing.games), 'Invalid games response');
  const game = listing.games.find(game => game.GameName === catalogue.gameName);
  assert.ok(game, `Game not found: ${catalogue.gameName}`);
  const admin = await request(`/IsAdmin/${game.IdGame}`);
  assert.equal(
    Number(admin?.[0]?.IsAdmin),
    1,
    'Game administrator access is required for shared defaults',
  );
  const scope = `${catalogue.serverUrl}|${game.IdGame}`;
  assert.ok(
    !state.scope || state.scope === scope,
    'Publication state belongs to another server/game',
  );
  state.scope = scope;
  state.entries ??= {};
  for (const entry of catalogue.entries) {
    const fingerprint = entryFingerprint(entry);
    let progress = state.entries[entry.profileId];
    if (progress && progress.fingerprint !== fingerprint) {
      throw new Error(`Definition changed for ${entry.profileId}; review its saved state first`);
    }
    if (progress?.creating) {
      throw new Error(
        `Creation outcome unknown for ${entry.profileId}; reconcile the saved state with Warhall before retrying`,
      );
    }
    if (progress?.assigned) continue;
    if (!progress) {
      let skinId = entry.existingSkinId;
      if (!skinId) {
        const payload = skinRequest(entry);
        state.entries[entry.profileId] = { fingerprint, creating: true };
        await save(state);
        const response = await request(payload.path, payload.body);
        skinId = response.result?.skin_id;
        assert.ok(Number.isSafeInteger(skinId) && skinId > 0, 'Server returned no skin ID');
      }
      progress = state.entries[entry.profileId] = { fingerprint, skinId, assigned: false };
      await save(state);
    }
    await request('/AssignCatalogueSkin', {
      skinId: progress.skinId,
      profileId: entry.profileId,
      gameId: game.IdGame,
      selectedOptions: [],
      costumeDefault: 1,
      mode: 'add',
    });
    progress.assigned = true;
    await save(state);
    log(`${entry.name}: skin ${progress.skinId} assigned`);
  }
  return state;
}
