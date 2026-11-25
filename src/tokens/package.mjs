import { markerTokens } from '../deployments/markers.mjs';
import tokenMenuOrder from '../../token-menu-order.json' with { type: 'json' };
import { tokenMenuId } from '../models/menu-ids.mjs';

export const tokenDiameterMm = 32;
export const activationDiameterMm = 32;
export const factionColors = { Terran: '#2467d1', Protoss: '#b68a20', Zerg: '#9a44bd' };

export const tokenDefinitions = [
  ...['blue', 'red'].map(color => ({
    id: `activation_${color}_arrow`,
    name: `Activation - ${color} - movement`,
    symbol: 'arrow',
    backSymbol: 'crosshair',
    diameterMm: activationDiameterMm,
    color: color === 'blue' ? '#2467d1' : '#d33d48',
    description: 'Two-sided activation marker: Movement front, Assault back.',
  })),
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
    diameterMm: 32,
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
].map(token => ({
  ...token,
  diameterMm: tokenDiameterMm,
  backSymbol: token.backSymbol ?? token.symbol,
}));

export const builtinTokenNames = [];

export function nativeTokens() {
  const tokens = [
    ...markerTokens(),
    ...tokenDefinitions.map(token => ({
      Id: tokenMenuId(token.name),
      Name: token.name,
      Type: 'Token',
      RadiusBaseDiameterMm: tokenDiameterMm,
    })),
    {
      Id: 'Token5Inch',
      Name: 'Blast Template',
      Type: 'Token',
      IsTemplate: true,
    },
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
