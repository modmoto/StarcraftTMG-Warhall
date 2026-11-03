import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractRulebook } from '../src/sources/pdf/rulebook.mjs';
import { consolidateRules, linkRuleIndex } from '../src/warhall/rule-index.mjs';

const json = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8').then(JSON.parse);
const token = (s, y, font = 'NotoSans-Condensed', h = 9, x = 40) => ({
  s,
  y,
  font,
  h,
  x,
  w: s.length * 4,
});
const heading = (s, y, h = 13) => token(s, y, 'Gineso-NorBol', h);
const pages = () => [
  {
    page: 1,
    items: [token('TABLE OF CONTENTS', 700), token('2.1 MODELS', 650), token('8.7.7 CHARGE', 600)],
  },
  {
    page: 30,
    items: [
      heading('PART 2:', 720, 16),
      heading('CORE CONCEPTS', 700, 16),
      heading('2.1 MODELS', 650),
      token('+X Modifier', 630, 'NotoSans-CondensedExtraBold'),
      token('changes the target number.', 610),
      token('A sidebar', 580, 'NotoSans-CondensedItalic'),
    ],
  },
  {
    page: 67,
    items: [
      heading('PART 8:', 720, 16),
      heading('THE GAME SEQUENCE', 700, 16),
      heading('8.7.7 CHARGE', 650, 11),
      token('Roll 1D6.', 630),
    ],
  },
  { page: 68, items: [token('The Charge fails if no legal position exists.', 700)] },
  {
    page: 75,
    items: [
      heading('PART 9:', 720, 16),
      heading('9.1 ARMY BUILDING', 650),
      token('Excluded army lists.', 630),
    ],
  },
];

test('chapter extraction retains numbered sections, symbols and continuation pages without sidebars or army lists', () => {
  const chapters = extractRulebook(pages());
  assert.deepEqual(
    chapters.map(chapter => chapter.number),
    ['2', '2.1', '8', '8.7.7'],
  );
  assert.match(chapters.find(chapter => chapter.number === '2.1').text, /\+X Modifier/);
  assert.doesNotMatch(JSON.stringify(chapters), /sidebar|Excluded army/);
  assert.match(
    chapters.find(chapter => chapter.number === '8.7.7').text,
    /Roll 1D6\.[\s\S]*Charge fails/,
  );
  const missing = pages();
  missing[0].items.push(token('2.2 UNITS', 550));
  assert.throws(() => extractRulebook(missing), /Missing rulebook chapter 2.2/);
});

test('identical shared abilities keep their original name; different costs retain distinct definitions', () => {
  const ability = (Id, cost) => ({
    Id,
    Name: 'Restoration',
    Type: 'Rule',
    Description: `Cost: ${cost}. Gain PRECISION.`,
  });
  const data = {
    'rules.json': [],
    'Terran/rules.json': [ability('a', '1 CP'), ability('b', '1 CP'), ability('c', '2 CP')],
    'Terran/profiles.json': [
      { Id: 'profile', Children: [{ Id: 'b' }], Description: '<link="b">Restoration</link>' },
    ],
  };
  const owners = new Map([
    ['a', new Set(['Marines'])],
    ['b', new Set(['Raiders'])],
    ['c', new Set(['Marauders'])],
  ]);
  assert.equal(consolidateRules(data, owners), 1);
  assert.deepEqual(data['Terran/profiles.json'][0].Children, [{ Id: 'a' }]);
  assert.match(data['Terran/profiles.json'][0].Description, /link="a"/);
  assert.equal(data['Terran/rules.json'].length, 2);
  assert.equal(new Set(data['Terran/rules.json'].map(rule => rule.Name)).size, 2);
  assert.equal(data['Terran/rules.json'].find(rule => rule.Id === 'a').Name, 'Restoration');
  assert.notEqual(
    data['Terran/rules.json'].find(rule => rule.Id === 'a').Description,
    data['Terran/rules.json'].find(rule => rule.Id === 'c').Description,
  );
});

test('nested keyword and chapter links are valid, avoid self-links, and stay unchanged on a second pass', () => {
  const glossary = {
    entries: [
      { record: { Id: 'precision', Name: 'Precision' }, aliases: ['Precision'] },
      { record: { Id: 'impact', Name: 'Impact' }, aliases: ['Impact'] },
    ],
  };
  const book = {
    chapters: [
      { number: '8.7.7', title: 'Charge' },
      { number: '8.7.4', title: 'Ranged Attack Resolution' },
    ],
  };
  const data = {
    'rules.json': [
      {
        Id: 'precision',
        Name: 'Precision',
        Type: 'Rule',
        Description: 'PRECISION modifies a roll.',
      },
      {
        Id: 'impact',
        Name: 'Impact',
        Type: 'Rule',
        Description: 'After a Charge, resolve IMPACT with PRECISION.',
      },
      {
        Id: 'rule_chapter_8_7_7',
        Name: '8.7.7 Charge',
        Type: 'Rule',
        Description: 'Charge uses Part 8.7.4 and IMPACT.',
      },
      {
        Id: 'rule_chapter_8_7_4',
        Name: '8.7.4 Ranged Attack Resolution',
        Type: 'Rule',
        Description: 'Resolve Surge.',
      },
      {
        Id: 'stimpack',
        Name: 'Stimpack',
        Type: 'Rule',
        Description: 'Gain PRECISION and resolve Surge.',
      },
    ],
  };
  linkRuleIndex(data, glossary, book);
  assert.match(data['rules.json'][1].Description, /<link="rule_chapter_8_7_7">Charge<\/link>/);
  assert.match(data['rules.json'][4].Description, /<link="precision">PRECISION<\/link>/);
  assert.match(data['rules.json'][4].Description, /<link="rule_chapter_8_7_4">Surge<\/link>/);
  assert.doesNotMatch(data['rules.json'][0].Description, /link=/);
  const before = JSON.stringify(data);
  linkRuleIndex(data, glossary, book);
  assert.equal(JSON.stringify(data), before);
});

test('shipped search index includes gameplay chapters and no duplicate named rules', async () => {
  const book = await json('rulebook.json');
  assert.equal(book.chapters.length, 100);
  assert.ok(
    book.chapters.every(chapter => ![1, 9, 12].includes(Number(chapter.number.split('.')[0]))),
  );
  const rules = (
    await Promise.all(
      ['rules.json', 'Protoss/rules.json', 'Terran/rules.json', 'Zerg/rules.json'].map(file =>
        json(`Starcraft-test/${file}`),
      ),
    )
  )
    .flat()
    .filter(rule => rule.Name && rule.Type === 'Rule');
  assert.equal(new Set(rules.map(rule => rule.Name.toLowerCase())).size, rules.length);
  assert.equal(rules.filter(rule => rule.Name === 'Psionic Transfer').length, 1);
  assert.ok(rules.some(rule => rule.Name === '8.7.7 Charge'));
  assert.ok(rules.some(rule => /8.7.4.*Surge/.test(rule.Name)));
  assert.match(
    rules.find(rule => rule.Name === '8.7.7 Charge').Description,
    /<link="rule_chapter_4_6">Part 4.6<\/link>/,
  );
});

test('bare chapter numbers, plural references and repeated keywords have visible links', () => {
  const glossary = {
    entries: [{ record: { Id: 'precision', Name: 'Precision' }, aliases: ['Precision'] }],
  };
  const book = {
    chapters: [
      { number: '8.7.7', title: 'Charge' },
      { number: '8.7.4', title: 'Ranged Attack Resolution' },
    ],
  };
  const data = {
    'rules.json': [
      { Id: 'precision', Name: 'Precision', Type: 'Rule', Description: '' },
      { Id: 'rule_chapter_8_7_7', Name: '8.7.7 Charge', Type: 'Rule', Description: '' },
      {
        Id: 'rule_chapter_8_7_4',
        Name: '8.7.4 Ranged Attack Resolution',
        Type: 'Rule',
        Description: '',
      },
      {
        Id: 'ability',
        Name: 'Ability',
        Type: 'Rule',
        Description: 'Parts 8.7.4 and 8.7.7. See §8.7.4 and 8.7.7. PRECISION and PRECISION.',
      },
    ],
  };
  linkRuleIndex(data, glossary, book);
  const text = data['rules.json'][3].Description;
  assert.equal([...text.matchAll(/<u><link=/g)].length, 6);
  assert.match(text, /<u><link="rule_chapter_8_7_7">8.7.7<\/link><\/u>\./);
  assert.match(
    text,
    /<u><link="precision">PRECISION<\/link><\/u> and <u><link="precision">PRECISION<\/link><\/u>/,
  );
  const before = JSON.stringify(data);
  linkRuleIndex(data, glossary, book);
  assert.equal(JSON.stringify(data), before);
});
