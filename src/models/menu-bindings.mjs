import assert from 'node:assert/strict';

export const defaultMenuSkins = (usages, gameId, id) => [
  ...new Set(
    usages
      .filter(
        u =>
          u.profileId === id &&
          Number(u.gameId) === Number(gameId) &&
          Number(u.costumeDefault) === 1 &&
          !u.optionNames?.length,
      )
      .map(u => Number(u.skinId)),
  ),
];

export function menuBindingPlan(entries, usages, gameId) {
  return entries
    .filter(entry => ['token', 'terrain', 'marker'].includes(entry.kind))
    .map(entry => {
      const source = defaultMenuSkins(usages, gameId, entry.profileId);
      const target = defaultMenuSkins(usages, gameId, entry.name);
      assert.equal(source.length, 1, `Expected one canonical shared skin: ${entry.profileId}`);
      assert.ok(
        target.length === 0 || (target.length === 1 && target[0] === source[0]),
        `Conflicting menu skin: ${entry.name}`,
      );
      return {
        canonicalId: entry.profileId,
        menuId: entry.name,
        skinId: source[0],
        assigned: target.length === 1,
      };
    });
}
