// Native WDS extra items are consumed by the regular army import.
export function addImportExtraItems(data) {
  const unitExtras = {
    pdf_Terran_unit_raven: ['pdf_Terran_unit_auto_turret'],
    pdf_Terran_unit_nova_assault_mode: ['pdf_Terran_unit_holo_decoy'],
    pdf_Zerg_unit_corpsers_roach: Array(3).fill('pdf_Zerg_unit_roachling'),
  };
  for (const faction of ['Terran', 'Zerg', 'Protoss']) {
    for (const unit of data[`${faction}/units.json`] ?? []) {
      const ids = unitExtras[unit.Id];
      if (ids) unit.ExtraItems = ids.map(Id => ({ Id, Type: 'Unit' }));
      if (unit.Id === 'pdf_Zerg_unit_ravagers')
        unit.ExtraItems = [{ Id: 'Starcraft - Token - Corrosive Bile', Type: 'Token' }];
    }
  }
  const cardExtras = {
    sc_card_terran_tactics_raynor_s_raiders: 'pdf_Terran_unit_point_defense_drone',
    sc_card_terran_tactics_nova_covert_ops: 'pdf_Terran_unit_sabotage_drone',
    sc_card_protoss_tactics_khalai: 'pdf_Protoss_unit_pylon',
    sc_card_zerg_tactics_kerrigan_s_swarm: 'pdf_Zerg_unit_omega_worm',
    sc_card_zerg_tactics_cocoon: 'pdf_Zerg_unit_ravagers',
  };
  // Card definitions are maintained separately from the PDF unit converter.
  for (const [Id, target] of Object.entries(cardExtras)) {
    const names = {
      sc_card_terran_tactics_raynor_s_raiders: "Raynor's Raiders",
      sc_card_terran_tactics_nova_covert_ops: 'Nova Covert Ops',
      sc_card_protoss_tactics_khalai: 'Khalai',
      sc_card_zerg_tactics_kerrigan_s_swarm: "Kerrigan's Swarm",
      sc_card_zerg_tactics_cocoon: 'Cocoon',
    };
    data['options.json'].push({
      Id: `sc_import_extra_${Id}`,
      Name: names[Id],
      Type: 7,
      ExtraItems: [
        { Id, Type: 'Card' },
        { Id: target, Type: 'Unit' },
      ],
    });
  }
}
