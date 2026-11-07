import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const arrow = '<path d="M256 102 378 242H310V374H202V242H134Z"/>';

function shieldRaster() {
  const radius = 80;
  const height = Math.sqrt(3) * radius;
  const cells = [];
  for (let column = -2; column <= 2; column++) {
    for (let row = -2; row <= 2; row++) {
      const x = 256 + column * radius * 1.5;
      const y = 256 + height * (row + column / 2);
      const points = Array.from({ length: 6 }, (_, corner) => {
        const angle = (corner * Math.PI) / 3;
        return `${x + radius * Math.cos(angle)},${y + radius * Math.sin(angle)}`;
      }).join(' ');
      cells.push(`<polygon points="${points}"/>`);
    }
  }
  return `<defs><clipPath id="shield-grid"><circle cx="256" cy="256" r="210"/></clipPath></defs><g clip-path="url(#shield-grid)" fill="none" stroke="currentColor" stroke-width="9" stroke-linejoin="round">${cells.join('')}</g>`;
}

const symbols = {
  bile_bomb:
    '<path d="M256 93C226 150 174 201 174 269a82 82 0 0 0 164 0c0-68-52-119-82-176Z"/><path d="M216 257q-10 49 36 64" fill="none" stroke="#487527" stroke-width="13" stroke-linecap="round"/>',
  creep_tumor:
    '<path d="M256 116c42 0 65 31 71 62l47 23-21 38 25 54-39 20-13 57-43-15-27 33-27-33-43 15-13-57-39-20 25-54-21-38 47-23c6-31 29-62 71-62Z"/><circle cx="256" cy="250" r="52" fill="#77368d"/><circle cx="256" cy="250" r="24"/>',
  shield: shieldRaster(),
  arrow,
  crosshair:
    '<g fill="none" stroke="currentColor" stroke-width="22"><path d="M168 176V142H222M290 142H344V196M344 290V344H290M222 344H168V290M256 102V204M256 282V384M114 244H216M296 244H398"/><path d="M236 224H276V264H236Z" fill="currentColor" stroke="none"/></g>',
  buff: '<path d="M279 102 160 265H241L220 369 356 204H275Z"/>',
  debuff: '<path d="M279 102 160 265H241L220 369 356 204H275Z"/>',
  stim: '<g transform="rotate(40 256 244)"><path d="M208 100H304V120H266V166H246V120H208ZM202 162H310V180H202Z"/><rect x="226" y="187" width="60" height="124" rx="7" fill="none" stroke="currentColor" stroke-width="16"/><path d="M232 316H280L256 346Z"/><path d="M256 340V398M234 214H256M234 246H256M234 278H256" fill="none" stroke="currentColor" stroke-width="10"/></g>',
  burrowed:
    '<path d="M218 112H294V224H348L256 322 164 224H218Z"/><path d="M124 348 174 321 220 348 266 321 312 348 362 321 393 349V376H124Z"/>',
  hidden:
    '<g fill="none" stroke="currentColor" stroke-width="20"><path d="M112 244Q256 76 400 244Q256 412 112 244Z"/><circle cx="256" cy="244" r="53"/><path d="M132 368 380 120" stroke-width="28"/></g>',
  siege:
    '<path d="M146 278H366L394 336 362 364H150L118 336Z"/><path d="M174 214H302L339 250H174Z"/><path d="M278 216 353 119 380 140 308 242Z"/><circle cx="164" cy="332" r="13" fill="#10202d"/><circle cx="348" cy="332" r="13" fill="#10202d"/>',
};
const labels = { stim: 'STIM', burrowed: 'BURROWED', hidden: 'HIDDEN', siege: 'SIEGE' };

async function logoVector(root, name, color, placement = '') {
  const source = await readFile(path.join(root, `token-artwork/factions/${name}.svg`), 'utf8');
  const viewBox = source.match(/viewBox="([^"]+)"/)[1];
  const paths = [...source.matchAll(/<path\b[\s\S]*?\/>/g)]
    .map(([element]) => element.replace(/fill:\s*#[a-f0-9]+/gi, `fill:${color}`))
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${placement}>${paths}</svg>`;
}

export async function factionLogo(root, name, color) {
  return sharp(Buffer.from(await logoVector(root, name, color, 'width="1024" height="1024"')))
    .png()
    .toBuffer();
}

export async function tokenImage(root, token) {
  const symbol = token.symbol;
  const accent = token.color;
  const background = token.inverted ? '#f7f6ee' : accent;
  const ink = ['shield', 'hidden'].includes(symbol)
    ? '#000000'
    : token.inverted
      ? accent
      : '#ffffff';
  const logo = !symbols[symbol]
    ? await logoVector(root, symbol, ink, 'x="120" y="105" width="272" height="272"')
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
