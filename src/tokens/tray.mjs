import { activationDiameterMm, tokenDefinitions } from './package.mjs';

// One reserve stack per player colour, outside the standard 54-inch board edge.
export function tokenTrayPlacements({ height }) {
  const radius = activationDiameterMm / 25.4 / 2;
  return ['blue', 'red'].flatMap(color => {
    const token = tokenDefinitions.find(token => token.id === `activation_${color}_arrow`);
    const direction = color === 'blue' ? 1 : -1;
    const placement = {
      Id: token.name,
      Type: 'Token',
      Quadrant: 1,
      Rotation: color === 'blue' ? 0 : 180,
      ShortSide: 56,
      LongSide: 18 + direction * (-height / 2 + radius),
    };
    return Array.from({ length: 15 }, () => ({ ...placement }));
  });
}
