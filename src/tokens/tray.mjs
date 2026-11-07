import { tokenDefinitions } from './package.mjs';

export function tokenTrayPlacements({ width, height }) {
  const spacing = 1.25;
  return ['blue', 'red'].flatMap(color => {
    const activation = tokenDefinitions.filter(token =>
      ['activation_blue_arrow', 'activation_red_crosshair'].includes(token.id),
    );
    const buffs = tokenDefinitions.filter(token => ['buff', 'debuff'].includes(token.id));
    const factions = [false, true].flatMap(inverted =>
      ['terran', 'protoss', 'zerg'].map(faction =>
        tokenDefinitions.find(
          token => token.id.startsWith(`faction_${faction}_`) && token.inverted === inverted,
        ),
      ),
    );
    const others = tokenDefinitions.filter(
      token =>
        !token.id.startsWith('activation_') &&
        !token.id.startsWith('faction_') &&
        !['buff', 'debuff'].includes(token.id),
    );
    const groups = [
      { tokens: activation.flatMap(token => Array(5).fill(token)), columns: 5, row: 0 },
      { tokens: [...buffs].reverse(), columns: 1, row: 3, column: 0 },
      { tokens: factions, columns: 3, row: 3, column: 2 },
      { tokens: others, columns: 4, row: 6, column: 0 },
    ];
    const direction = color === 'blue' ? 1 : -1;
    return groups.flatMap(group =>
      group.tokens.map((token, index) => {
        const groupSpacing = group.tokens === factions ? 1.5 : spacing;
        const x =
          width / 2 + 2 + (group.column ?? 0) * spacing + (index % group.columns) * groupSpacing;
        const z =
          -height / 2 + 2 + group.row * spacing + Math.floor(index / group.columns) * groupSpacing;
        return {
          Id: token.name,
          Type: 'Token',
          Quadrant: 1,
          Rotation: color === 'blue' ? 0 : 180,
          ShortSide: 27 + x,
          LongSide: 18 + direction * z,
        };
      }),
    );
  });
}
