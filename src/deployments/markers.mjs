import { deflateSync } from 'node:zlib';

export const markerDiameterMm = 32;
export const controlRangeInches = 3;
export const markerMeshUrl =
  'https://steamusercontent-a.akamaihd.net/ugc/2492270022769002891/E40281F9F7B0FDC8D90F249D2AA481BF3BB82CD4/';
export const markerColors = ['#be1d28', '#1d71b8', '#be1d28', '#1d71b8', '#3fa535'];
const digits = [
  '010110010010111',
  '111001111100111',
  '111001111001111',
  '101101111001001',
  '111100111001111',
];

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// Pure JavaScript rasterization: no platform fonts, native graphics libraries,
// timestamps or metadata, so Windows and macOS generate identical PNG bytes.
export function markerTexture(number, halo = false) {
  const size = 256,
    raw = Buffer.alloc(size * (1 + 4 * size));
  const color = markerColors[number - 1]
    .slice(1)
    .match(/../g)
    .map(c => parseInt(c, 16));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - 127.5, y - 127.5);
      const offset = y * (1 + 4 * size) + 1 + x * 4;
      let rgba = [...color, 255];
      if (halo) rgba = [...color, r > 123 && r < 127 ? 150 : 0];
      else {
        if (r > 121) rgba = [255, 255, 255, 255];
        const gx = Math.floor((x - 74) / 36),
          gy = Math.floor((y - 38) / 36);
        if (gx >= 0 && gx < 3 && gy >= 0 && gy < 5 && digits[number - 1][gy * 3 + gx] === '1')
          rgba = [255, 255, 255, 255];
      }
      raw.set(rgba, offset);
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function markerModels() {
  const raw = 'https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/main/assets/markers/';
  return [1, 2, 3, 4, 5].flatMap(number =>
    [false, true].map(halo => ({
      tokenId: `sc_mission_${halo ? 'range_' : 'marker_'}${number}`,
      unitName: `Mission ${halo ? 'range aid' : 'marker'} ${number}`,
      status: 'selected',
      model: {
        meshUrl: markerMeshUrl,
        textureUrl: `${raw}${halo ? 'range' : 'marker'}-${number}.png`,
        ttsTransform: { scaleY: 1 },
      },
      // The measured TTS mesh spans four units across X/Z. Warhall legacy scale
      // multiplies those by 2.54 cm. Range is measured from the 32 mm disk edge.
      layout: {
        size:
          (halo ? markerDiameterMm / 10 + 2 * controlRangeInches * 2.54 : markerDiameterMm / 10) /
          (4 * 2.54),
        position: [0, halo ? 0.012 : 0.025, 0],
        rotation: [0, 0, 0],
      },
    })),
  );
}
