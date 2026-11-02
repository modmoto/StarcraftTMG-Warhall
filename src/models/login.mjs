import { servers } from './servers.mjs';
import { defaultUsername, readSavedPassword } from './keychain.mjs';

export async function loginWarhall(serverUrl, { fetcher = fetch, email, password }) {
  const server = new URL(serverUrl);
  if (!Object.values(servers).includes(server.origin)) {
    throw new Error(
      'Interactive login supports the configured Warhall test and production origins only',
    );
  }
  const send = (url, options = {}) =>
    fetcher(url, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
  const page = await send(server);
  if (!page.ok) throw new Error('Could not load Warhall login configuration');
  const html = await page.text();
  const scripts = html.match(/<script\b[^>]*>/g) ?? [];
  const module = scripts.find(script => /type=["']module["']/.test(script));
  const source = module?.match(/src=["']([^"']+)["']/)?.[1];
  if (!source) throw new Error('Warhall frontend module not found');
  const moduleUrl = new URL(source, server);
  if (moduleUrl.origin !== server.origin) throw new Error('Unexpected login configuration origin');
  const configResponse = await send(moduleUrl);
  if (!configResponse.ok) throw new Error('Could not load Warhall frontend configuration');
  const config = await configResponse.text();
  const apiKey = config.match(/apiKey\s*:\s*["'](AIza[^"']+)["']/)?.[1];
  if (!apiKey) throw new Error('Warhall Firebase configuration not found');
  if (!email.includes('@')) {
    const lookup = await send(new URL(`/GetEmail/${encodeURIComponent(email)}`, server));
    const result = await lookup.json();
    if (!lookup.ok || result.error !== 0 || typeof result.result !== 'string') {
      throw new Error('Warhall username could not be resolved');
    }
    email = result.result;
  }
  const identity = await send(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const auth = await identity.json();
  if (!identity.ok || !auth.idToken) {
    throw new Error(
      'Warhall sign-in failed. Use the website if MFA, CAPTCHA or another interactive challenge is required.',
    );
  }
  const session = await send(new URL('/sessionLogin', server), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: auth.idToken }),
  });
  if (!session.ok) throw new Error('Warhall refused the session login');
  // Production clears the old session before setting its replacement. Sending
  // both same-name cookies makes some endpoints read the empty first value.
  const cookies = new Map();
  for (const header of session.headers.getSetCookie()) {
    const pair = header.split(';')[0];
    const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1));
  }
  const cookie = [...cookies]
    .filter(([, value]) => value.length > 0)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  if (!cookie) throw new Error('Warhall returned no session cookie');
  return cookie;
}

export async function promptLogin(
  serverUrl,
  { username = defaultUsername(), manual = false } = {},
) {
  if (!manual) {
    const saved = await readSavedPassword(serverUrl, username);
    if (saved !== null) return loginWarhall(serverUrl, { email: username, password: saved });
  }
  if (!process.stdin.isTTY)
    throw new Error(
      'No saved credential. Run npm run models:credentials in your terminal, or use --login in an interactive terminal.',
    );
  process.stdout.write(`Warhall ${new URL(serverUrl).hostname}: ${username}\n`);
  const password = await new Promise((resolve, reject) => {
    let value = '';
    process.stdout.write('Password (hidden): ');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const finish = () => {
      process.stdin.off('data', read);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const read = bytes => {
      for (const character of bytes.toString('utf8')) {
        if (character === '\u0003') {
          finish();
          reject(new Error('Login cancelled'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };
    process.stdin.on('data', read);
  });
  return loginWarhall(serverUrl, { email: username, password });
}
