export const servers = {
  test: 'https://apptest.warhall.eu',
  prod: 'https://www.warhall.eu',
};

export function publicationTarget(catalogue, target = 'test') {
  const serverUrl = servers[target] ?? target.replace(/\/$/, '');
  if (!Object.values(servers).includes(serverUrl)) {
    throw new Error('Use --server test|prod or the corresponding HTTPS Warhall URL');
  }
  const sourceServer = catalogue.serverUrl.replace(/\/$/, '');
  const gameName =
    catalogue.gameNames?.[serverUrl === servers.test ? 'test' : 'prod'] ?? catalogue.gameName;
  const entries = structuredClone(catalogue.entries);
  const excluded = [];
  const scoped = entries.filter(entry => {
    if (sourceServer !== serverUrl) delete entry.replacesNativeSkinId;
    if (sourceServer === serverUrl || !entry.existingSkinId) return true;
    if (entry.parts?.length) {
      delete entry.existingSkinId;
      return true;
    }
    excluded.push(entry.profileId);
    return false;
  });
  return {
    catalogue: { ...catalogue, gameName, serverUrl, entries: scoped },
    stateFile:
      serverUrl === servers.test
        ? gameName === catalogue.gameName
          ? '.cache/model-publication.json'
          : `.cache/model-publication-${gameName.toLowerCase().replace(/[^a-z0-9-]/g, '_')}.json`
        : '.cache/model-publication-prod.json',
    excluded,
  };
}
