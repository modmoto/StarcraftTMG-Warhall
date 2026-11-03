import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCard } from '../src/cards/descriptions.mjs';

test('tactic description includes resources, phases and lowercase activation types without a repeated card title', () => {
  const card = formatCard({
    Id: 'sc_card_protoss_tactics_khalai',
    Name: 'Khalai',
    UIConfig: { Color2: '#FFFFFF' },
    Description:
      'Khalai\n\nPE: 1\n\nMovement Phase\n\nPYLON WARP-IN:\nACTIVE Set a Pylon.\n\nMovement Phase\n\nBOUND BY THE KHALA:\nREACTION Activate another Unit.',
  });
  assert.equal(card.Name, 'Khalai');
  assert.equal(
    card.Description,
    'PE: 1\n\n<b>PYLON WARP-IN (Movement Phase, active)</b>\nSet a Pylon.\n\n<b>BOUND BY THE KHALA (Movement Phase, reaction)</b>\nActivate another Unit.',
  );
  assert.equal(card.UIConfig.Color2, '');
});

test('missing activation types require a reviewed printed-card override', () => {
  const card = {
    Id: 'sc_card_terran_tactics_vanadium_plating',
    Name: 'Vanadium Plating',
    UIConfig: {},
    Description:
      'Vanadium Plating\n\nCP: 1\n\nAny Phase\n\nCRYSTALLINE ALLOY:\nUse before an Armour Roll.',
  };
  assert.throws(() => formatCard(card), /Incomplete tactic heading/);
  assert.match(
    formatCard(card, { [card.Id]: { 'CRYSTALLINE ALLOY': 'reaction' } }).Description,
    /Any Phase, reaction/,
  );
});
