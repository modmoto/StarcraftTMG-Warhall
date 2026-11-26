// Keep neutral pixels and original value/saturation; unify chromatic material hues.
export const factionHues = { Terran: 220, Protoss: 48 };

export function factionTexture(texture, faction) {
  if (!texture) return null;
  const hue = factionHues[faction];
  if (hue === undefined) throw new Error(`Unknown faction palette: ${faction}`);
  const data = Buffer.from(texture.data);
  const h = hue / 60,
    x = 1 - Math.abs((h % 2) - 1);
  const rgb =
    h < 1
      ? [1, x, 0]
      : h < 2
        ? [x, 1, 0]
        : h < 3
          ? [0, 1, x]
          : h < 4
            ? [0, x, 1]
            : h < 5
              ? [x, 0, 1]
              : [1, 0, x];
  for (let i = 0; i < data.length; i += 4) {
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    const chroma = max - min;
    if (max < 20 || chroma / max < 0.22) continue;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(min + chroma * rgb[c]);
  }
  return { ...texture, data };
}

// Recolour only the existing Protoss gold accent; keep neutral material pixels.
export function redGoldTexture(texture) {
  const data = Buffer.from(texture.data);
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const hi = Math.max(r, g, b),
      lo = Math.min(r, g, b),
      chroma = hi - lo;
    if (hi < 20 || chroma / hi < 0.22) continue;
    let hue =
      hi === r
        ? 60 * ((g - b) / chroma)
        : hi === g
          ? 60 * ((b - r) / chroma + 2)
          : 60 * ((r - g) / chroma + 4);
    hue = (hue + 360) % 360;
    if (hue < 30 || hue > 75) continue;
    data[i] = hi;
    data[i + 1] = lo;
    data[i + 2] = lo;
  }
  return { ...texture, data };
}
