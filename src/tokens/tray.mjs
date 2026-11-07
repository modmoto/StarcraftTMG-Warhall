import { tokenDefinitions } from './package.mjs';
import { tokenMenuId } from '../models/menu-ids.mjs';

export function tokenTrayPlacements({ width, height }) {
  const rows = tokenDefinitions.map(token => ({
    token,
    count: token.id.startsWith('activation_') ? 5 : 1,
  }));
  const spacing = 1.25;
  return rows.flatMap(({ token, count }, row) =>
    Array.from({ length: count }, (_, column) => ({
      Id: tokenMenuId(token.name),
      Type: 'Token',
      Quadrant: 1,
      Rotation: 0,
      ShortSide: 27 + width / 2 + 2 + column * spacing,
      LongSide: height / 2 + ((rows.length - 1) / 2 - row) * spacing,
    })),
  );
}
