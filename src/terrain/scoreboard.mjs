import sharp from 'sharp';
import { sha256 } from '../io.mjs';
import { encodeGlb } from '../models/portable-glb.mjs';
import { modelAssetBaseUrl } from '../urls.mjs';

export const scoreboardName = 'Starcraft - Terrain - Scoreboard - score1';
export const scoreboardProfile = 'sc_terrain_scoreboard_score1';
// Fit the long side to 80% of the battlefield edge alongside it.
const artworkWidth = 1208;
const artworkLength = 300;
const width = 36 * 2.54 * 0.8;
const length = (width * artworkLength) / artworkWidth;
export const scoreboardTerrain = {
  Id: scoreboardName,
  Name: 'Scoreboard',
  Type: 'Terrain',
  Width: width,
  Length: length,
  Shape: 0,
};

export const scoreboardPlacement = boardHeight => ({
  Id: scoreboardName,
  Type: 'Terrain',
  Quadrant: 1,
  Rotation: 90,
  ShortSide: -(length / 2 + 2) / 2.54,
  LongSide: boardHeight / 2,
});

const segmentPaths = [
  'M-11-19H11L14-16 10-13H-10L-14-16Z',
  'M12-12L16-15V-3L12 1 9-3V-9Z',
  'M12 3L16 0V13L12 17 9 13V6Z',
  'M-11 14H11L14 18 10 21H-10L-14 18Z',
  'M-12 3L-9 6V13L-12 17-16 13V0Z',
  'M-12-12L-9-9V-3L-12 1-16-3V-15Z',
  'M-10-2H10L13 1 10 4H-10L-13 1Z',
];
const digits = [
  [1, 2],
  [0, 1, 6, 4, 3],
  [0, 1, 6, 2, 3],
  [5, 6, 1, 2],
  [0, 5, 6, 2, 3],
];
const heart =
  '<path fill-rule="evenodd" d="M0 27C-10 20-28 7-28-8C-28-22-11-28 0-15C11-28 28-22 28-8C28 7 10 20 0 27ZM4-20-7 1H2L-4 23 11-5H1L10-20Z"/>';
const objective =
  '<ellipse cx="0" cy="16" rx="29" ry="11" fill="none" stroke="currentColor" stroke-width="5"/><path d="M-21-23H21L18-8 0 20-18-8Z" stroke="#161e2a" stroke-width="4" stroke-linejoin="bevel"/>';

export async function buildScoreboard() {
  const grid = [];
  const number = (digit, x, ink) =>
    `<g transform="translate(${x} 37)" fill="${ink}">${digits[digit].map(segment => `<path d="${segmentPaths[segment]}"/>`).join('')}</g>`;
  for (let row = 0; row < 2; row++) {
    const y = 67 + row * 110;
    grid.push(
      `<g transform="translate(54 ${y + 55})" fill="#dce8f1" color="#dce8f1">${row ? objective : heart}</g>`,
    );
    for (let col = 0; col < 10; col++) {
      const x = 100 + col * 110;
      const ink = col < 5 ? '#65baff' : '#ff7774';
      const panel = col < 5 ? '#1d3d5c' : '#512e37';
      grid.push(
        `<path d="M${x + 11} ${y + 3}h88l8 8v88l-8 8h-88l-8-8v-88Z" fill="${panel}" stroke="${ink}" stroke-width="4"/>`,
      );
      if (row === 0) grid.push(number(col % 5, x + 55, ink));
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${artworkWidth * 2}" height="600" viewBox="0 0 ${artworkWidth} ${artworkLength}"><rect width="100%" height="100%" fill="#161e2a"/><path d="M5 20L20 5H1188L1203 20V280L1188 295H20L5 280ZM650 67V287" fill="none" stroke="#8d9cae" stroke-width="4"/>${grid.join('')}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const mesh = {
    vertices: [
      [-width / 2, 0.06, -length / 2],
      [-width / 2, 0.06, length / 2],
      [width / 2, 0.06, length / 2],
      [width / 2, 0.06, -length / 2],
    ],
    uv: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ],
    faces: [
      [0, 1, 2],
      [0, 2, 3],
    ],
    unlit: true,
    texture: { data, width: info.width, height: info.height },
  };
  const bytes = await encodeGlb([mesh]);
  const filename = sha256(bytes) + '.glb';
  const previewGeometryFile = `model-assets/${filename}.preview.json`;
  return {
    png,
    files: new Map([
      [`model-assets/${filename}`, bytes],
      [
        previewGeometryFile,
        Buffer.from(JSON.stringify([{ ...mesh, texture: { png: png.toString('base64') } }])),
      ],
    ]),
    model: {
      terrainId: scoreboardProfile,
      unitName: 'Terrain - Scoreboard - score1',
      status: 'selected',
      calibration: 'pdf-grid-v1',
      model: {
        meshUrl: `${modelAssetBaseUrl}/${filename}`,
        textureUrl: null,
        hostedAsset: true,
        previewGeometryFile,
      },
      layout: { size: 1 / 2.54, position: [0, 0, 0], rotation: [0, 0, 0] },
      attachments: [],
    },
  };
}
