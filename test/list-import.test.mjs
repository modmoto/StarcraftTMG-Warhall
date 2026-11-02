import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planNewRecruitList } from '../src/lists/new-recruit.mjs';

const json = async file =>
  JSON.parse(await readFile(new URL(`../Starcraft-test/${file}`, import.meta.url), 'utf8'));
const sample = await readFile(
  new URL('./fixtures/lists/terran-anti-toss-ravager.txt', import.meta.url),
  'utf8',
);
const data = {
  factions: {
    Terran: {
      units: await json('Terran/units.json'),
      profiles: await json('Terran/profiles.json'),
      rules: await json('Terran/rules.json'),
    },
  },
  cards: await json('cards.json'),
  deployments: await json('deployments.json'),
};

test('actual New Recruit Starcraft export resolves units, upgrades, cards and scenario choices', () => {
  const plan = planNewRecruitList(sample, data);
  assert.equal(plan.faction, 'Terran');
  assert.deepEqual(
    plan.units.map(u => u.modelCount),
    [4, 4, 6, 6, 1, 3, 3, 1],
  );
  assert.equal(plan.totals.models, 28);
  assert.equal(plan.totals.units, 8);
  assert.equal(plan.totals.minerals, 2000);
  assert.equal(plan.totals.supply, 11);
  assert.equal(plan.tacticalCards.length, 6);
  assert.equal(plan.tacticalCards.filter(c => c.name === 'Barracks').length, 2);
  assert.equal(plan.factionCards[0].name, 'Terran Armed Forces');
  assert.deepEqual(
    plan.deploymentChoices.map(d => d.deploymentIndex),
    [2, 7],
  );
  assert.equal(plan.missionChoices.length, 2);
  assert.equal(plan.units[0].upgrades.length, 3);
  assert.ok(
    plan.units[0].upgrades.every(u =>
      u.ruleIds.every(id => id.startsWith('pdf_Terran_rule_marauders_')),
    ),
  );
  assert.deepEqual(planNewRecruitList(sample.replaceAll('\n', '\r\n'), data), plan);
});

test('list planning fails rather than silently dropping unknown content or changing counts', () => {
  for (const [before, after] of [
    ['Marauders', 'Unknown Unit'],
    ['Kinetic Foam', 'Unknown Upgrade'],
    ['Breach', 'Unknown Deployment'],
    ['Gather the Resources', 'Unknown Mission'],
    ['Barracks\n', 'Unknown Tactic\n'],
    ['2000 Minerals', '1999 Minerals'],
    ['4x Marauders', '0x Marauders'],
  ]) {
    assert.throws(() => planNewRecruitList(sample.replace(before, after), data));
  }
  assert.equal(
    JSON.parse(JSON.stringify(planNewRecruitList(sample, data))).tacticalCards.length,
    6,
  );
});
