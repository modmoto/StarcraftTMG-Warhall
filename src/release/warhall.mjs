import { promptLogin } from '../models/login.mjs';
import { servers } from '../models/servers.mjs';
import { hasSavedPassword } from '../models/keychain.mjs';

export async function warhallSession(branch) {
  const server = branch === 'test' ? servers.test : servers.prod;
  if (!(await hasSavedPassword(server)))
    throw new Error(
      `Save the ${branch === 'test' ? 'test' : 'production'} Warhall login once in your own terminal: npm run models:credentials -- --server ${branch === 'test' ? 'test' : 'prod'}`,
    );
  const cookie = await promptLogin(server);
  const legacyCookie =
    cookie
      .split(';')
      .map(part => part.trim())
      .find(part => part.startsWith('__session='))
      ?.slice('__session='.length) ?? cookie;
  const request = async endpoint => {
    const response = await fetch(new URL(endpoint, server), {
      headers: { Cookie: cookie },
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Warhall preflight failed: ${response.status}`);
    return response.json();
  };
  const listing = await request('/GetGamesWeb/');
  const game = listing.games?.find(entry => entry.GameName === 'Starcraft');
  if (!game) throw new Error(`Register the Starcraft game on ${server} before the first release`);
  const admin = await request(`/IsAdmin/${game.IdGame}`);
  if (Number(admin?.[0]?.IsAdmin) !== 1)
    throw new Error(`Starcraft administrator access is required on ${server}`);
  return {
    async pointToBranch() {
      const url = `https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/${branch}/Starcraft/manifest.json`;
      const current = await request(`/GetGameLTSPath/${game.IdGame}`);
      const normalize = value => value.replace('/refs/heads/', '/');
      if (current.error === 0 && normalize(current.result) === url) return;
      const response = await fetch(new URL('/UpdateGameDataPath/', server), {
        method: 'POST',
        headers: { Cookie: cookie, cookiewarhall: legacyCookie },
        body: new URLSearchParams({ idGame: String(game.IdGame), dataPath: url }),
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok || (await response.text()).trim() === 'False')
        throw new Error(`Warhall refused the ${branch} manifest change`);
      const updated = await request(`/GetGameLTSPath/${game.IdGame}`);
      if (updated.error !== 0 || normalize(updated.result) !== url)
        throw new Error(`Warhall did not retain the ${branch} manifest URL`);
      console.log(`Starcraft on ${server} now reads ${branch}.`);
    },
  };
}
