import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { sha256 } from '../src/io.mjs';
const [filename] = process.argv.slice(2);
assert.ok(filename, 'Usage: node scripts/extract-tts-terrain.mjs TTS_WORKSHOP_SAVE.json');
const bytes = await readFile(filename),
  save = JSON.parse(bytes),
  bags = [];
function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (o.Name === 'Bag' && /^All - Official PDF Map [1-6](?:\D|$)/.test(o.Nickname ?? ''))
    bags.push(o);
  for (const [k, v] of Object.entries(o))
    if (typeof v === 'object') Array.isArray(v) ? v.forEach(walk) : walk(v);
}
walk(save);
bags.sort(
  (a, b) => Number(a.Nickname.match(/Map (\d)/)[1]) - Number(b.Nickname.match(/Map (\d)/)[1]),
);
assert.deepEqual(
  bags.map(bag => Number(bag.Nickname.match(/Map (\d)/)[1])),
  [1, 2, 3, 4, 5, 6],
  'Expected official standard maps 1-6',
);
let knownAssets = [];
try {
  knownAssets = JSON.parse(await readFile('terrain-sources.json', 'utf8')).assets;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const approximatelyEqual = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length && keys.every(key => approximatelyEqual(a[key], b[key]))
    );
  }
  return a === b;
};
const assets = new Map(),
  maps = [];
function attachedParts(object) {
  return (object.ChildObjects ?? []).map(child => {
    assert.ok(
      child.CustomMesh?.MeshURL && child.CustomMesh.DiffuseURL,
      'Unsupported attached terrain',
    );
    assert.ok(!child.ChildObjects?.length, 'Nested attachment needs transform composition');
    return {
      meshUrl: child.CustomMesh.MeshURL,
      textureUrl: child.CustomMesh.DiffuseURL,
      transform: child.Transform,
    };
  });
}
for (const bag of bags) {
  const number = Number(bag.Nickname.match(/Map (\d)/)[1]),
    memory = JSON.parse(bag.LuaScriptState).ml,
    items = [];
  for (const o of bag.ContainedObjects) {
    if (!o.Nickname) continue;
    assert.ok(
      o.CustomMesh?.MeshURL && o.CustomMesh.DiffuseURL,
      `Missing terrain mesh: ${o.Nickname}`,
    );
    const t = o.Transform;
    const candidate = {
      name: o.Nickname.replace(/^Size \d - /, '')
        .replace(/: Size \d$/, '')
        .replace(/^wall /, 'Wall Set '),
      meshUrl: o.CustomMesh.MeshURL,
      textureUrl: o.CustomMesh.DiffuseURL,
      ttsScale: [t.scaleX, t.scaleY, t.scaleZ],
      attachments: attachedParts(o),
    };
    const known = knownAssets.find(({ id, ...definition }) =>
      approximatelyEqual(definition, candidate),
    );
    const key = sha256(
      JSON.stringify([candidate.meshUrl, candidate.textureUrl, ...candidate.ttsScale]),
    ).slice(0, 16);
    const asset = known ?? { id: `sc_terrain_${key}`, ...candidate };
    const id = asset.id;
    if (!assets.has(id)) assets.set(id, asset);
    const m = memory[o.GUID];
    assert.ok(m, `Missing saved placement: ${o.GUID}`);
    assert.ok(
      Math.abs(m.pos.x) < 27 && Math.abs(m.pos.z) < 18,
      `Terrain outside standard table: ${o.Nickname}`,
    );
    items.push({ id, x: m.pos.x, z: m.pos.z, rotation: m.rot.y, ttsGuid: o.GUID });
  }
  assert.equal(
    items.length,
    number >= 5 ? 32 : 30,
    `Unexpected official terrain count: map ${number}`,
  );
  maps.push({
    name: `Official Map ${number}`,
    number,
    pdfPage: 117 + number,
    width: 54,
    height: 36,
    items,
  });
}
await writeFile(
  'terrain-sources.json',
  JSON.stringify(
    {
      source: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3662791369',
      workshopSha256: sha256(bytes),
      policy:
        'Official PDF maps 1-6, using their TTS memory-bag placements; decorative table excluded.',
      assets: [...assets.values()],
      maps,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `${maps.length} maps, ${assets.size} terrain variants, ${maps.reduce((n, m) => n + m.items.length, 0)} placed pieces.`,
);
