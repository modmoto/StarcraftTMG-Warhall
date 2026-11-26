import { activationDiameterMm, tokenDefinitions } from './package.mjs';

// Both colours at each player's end, outside the standard 54-inch board edge.
export function tokenTrayPlacements({ height }) {
  const radius = activationDiameterMm / 25.4 / 2;
  const stackSpacing = (activationDiameterMm + 10) / 25.4;
  return [1, -1].flatMap(direction =>
    ['blue', 'red'].flatMap((color, index) => {
      const token = tokenDefinitions.find(token => token.id === `activation_${color}_arrow`);
      const placement = {
        Id: token.displayName ?? token.name,
        Type: 'Token',
        Quadrant: 1,
        Rotation: direction === 1 ? 0 : 180,
        ShortSide: 56 + index * stackSpacing,
        LongSide: 18 + direction * (-height / 2 + radius),
      };
      return Array.from({ length: 15 }, () => ({ ...placement }));
    }),
  );
}
