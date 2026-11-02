import assert from 'node:assert/strict';

const key = value =>
  value
    .replace(/<[^>]+>/g, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
const cardTitle = value => value.replace(/\s+\((?:CP|PE|BM):[^)]+\)$/i, '');
const split = value =>
  value
    .split(/,(?![^()]*\))/)
    .map(s => s.trim())
    .filter(Boolean);

// Builds an import PLAN. It does not spawn anything or change Warhall state.
export function planNewRecruitList(text, { factions, cards, deployments }) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const header = lines.find(line => line.trim());
  const faction = Object.keys(factions).filter(name =>
    new RegExp(`^${name}\\b`, 'i').test(header ?? ''),
  );
  assert.equal(faction.length, 1, 'Expected one supported faction in the list heading');
  const army = factions[faction[0]];
  const resolve = (name, records, kind) => {
    const matches = records.filter(record => key(cardTitle(record.Name)) === key(name));
    assert.equal(matches.length, 1, `Unknown or ambiguous ${kind}: ${name}`);
    return matches[0];
  };
  const metadata = header.match(/\((\d+)\s+Minerals,\s*(\d+)\s+Gas\)/i);
  const plan = {
    schemaVersion: 1,
    title: header,
    faction: faction[0],
    totals: {
      minerals: metadata ? Number(metadata[1]) : null,
      gas: metadata ? Number(metadata[2]) : null,
    },
    units: [],
    factionCards: [],
    tacticalCards: [],
    deploymentChoices: [],
    missionChoices: [],
  };
  let section = null;
  for (const raw of lines.slice(lines.indexOf(header) + 1)) {
    const line = raw.trim();
    if (!line || /^Created with newrecruit\.eu\b/i.test(line)) continue;
    const summary = line.match(/^(\d+)\s+Supply,\s*(\d+)\s+CP$/i);
    if (summary) {
      plan.totals.supply = Number(summary[1]);
      plan.totals.cp = Number(summary[2]);
      continue;
    }
    const deployment = line.match(/^Deployment Maps?:\s*(.+)$/i);
    if (deployment) {
      plan.deploymentChoices.push(
        ...split(deployment[1]).map(name => {
          const record = resolve(
            name,
            deployments.map((d, i) => ({ ...d, Name: d.deploymentName, index: i + 1 })),
            'deployment',
          );
          return {
            name: record.deploymentName,
            deploymentIndex: record.index,
            templateId: record.deploymentID,
            cardId: resolve(
              name,
              cards.filter(c => c.Id.startsWith('sc_card_deployments_')),
              'deployment card',
            ).Id,
          };
        }),
      );
      continue;
    }
    const mission = line.match(/^Mission Cards?:\s*(.+)$/i);
    if (mission) {
      plan.missionChoices.push(
        ...split(mission[1]).map(name => {
          const card = resolve(
            name,
            cards.filter(c => c.Id.startsWith('sc_card_missions_')),
            'mission',
          );
          return { id: card.Id, name: cardTitle(card.Name) };
        }),
      );
      continue;
    }
    const heading = line.match(/^#\s*(Faction|Tactical|Units)\s*:\s*$/i);
    if (heading) {
      section = heading[1].toLowerCase();
      continue;
    }
    if (section === 'units') {
      const match = line.match(
        /^(?:(\d+)\s*[x×]\s*)?(.+?)\s*\((\d+),\s*(\d+)S\)\s*(?::\s*(.*))?$/i,
      );
      assert.ok(match, `Unrecognized unit line: ${line}`);
      const unit = resolve(match[2], army.units, 'unit');
      const modelCount = Number(match[1] ?? 1);
      assert.ok(modelCount > 0, 'Model count must be positive');
      const profileIds = new Set(unit.BasicProfileIds ?? []);
      const ruleIds = new Set(
        army.profiles
          .filter(p => profileIds.has(p.Id))
          .flatMap(p => p.Children ?? [])
          .map(c => c.Id),
      );
      const ownedPrefix = unit.Id.replace('_unit_', '_rule_') + '_';
      const rules = army.rules.filter(r => ruleIds.has(r.Id) || r.Id.startsWith(ownedPrefix));
      const upgrades = split(match[5] ?? '').map(name => {
        const available = new Set(
          (army.modifiedunit ?? [])
            .filter(mapping => mapping.UnitId === unit.Id)
            .map(mapping => mapping.OptionId),
        );
        const options = (army.options ?? []).filter(
          option => available.has(option.Id) && key(option.Name) === key(name),
        );
        if (options.length) {
          assert.equal(options.length, 1, `Ambiguous upgrade on ${unit.Name}: ${name}`);
          const option = options[0];
          const ruleIds = (army.modifiedprofile ?? [])
            .filter(mapping => mapping.UnitId === unit.Id && mapping.OptionId === option.Id)
            .flatMap(mapping => mapping.ReferencedItemsToAdd ?? [])
            .filter(reference => reference.Id.endsWith('_selected_options'))
            .flatMap(reference => (reference.Ref ?? []).map(child => child.Id));
          return { name, optionIds: [option.Id], ruleIds };
        }
        const matches = rules.filter(rule => key(rule.Name) === key(name));
        assert.ok(matches.length, `Upgrade not found on ${unit.Name}: ${name}`);
        return { name, ruleIds: matches.map(rule => rule.Id) };
      });
      plan.units.push({
        id: unit.Id,
        name: unit.Name,
        modelCount,
        minerals: Number(match[3]),
        supply: Number(match[4]),
        upgrades,
      });
    } else if (section === 'faction' || section === 'tactical') {
      const card = resolve(
        line,
        cards.filter(c => c.Id.startsWith(`sc_card_${faction[0].toLowerCase()}_tactics_`)),
        `${section} card`,
      );
      plan[section === 'faction' ? 'factionCards' : 'tacticalCards'].push({
        id: card.Id,
        name: cardTitle(card.Name),
      });
    } else throw new Error(`Unrecognized list line: ${line}`);
  }
  assert.ok(plan.units.length, 'List contains no units');
  plan.totals.units = plan.units.length;
  plan.totals.models = plan.units.reduce((sum, unit) => sum + unit.modelCount, 0);
  const minerals = plan.units.reduce((sum, unit) => sum + unit.minerals, 0);
  const supply = plan.units.reduce((sum, unit) => sum + unit.supply, 0);
  assert.ok(
    plan.totals.minerals === null || minerals === plan.totals.minerals,
    'Unit mineral total differs from heading',
  );
  assert.ok(
    plan.totals.supply === undefined || supply === plan.totals.supply,
    'Unit supply total differs from heading',
  );
  return plan;
}
