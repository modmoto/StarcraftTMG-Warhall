import { activationDiameterMm, tokenDefinitions } from './package.mjs';

export function tokenTrayPlacements({ height }) {
  const spacing = 1.375;
  const activationRadius = activationDiameterMm / 25.4 / 2;
  return ['blue', 'red'].flatMap(color => {
    const activation = [
      ['activation_blue_arrow', 'activation_red_arrow'],
      ['activation_red_crosshair', 'activation_blue_crosshair'],
    ]
      .flat()
      .map(id => tokenDefinitions.find(token => token.id === id));
    const tokensById = new Map(tokenDefinitions.map(token => [token.id, token]));
    const factions = [false, true].flatMap(inverted =>
      ['terran', 'protoss', 'zerg'].map(faction =>
        tokenDefinitions.find(
          token => token.id.startsWith(`faction_${faction}_`) && token.inverted === inverted,
        ),
      ),
    );
    const factionRow = spacing + 1.75;
    const effectRow = factionRow + 1.5 + 1.75;
    const groups = [
      { tokens: activation, columns: 2, x: 0, z: 0, pitch: spacing },
      { tokens: factions, columns: 3, x: 0, z: factionRow, pitch: 1.5 },
      { ids: ['debuff', 'buff'], columns: 1, x: 0, z: effectRow, pitch: 1.5 },
      {
        ids: ['stim', 'hidden', 'siege', 'burrowed', 'creep_tumor', 'shield'],
        columns: 3,
        x: 1.75,
        z: effectRow,
        pitch: 1.5,
      },
      {
        ids: ['bile_bomb', 'corrosive_bile'],
        columns: 1,
        x: 6.5,
        z: effectRow - 0.25,
        pitch: 2,
      },
    ];
    const direction = color === 'blue' ? 1 : -1;
    return groups.flatMap(group =>
      (group.tokens ?? group.ids.map(id => tokensById.get(id))).flatMap((token, index) => {
        const x = 27 + 2 + group.x + (index % group.columns) * group.pitch;
        const z =
          -height / 2 +
          activationRadius +
          group.z +
          Math.floor(index / group.columns) * group.pitch;
        const placement = {
          Id: token.name,
          Type: 'Token',
          Quadrant: 1,
          Rotation: color === 'blue' ? 0 : 180,
          ShortSide: 27 + x,
          LongSide: 18 + direction * z,
        };
        const count = group.tokens === activation ? 10 : 5;
        return Array.from({ length: count }, () => ({ ...placement }));
      }),
    );
  });
}
