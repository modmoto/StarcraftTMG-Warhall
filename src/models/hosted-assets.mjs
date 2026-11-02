export async function verifyHostedAssets(catalogue, fetcher = fetch) {
  const urls = [
    ...new Set(
      catalogue.entries.flatMap(entry =>
        (entry.parts ?? []).flatMap(part => [
          ...(part.hostedAsset ? [part.modelUrl] : []),
          ...(/^https:\/\/raw\.githubusercontent\.com\/modmoto\/StarcraftTMG-Warhall\/(?:refs\/heads\/)?(?:main|test)\/model-assets\//.test(
            part.textureUrl ?? '',
          )
            ? [part.textureUrl]
            : []),
        ]),
      ),
    ),
  ];
  const results = await Promise.allSettled(
    urls.map(async url => {
      const response = await fetcher(url, { method: 'HEAD', signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    }),
  );
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) {
    throw new Error(
      `Portable model assets are not available online. Push the model-assets directory and catalogue to GitHub before publishing skins.\n${failures.map(result => result.reason.message).join('\n')}`,
    );
  }
}
