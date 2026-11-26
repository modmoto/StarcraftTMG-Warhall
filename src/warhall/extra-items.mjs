import assert from 'node:assert/strict';

function mergeExtras(existing = [], requested) {
  const merged = [...existing];
  const counts = new Map();
  for (const extra of requested) {
    const key = `${extra.Type}/${extra.Id}`;
    const needed = (counts.get(key) ?? 0) + 1;
    counts.set(key, needed);
    if (merged.filter(item => item.Type === extra.Type && item.Id === extra.Id).length < needed)
      merged.push(extra);
  }
  return merged;
}

// Repeated Roachling references intentionally create three separate reserve units.
export function addImportExtraItems(data) {
  const unitExtras = {
    pdf_Terran_unit_raven: ['pdf_Terran_unit_auto_turret'],
    pdf_Terran_unit_nova_assault_mode: ['pdf_Terran_unit_holo_decoy'],
    pdf_Zerg_unit_corpsers_roach: Array(3).fill('pdf_Zerg_unit_roachling'),
    pdf_Protoss_unit_reaver: [
      'pdf_Protoss_unit_scarab',
      'pdf_Protoss_unit_solarite_scarab',
      'pdf_Protoss_unit_phasing_scarab',
    ],
  };
  for (const faction of ['Terran', 'Zerg', 'Protoss']) {
    for (const unit of data[`${faction}/units.json`] ?? []) {
      if (unit.ExtraItems)
        unit.ExtraItems = unit.ExtraItems.map(item =>
          item.Type === 'Token' && item.Id === 'Starcraft - Token - Fire Wall'
            ? { ...item, Id: 'Starcraft - Token - Wall Template' }
            : item,
        );
      const ids = unitExtras[unit.Id];
      if (ids)
        unit.ExtraItems = mergeExtras(
          unit.ExtraItems,
          ids.map(Id => ({ Id, Type: 'Unit' })),
        );
      if (unit.Id === 'pdf_Zerg_unit_bile_launcher')
        unit.ExtraItems = mergeExtras(unit.ExtraItems, [
          { Id: 'Starcraft - Token - Bile Bomb', Type: 'Token' },
        ]);
      if (unit.Id === 'pdf_Zerg_unit_ravagers')
        unit.ExtraItems = mergeExtras(unit.ExtraItems, [
          { Id: 'Starcraft - Token - Corrosive Bile', Type: 'Token' },
        ]);
      if (unit.Id === 'pdf_Terran_unit_firebat')
        unit.ExtraItems = mergeExtras(unit.ExtraItems, [
          { Id: 'Starcraft - Token - Wall Template', Type: 'Token' },
        ]);
    }
  }
  const cardExtras = {
    sc_card_terran_tactics_raynor_s_raiders: 'pdf_Terran_unit_point_defense_drone',
    sc_card_terran_tactics_nova_covert_ops: 'pdf_Terran_unit_sabotage_drone',
    sc_card_protoss_tactics_khalai: 'pdf_Protoss_unit_pylon',
    sc_card_zerg_tactics_kerrigan_s_swarm: 'pdf_Zerg_unit_omega_worm',
    sc_card_protoss_tactics_tal_darim: 'pdf_Protoss_unit_tal_darim_pylon',
    sc_card_zerg_tactics_stukov_s_forces: 'pdf_Zerg_unit_infested_missile_turret',
  };
  // Card definitions are maintained separately from the PDF unit converter.
  for (const [Id, target] of Object.entries(cardExtras)) {
    const card = data['cards.json'].find(item => item.Id === Id);
    if (
      !card &&
      ['sc_card_protoss_tactics_tal_darim', 'sc_card_zerg_tactics_stukov_s_forces'].includes(Id)
    )
      continue;
    assert.ok(card, `Missing extra-item source card: ${Id}`);
    const optionId = `sc_import_extra_${Id}`;
    const matches = data['options.json'].filter(
      item => item.Id === optionId || (item.Type === 7 && item.Name === card.Name),
    );
    assert.ok(matches.length <= 1, `Duplicate AddExtra definition: ${card.Name}`);
    const option = matches[0] ?? { Id: optionId, Name: card.Name, Type: 7 };
    assert.equal(option.Type, 7);
    option.Name = card.Name;
    option.ExtraItems = mergeExtras(option.ExtraItems, [
      { Id, Type: 'Card' },
      { Id: target, Type: 'Unit' },
    ]);
    if (!matches.length) data['options.json'].push(option);
  }
}
