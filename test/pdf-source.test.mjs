import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from '../src/cli.mjs';
import { buildWarhallPackage } from '../src/warhall/package.mjs';
import { normalizeCards } from '../src/sources/pdf/adapter.mjs';
import { parseCardPage } from '../src/sources/pdf/card-parser.mjs';
import { normalizeItems } from '../src/sources/pdf/layout.mjs';
import { discoverCards, loadSources } from '../src/sources/pdf/downloads.mjs';

const snapshots = JSON.parse(
  await readFile(new URL('./fixtures/official-card-layouts.json', import.meta.url), 'utf8'),
);
const buildCards = (cards, metadata) => buildWarhallPackage(normalizeCards(cards, metadata));

const parse = key => {
  const f = structuredClone(snapshots[key]);
  return parseCardPage(f.items, f, f.page);
};

test('PDF is default; New Recruit and local PDFs are explicit alternatives', () => {
  assert.equal(parseArgs([]).source, 'pdf');
  assert.equal(parseArgs(['--source', 'new-recruit']).source, 'new-recruit');
  assert.equal(parseArgs(['--source', 'pdf', '--offline']).offline, true);
  assert.throws(() => parseArgs(['--source', 'other']), /must be pdf or new-recruit/);
  assert.throws(() => parseArgs(['--source', 'new-recruit', '--pdf-dir', '/tmp']), /PDF options/);
});

test('discovers all waves and deduplicates official download links', () => {
  const links = ['Terran', 'Protoss', 'Zerg'].map(
    f => `https://archon-studio.com/files/manuals/sc/StarCraft-${f}-P2P-Card-Sheets-A4_EN.pdf`,
  );
  links.push(
    'https://archon-studio.com/files/manuals/sc/StarCraft-Terran-P2P-W3-Card-Sheets-A4_EN.pdf',
  );
  const html = [...links, links[0]].map(url => `<a href="${url}">Download</a>`).join('');
  assert.equal(discoverCards(html).length, 4);
  assert.equal(discoverCards(html).find(x => x.wave === 3).faction, 'Terran');
  assert.throws(
    () => discoverCards(html.replaceAll('https://archon-studio.com/', 'https://example.org/')),
    /Unexpected official card host/,
  );
  assert.throws(() => discoverCards(''), /missing Terran/);
});

test('Marine outlines produce HP=2 and speed=4/7 with upgrades separate', () => {
  const card = parse('marine');
  assert.equal(card.name, 'Marines');
  assert.equal(card.attributes.HP, '2');
  assert.equal(card.attributes.Spd, '4/7');
  assert.equal(card.attributes.Supply, '1-3: 0 | 4-6: 1 | 7-9: 2');
  assert.deepEqual(
    card.profiles.filter(p => p.type.endsWith('Weapon')).map(p => p.name),
    ['C-14 RIFLE', 'STRIKE'],
  );
  assert.ok(card.optional.some(p => p.name === 'Combat Shield'));
  assert.ok(!card.profiles.some(p => p.attributes.Effect?.includes('COMBAT SHIELD')));
});

test('wrapped names/surge cells and reversed card faces survive extraction', () => {
  const hydra = parse('hydra');
  assert.deepEqual(hydra.provenance.officialBase, { shape: 'oval', widthMm: 40, lengthMm: 100 });
  assert.equal(
    hydra.profiles.find(p => p.name === 'NEEDLE SPINES').attributes.Surge,
    'Light, Armoured',
  );
  assert.deepEqual(
    parse('artanis')
      .profiles.filter(p => p.type.endsWith('Weapon'))
      .map(p => p.name),
    ['TWILIGHT BLADES STRIKE', 'TWILIGHT BLADES SWEEP'],
  );
  const nova = parse('nova-assault');
  assert.equal(nova.name, 'Nova Assault Mode');
  assert.equal(nova.attributes.HP, '8');
  assert.equal(
    nova.profiles.find(p => p.name === 'MONOMOLECULAR BLADE').attributes.Surge,
    'Light, Armoured',
  );
  assert.equal(
    parse('zagara').profiles.find(p => p.name === "ZAGARA'S TALONS").attributes.Dmg,
    '2',
  );
  assert.equal(parse('ravager').attributes.HP, '9');
});

test('conflicting HP and missing stat labels are fatal, never silently guessed', () => {
  const f = structuredClone(snapshots.marine);
  const hp = f.items.find(i => i.s === '2' && i.x > 320 && i.x < 340 && i.h > 12);
  f.items.push({ ...hp, s: '3' });
  assert.throws(() => parseCardPage(f.items, f, f.page), /Conflicting HP/);
  f.items = f.items.filter(i => i.s !== 'ARMOUR');
  assert.throws(() => parseCardPage(f.items, f, f.page), /Missing ARMOUR/);
});

test('PDF adapter emits linked Warhall records without reading a New Recruit checkout', async () => {
  const cards = ['marine', 'hydra', 'zagara', 'artanis', 'ravager', 'nova-assault'].map(parse);
  const { data, report } = await buildCards(cards, { source: 'official test snapshots' });
  assert.equal(report.counts.units, 6);
  assert.equal(report.sourceMode, 'pdf');
  assert.ok(data['Terran/units.json'].some(u => u.Id === 'unit_marine'));
  const hydra = report.units.find(u => u.name === 'Hydralisks');
  assert.equal(
    data['Zerg/profiles.json'].find(p => p.Id === hydra.profileId).BaseId,
    'base_oval_40x100',
  );
  assert.equal(report.units.find(u => u.name === 'Zagara').baseWidthMm, 100);
});

test('duplicate official unit cards require explicit reconciliation', () => {
  const marine = parse('marine');
  assert.throws(
    () => normalizeCards([marine, marine, parse('hydra'), parse('artanis')]),
    /Duplicate official unit card/,
  );
});

test('offline cache validates checksums and rejects modified PDFs', async t => {
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'starcraft-pdf-cache-'));
  t.after(() => rm(cacheDir, { recursive: true, force: true }));
  const file = snapshots.marine.file,
    bytes = Buffer.from('%PDF-1.7 cached fixture');
  await writeFile(path.join(cacheDir, file), bytes);
  await writeFile(
    path.join(cacheDir, 'sources.json'),
    JSON.stringify({
      cards: [
        { file, faction: 'Terran', sha256: createHash('sha256').update(bytes).digest('hex') },
      ],
    }),
  );
  assert.equal((await loadSources({ cacheDir, offline: true })).length, 1);
  await writeFile(path.join(cacheDir, file), '%PDF-modified');
  await assert.rejects(loadSources({ cacheDir, offline: true }), /checksum mismatch/);
});

test('normalizes rotated text and removes identical outlines by position', () => {
  const item = { str: '2', transform: [-1, 0, 0, -1, 20, 30], width: 8, height: 15 };
  const items = normalizeItems([item, item], 600, 840);
  assert.equal(items.length, 1);
  assert.equal(items[0].x, 580);
  assert.equal(items[0].y, 810);
  assert.equal(items[0].side, 'rotated');
});

test('one malformed row fails even if the other row in a weapon table is valid', () => {
  const f = structuredClone(snapshots.artanis);
  f.items = f.items.filter(
    i => !(i.side === 'rotated' && Math.abs(i.y - 181.8) < 1 && i.x > 301 && i.x < 317),
  );
  assert.throws(() => parseCardPage(f.items, f, f.page), /Unreadable weapon row/);
});

test('Siege Tank template expressions survive as weapon values', () => {
  const tank = parse('tank');
  const shock = tank.profiles.find(p => p.name === 'SHOCK CANNON');
  assert.ok(shock);
  assert.equal(shock.attributes.RoA, 'BT+4');
  assert.equal(shock.attributes['S.Die'], 'BT');
});

test('PDF footprints win over the map, including dimensions changed in a card', async () => {
  const marine = parse('marine');
  marine.provenance.officialBase = { shape: 'round', widthMm: 60, lengthMm: 60 };
  const { report } = await buildCards([marine, parse('hydra'), parse('artanis')]);
  const unit = report.units.find(u => u.name === 'Marines');
  assert.equal(unit.baseWidthMm, 60);
  assert.equal(unit.baseSizeSource, 'printed PDF footprint');
  assert.equal('baseSizeMapping' in report, false);
});

test('PDF flight stands use 100 mm even when the unit map specifies something else', async () => {
  const marine = parse('marine');
  marine.provenance.officialBase = { label: 'FLIGHT STAND' };
  const { report } = await buildCards([marine, parse('hydra'), parse('artanis')]);
  const unit = report.units.find(u => u.name === 'Marines');
  assert.deepEqual([unit.baseShape, unit.baseWidthMm, unit.baseLengthMm], ['round', 100, 100]);
});

test('missing PDF footprints fail rather than fall back to the New Recruit map', async () => {
  const marine = parse('marine');
  marine.provenance.officialBase = { label: '' };
  await assert.rejects(
    buildCards([marine, parse('hydra'), parse('artanis')]),
    /Missing or unreadable printed PDF base size/,
  );
});
