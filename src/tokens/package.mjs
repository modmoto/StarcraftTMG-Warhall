import tokenMenuOrder from '../../token-menu-order.json' with { type: 'json' };
import { tokenMenuId } from '../models/menu-ids.mjs';

export const tokenDiameterMm = 25;
export const factionColors = { Terran: '#2467d1', Protoss: '#e7be24', Zerg: '#9a44bd' };

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
      color,
      inverted,
      description:
        'Faction marker. Use the inverted colour scheme to distinguish a second player of the same faction.',
    })),
  ),
  ...[
    ['buff', 'Buff', '#2467d1'],
    ['debuff', 'Debuff', '#d33d48'],
  ].map(([id, name, color]) => ({
    id,
    name,
    symbol: id,
    color,
    description: `${name} reminder. Track the effect and its value using the token notes.`,
  })),
  ...[
    ['stim', 'Stim', '#2467d1'],
    ['burrowed', 'Burrowed', '#9a44bd'],
    ['hidden', 'Hidden', '#299c77'],
    ['siege', 'Siege Status', '#df9f35'],
  ].map(([id, name, color]) => ({
    id,
    name,
    symbol: id,
    color,
    description: `Reminder for ${name}. Apply the unit's printed rules manually.`,
  })),
  {
    id: 'shield',
    name: 'Shield',
    symbol: 'shield',
    color: '#194fa8',
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
    ...builtinTokenNames.map(name => ({ Id: name, Name: name, Type: 'Token' })),
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
