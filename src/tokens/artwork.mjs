import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const symbols = {
  arrow: '<path d="M256 102 378 242H310V374H202V242H134Z"/>',
  crosshair:
    '<g fill="none" stroke="currentColor" stroke-width="22"><path d="M168 176V142H222M290 142H344V196M344 290V344H290M222 344H168V290M256 102V204M256 282V384M114 244H216M296 244H398"/><path d="M236 224H276V264H236Z" fill="currentColor" stroke="none"/></g>',
  buff: '<path d="M256 112 367 234H302V324H210V234H145Z"/><path d="M172 350H340V374H172Z"/>',
  debuff: '<path d="M256 374 367 252H302V162H210V252H145Z"/><path d="M172 112H340V136H172Z"/>',
  stim: '<path d="M279 102 160 265H241L220 369 356 204H275Z"/>',
  burrowed:
    '<path d="M218 112H294V224H348L256 322 164 224H218Z"/><path d="M124 348 174 321 220 348 266 321 312 348 362 321 393 349V376H124Z"/>',
  hidden:
    '<g fill="none" stroke="currentColor" stroke-width="20"><path d="M112 244Q256 76 400 244Q256 412 112 244Z"/><circle cx="256" cy="244" r="53"/><path d="M132 368 380 120" stroke-width="28"/></g>',
  siege:
    '<path d="M146 278H366L394 336 362 364H150L118 336Z"/><path d="M174 214H302L339 250H174Z"/><path d="M278 216 353 119 380 140 308 242Z"/><circle cx="164" cy="332" r="13" fill="#10202d"/><circle cx="348" cy="332" r="13" fill="#10202d"/>',
};
const labels = { stim: 'STIM', burrowed: 'BURROWED', hidden: 'HIDDEN', siege: 'SIEGE' };

async function logoImage(root, name, color) {
  const { data, info } = await sharp(
    await readFile(path.join(root, `token-artwork/factions/${name}.png`)),
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgb = color.match(/[a-f0-9]{2}/gi).map(value => parseInt(value, 16));
  for (let i = 0; i < data.length; i += 4) [data[i], data[i + 1], data[i + 2]] = rgb;
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

export async function factionLogo(root, name, color) {
  return logoImage(root, name, color);
}

export async function tokenImage(root, token, side) {
  const symbol = token[side];
  const accent = side === 'back' ? (token.backColor ?? token.color) : token.color;
  const background = token.inverted ? '#f7f6ee' : accent;
  const ink = token.inverted ? accent : '#ffffff';
  const logo = !symbols[symbol]
    ? `<image x="120" y="105" width="272" height="272" href="data:image/png;base64,${(await logoImage(root, symbol, ink)).toString('base64')}"/>`
    : `<g color="${ink}" fill="${ink}">${symbols[symbol]}</g>`;
  const label = labels[symbol];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
    <circle cx="256" cy="256" r="252" fill="#101b27"/>
    <circle cx="256" cy="256" r="229" fill="${background}"/>
    <circle cx="256" cy="256" r="214" fill="none" stroke="${ink}" stroke-width="5"/>
    <g fill="${ink}"><path d="M242 36H270V50H242ZM242 462H270V476H242ZM36 242H50V270H36ZM462 242H476V270H462Z"/></g>
    ${label ? `<g transform="translate(40 17) scale(.84)">${logo}</g><text x="256" y="421" text-anchor="middle" fill="${ink}" font-family="monospace" font-size="31" font-weight="bold" letter-spacing="3">${label}</text>` : logo}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
