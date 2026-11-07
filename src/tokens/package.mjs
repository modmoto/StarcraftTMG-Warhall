import tokenMenuOrder from '../../token-menu-order.json' with { type: 'json' };
import { tokenMenuId } from '../models/menu-ids.mjs';

export const tokenDiameterMm = 25;
export const factionColors = { Terran: '#2467d1', Protoss: '#b68a20', Zerg: '#9a44bd' };

export const tokenDefinitions = [
  ...['blue', 'red'].flatMap(color =>
    ['arrow', 'crosshair'].map(symbol => ({
      id: `activation_${color}_${symbol}`,
      name: `Activation - ${color} - ${symbol === 'arrow' ? 'movement' : 'assault'}`,
      symbol,
      color: color === 'blue' ? '#2467d1' : '#d33d48',
      description: `Activation reminder: ${symbol === 'arrow' ? 'movement' : 'assault'}.`,
    })),
  ),
  ...Object.entries(factionColors).flatMap(([faction, color]) =>
    [false, true].map(inverted => ({
      id: `faction_${faction.toLowerCase()}_${inverted ? 'white' : 'color'}`,
      name: `${faction} - ${inverted ? 'white' : faction === 'Terran' ? 'blue' : faction === 'Protoss' ? 'yellow' : 'purple'}`,
      symbol: faction.toLowerCase(),
      diameterMm: 32,
      color,
      inverted,
      description:
        'Faction marker. Use the inverted colour scheme to distinguish a second player of the same faction.',
    })),
  ),
  ...[
    ['buff', 'Buff', '#55cbb0'],
    ['debuff', 'Debuff', '#db4ba8'],
  ].map(([id, name, color]) => ({
    id,
    name,
    symbol: id,
    color,
    description: `${name} reminder. Track the effect and its value using the token notes.`,
  })),
  ...[
    ['stim', 'Stim', '#36b84a'],
    ['burrowed', 'Burrowed', '#9a693e'],
    ['hidden', 'Hidden', '#edcf38'],
    ['siege', 'Siege Status', '#929ba3'],
  ].map(([id, name, color]) => ({
    id,
    name,
    symbol: id,
    color,
    description: `Reminder for ${name}. Apply the unit's printed rules manually.`,
  })),
  {
    id: 'bile_bomb',
    name: 'Bile Bomb',
    symbol: 'bile_bomb',
    diameterMm: 32,
    color: '#487527',
    description:
      'Bile Launcher Bombard marker. Replace it with a Creep Tumor in base contact when removing it after the attack.',
  },
  {
    id: 'creep_tumor',
    name: 'Creep Tumor',
    symbol: 'creep_tumor',
    diameterMm: 28,
    color: '#77368d',
    description: 'Source of Creep. Ground Zerg units within 6 inches are On Creep.',
  },
  {
    id: 'corrosive_bile',
    name: 'Corrosive Bile',
    symbol: 'bile_bomb',
    diameterMm: 32,
    color: '#d95c13',
    description:
      'Ravager Corrosive Bile marker. Resolve its effect at the end of the Assault Phase.',
  },
  {
    id: 'shield',
    name: 'Shield',
    symbol: 'shield',
    color: '#35cedc',
    description: 'Protoss shield counter. Track the remaining shields using the token notes.',
  },
];

export const builtinTokenNames = [
  'TokenWarhallBlue',
  'TokenWarhallOrange',
  'TokenWarhallBlack',
  'TokenWarhallWhite',
  'TokenWarhallPurple',
  'Token3Inch',
  'Token5Inch',
];

export function nativeTokens() {
  const tokens = [
    ...tokenDefinitions.map(token => ({
      Id: tokenMenuId(token.name),
      Name: token.name,
      Type: 'Token',
    })),
    ...builtinTokenNames.map(name => ({
      Id: name,
      Name: name === 'Token5Inch' ? 'Blast Template' : name,
      Type: 'Token',
    })),
  ];
  const ranks = new Map(tokenMenuOrder.map((id, index) => [id, index]));
  return tokens.sort(
    (a, b) =>
      (ranks.get(a.Id) ?? Infinity) - (ranks.get(b.Id) ?? Infinity) ||
      a.Id.localeCompare(b.Id, 'en'),
  );
}

export function factionIcons(artwork) {
  return Object.keys(factionColors).map(faction => ({
    Id: `sc_icon_${faction.toLowerCase()}`,
    Name: faction,
    Type: 'faction',
    URL: artwork[faction.toLowerCase()],
  }));
}
