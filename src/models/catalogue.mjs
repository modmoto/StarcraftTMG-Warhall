import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';

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
  const { thumbnailFile, ...definition } = entry;
  return createHash('sha256').update(JSON.stringify(definition)).digest('hex');
}

export function skinRequest(entry, { defaultScale = false, thumbnailDataUrl } = {}) {
  assert.match(
    thumbnailDataUrl ?? '',
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
    'A thumbnail data URL is required for new skins',
  );
  const parts = entry.parts.map(part => ({
    model_url: part.modelUrl,
    texture_url: part.textureUrl ?? null,
    transforms: defaultScale && !entry.calibration ? null : part.transforms,
  }));
  const body = { skin_name: entry.name, is_public: 1, thumbnail_data_url: thumbnailDataUrl };
  if (parts.length > 1) {
    return { path: '/api/tripo/create-and-link-skin-multipart', body: { ...body, parts } };
  }
  return {
    path: '/api/tripo/create-and-link-skin',
    body: { ...body, ...parts[0], model_size: parts[0].transforms?.scale ?? 1 },
  };
}

async function ownedSkins(request) {
  const skins = [];
  for (let page = 1; ; page++) {
    const response = await request(
      `/GetCatalogueSkins?viewMode=mine&page=${page}&perPage=200&sortOrder=newest`,
    );
    assert.ok(
      response.error === 0 && Array.isArray(response.result?.skins),
      'Invalid owned catalogue response',
    );
    assert.ok(
      Number.isSafeInteger(response.result.total) && response.result.total >= 0,
      'Invalid catalogue count',
    );
    skins.push(...response.result.skins);
    if (skins.length >= response.result.total)
      return new Map(skins.map(skin => [Number(skin.id), skin]));
    assert.ok(response.result.skins.length, 'Incomplete owned catalogue response');
  }
}

export async function publishCatalogue(
  catalogue,
  {
    request,
    state,
    save,
    log = () => {},
    defaultScale = false,
    getThumbnail = async () => undefined,
    replace = false,
  },
) {
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
  const usages = await request('/GetMySkinUsages');
  assert.ok(usages.error === 0 && Array.isArray(usages.result), 'Invalid skin usage response');
  const owned = await ownedSkins(request);
  const scope = `${catalogue.serverUrl}|${game.IdGame}`;
  assert.ok(
    !state.scope || state.scope === scope,
    'Publication state belongs to another server/game',
  );
  state.scope = scope;
  state.entries ??= {};
  if (!state.batch || state.batch.complete || state.batch.replace !== replace) {
    state.batch = { id: randomUUID(), replace, complete: false };
    await save(state);
  }
  const exactUsage = (entry, skinId) =>
    usages.result.some(
      usage =>
        Number(usage.skinId) === skinId &&
        usage.profileId === entry.profileId &&
        Number(usage.gameId) === Number(game.IdGame) &&
        Number(usage.costumeDefault) === 1 &&
        !usage.optionNames?.length,
    );
  const cleanup = async (entry, progress) => {
    for (const skinId of [...(progress.previousSkinIds ?? [])]) {
      const sharedElsewhere = usages.result.some(
        usage =>
          Number(usage.skinId) === skinId &&
          (usage.profileId !== entry.profileId || Number(usage.gameId) !== Number(game.IdGame)),
      );
      if (sharedElsewhere)
        log(`${entry.name}: retained old skin ${skinId}, used by another profile`);
      else if (owned.has(skinId)) {
        const response = await request('/DeleteMySkin', { skinId });
        assert.equal(response.error, 0, `Could not delete old skin ${skinId}`);
        owned.delete(skinId);
        log(`${entry.name}: deleted old skin ${skinId}`);
      }
      progress.previousSkinIds = progress.previousSkinIds.filter(id => id !== skinId);
      await save(state);
    }
  };
  for (const entry of catalogue.entries) {
    const fingerprint = entryFingerprint(
      defaultScale && !entry.calibration
        ? { ...entry, parts: entry.parts?.map(part => ({ ...part, transforms: null })) }
        : entry,
    );
    let progress = state.entries[entry.profileId];
    if (progress?.creating)
      throw new Error(
        `Creation outcome unknown for ${entry.profileId}; reconcile the saved state with Warhall before retrying`,
      );
    let knownId = progress?.skinId ?? entry.existingSkinId ?? entry.replacesNativeSkinId;
    // Another publishing machine may have the checkpoint. Reconcile owned shared defaults first.
    if (!progress && entry.parts?.length && (!knownId || !owned.has(knownId))) {
      const matches = [
        ...new Set(
          usages.result
            .filter(
              usage =>
                usage.profileId === entry.profileId &&
                Number(usage.gameId) === Number(game.IdGame) &&
                Number(usage.costumeDefault) === 1 &&
                !usage.optionNames?.length &&
                owned.has(Number(usage.skinId)),
            )
            .map(usage => Number(usage.skinId)),
        ),
      ];
      assert.ok(
        matches.length <= 1,
        `Multiple owned defaults for ${entry.profileId}; reconcile before replacing`,
      );
      if (matches.length) knownId = matches[0];
    }
    const menuAlias = ['token', 'terrain', 'marker', 'deployment'].includes(entry.kind)
      ? entry.name
      : null;
    if (menuAlias) {
      const aliases = usages.result.filter(
        usage =>
          usage.profileId === menuAlias &&
          Number(usage.gameId) === Number(game.IdGame) &&
          Number(usage.costumeDefault) === 1 &&
          !usage.optionNames?.length,
      );
      const allowed = new Set([knownId, ...(progress?.previousSkinIds ?? [])]);
      assert.ok(
        aliases.every(usage => allowed.has(Number(usage.skinId))),
        `Conflicting menu assignment: ${menuAlias}`,
      );
    }
    if (!entry.parts?.length) {
      assert.ok(knownId, `Native skin reference missing: ${entry.profileId}`);
      if (!exactUsage(entry, knownId)) {
        const response = await request('/AssignCatalogueSkin', {
          skinId: knownId,
          profileId: entry.profileId,
          gameId: game.IdGame,
          selectedOptions: [],
          costumeDefault: 1,
          mode: 'add',
        });
        assert.equal(response.error, 0, `Could not assign native skin ${knownId}`);
      }
      state.entries[entry.profileId] = { fingerprint, skinId: knownId, assigned: true };
      await save(state);
      continue;
    }
    const exists = knownId && (owned.has(knownId) || exactUsage(entry, knownId));
    const force = replace && progress?.replacementRun !== state.batch.id;
    const changed = progress && progress.fingerprint !== fingerprint;
    let thumbnailDataUrl;
    let thumbnailHash;
    if (force || changed || !exists || (progress?.assigned && progress.thumbnailHash)) {
      thumbnailDataUrl = await getThumbnail(entry);
      assert.ok(thumbnailDataUrl, `Missing thumbnail for ${entry.name}`);
      thumbnailHash = createHash('sha256').update(thumbnailDataUrl).digest('hex');
    }
    const imageChanged =
      thumbnailHash && progress?.thumbnailHash && thumbnailHash !== progress.thumbnailHash;
    const nativeVisualReplacement =
      entry.replacesNativeSkinId !== undefined && knownId === entry.replacesNativeSkinId;
    const needsCreate = !exists || force || changed || imageChanged || nativeVisualReplacement;
    if (needsCreate) {
      if (exists && !owned.has(knownId) && entry.replacesNativeSkinId !== knownId)
        throw new Error(`Cannot replace skin ${knownId}: it is not in your owned catalogue`);
      thumbnailDataUrl ??= await getThumbnail(entry);
      thumbnailHash ??= createHash('sha256')
        .update(thumbnailDataUrl ?? '')
        .digest('hex');
      const payload = skinRequest(entry, { defaultScale, thumbnailDataUrl });
      const previousSkinIds = [
        ...new Set([
          ...(progress?.previousSkinIds ?? []),
          ...(exists && owned.has(knownId) && entry.replacesNativeSkinId !== knownId
            ? [knownId]
            : []),
        ]),
      ];
      progress = state.entries[entry.profileId] = {
        fingerprint,
        creating: true,
        previousSkinIds,
        replacementRun: state.batch.id,
        thumbnailHash,
        replacesAssignment: Boolean(exists),
      };
      await save(state);
      const response = await request(payload.path, payload.body);
      const skinId = response.result?.skin_id;
      assert.ok(Number.isSafeInteger(skinId) && skinId > 0, 'Server returned no skin ID');
      progress.skinId = skinId;
      progress.creating = false;
      progress.assigned = false;
      owned.set(skinId, { id: skinId, name: entry.name });
      await save(state);
    } else if (!progress) {
      progress = state.entries[entry.profileId] = { fingerprint, skinId: knownId, assigned: false };
    }
    if (exactUsage(entry, progress.skinId)) {
      progress.assigned = true;
      await save(state);
      log(`${entry.name}: existing shared assignment verified (${progress.skinId})`);
    } else {
      const response = await request('/AssignCatalogueSkin', {
        skinId: progress.skinId,
        profileId: entry.profileId,
        gameId: game.IdGame,
        selectedOptions: [],
        costumeDefault: 1,
        mode:
          progress.previousSkinIds?.length || progress.replacesAssignment || replace
            ? 'override'
            : 'add',
      });
      assert.equal(response.error, 0, `Could not assign skin ${progress.skinId}`);
      progress.assigned = true;
      await save(state);
      log(`${entry.name}: skin ${progress.skinId} assigned`);
    }
    if (menuAlias && !exactUsage({ profileId: menuAlias }, progress.skinId)) {
      const response = await request('/AssignCatalogueSkin', {
        skinId: progress.skinId,
        profileId: menuAlias,
        gameId: game.IdGame,
        selectedOptions: [],
        costumeDefault: 1,
        mode: 'override',
      });
      assert.equal(response.error, 0, `Could not assign menu skin ${menuAlias}`);
      // Reflect the reassignment before old-skin cleanup checks references to other profiles.
      usages.result = usages.result.filter(
        usage =>
          !(
            usage.profileId === menuAlias &&
            Number(usage.gameId) === Number(game.IdGame) &&
            Number(usage.costumeDefault) === 1 &&
            !usage.optionNames?.length
          ),
      );
      usages.result.push({
        skinId: progress.skinId,
        profileId: menuAlias,
        gameId: game.IdGame,
        costumeDefault: 1,
        optionNames: [],
      });
      log(`${entry.name}: editor menu assignment updated`);
    }
    await cleanup(entry, progress);
  }
  state.batch.complete = true;
  await save(state);
  return state;
}
