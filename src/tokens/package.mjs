export const tokenDiameterMm = 25;
export const factionColors = { Terran: '#2467d1', Protoss: '#e7be24', Zerg: '#9a44bd' };

export const tokenDefinitions = [
  ...['blue', 'red'].map(color => ({
    id: `activation_${color}`,
    name: `Activation - ${color}`,
    front: 'arrow',
    back: 'crosshair',
    color: color === 'blue' ? '#2467d1' : '#d33d48',
    description: 'Flip between the movement arrow and assault crosshair.',
  })),
  ...Object.entries(factionColors).flatMap(([faction, color]) =>
    [false, true].map(inverted => ({
      id: `faction_${faction.toLowerCase()}_${inverted ? 'white' : 'color'}`,
      name: `${faction} - ${inverted ? 'white' : faction === 'Terran' ? 'blue' : faction === 'Protoss' ? 'yellow' : 'purple'}`,
      front: faction.toLowerCase(),
      back: faction.toLowerCase(),
      color,
      inverted,
      description:
        'Faction marker. Use the inverted colour scheme to distinguish a second player of the same faction.',
    })),
  ),
  {
    id: 'buff_debuff',
    name: 'Buff / Debuff',
    front: 'buff',
    back: 'debuff',
    color: '#2467d1',
    backColor: '#d33d48',
    description:
      'Flip between the blue buff and red debuff faces. Track the effect and its value using the token notes.',
  },
  ...[
    ['stim', 'Stim', '#2467d1'],
    ['burrowed', 'Burrowed', '#9a44bd'],
    ['hidden', 'Hidden', '#299c77'],
    ['siege', 'Siege Status', '#df9f35'],
  ].map(([id, name, color]) => ({
    id,
    name,
    front: id,
    back: id,
    color,
    description: `Reminder for ${name}. Apply the unit's printed rules manually.`,
  })),
];

export function tokenCards(artwork) {
  return tokenDefinitions.map(token => ({
    Id: `sc_token_${token.id}`,
    Name: token.name,
    Type: 'Card',
    Description: `${token.name}\n\n${token.description}`,
    UIConfig: {
      ImageURL: artwork[token.id].front,
      ImageURLBack: artwork[token.id].back,
      Width: tokenDiameterMm,
      Length: tokenDiameterMm,
      IsRound: true,
      ShowInitials: false,
      Border: false,
      Color: '#FFFFFF',
      Color2: '#FFFFFF',
    },
  }));
}

export function factionIcons(artwork) {
  return Object.keys(factionColors).map(faction => ({
    Id: `sc_icon_${faction.toLowerCase()}`,
    Name: faction,
    Type: 'faction',
    URL: artwork[faction.toLowerCase()],
  }));
}
