import assert from 'node:assert/strict';

export function flattenProfile(profile) {
  return [profile, ...(profile.Children ?? []).flatMap(flattenProfile)];
}

export function applyProfileOptions(data, profileId, unitId, optionIds) {
  const records = new Map(
    Object.values(data)
      .filter(Array.isArray)
      .flat()
      .filter(record => record.Id)
      .map(record => [record.Id, record]),
  );
  const instantiate = id => {
    const record = records.get(id);
    assert.ok(record, `Missing display record: ${id}`);
    return {
      ...structuredClone(record),
      Children: (record.Children ?? []).map(child => instantiate(child.Id)),
    };
  };
  const profile = instantiate(profileId);
  const remove = (parent, reference) => {
    if (!reference.Ref?.length) {
      parent.Children = parent.Children.filter(child => child.Id !== reference.Id);
      return;
    }
    const target = parent.Children.find(child => child.Id === reference.Id);
    if (target) for (const child of reference.Ref) remove(target, child);
  };
  const add = (parent, reference) => {
    if (!reference.Ref?.length) {
      parent.Children.push(instantiate(reference.Id));
      return;
    }
    let target = parent.Children.find(child => child.Id === reference.Id);
    if (!target) {
      target = instantiate(reference.Id);
      parent.Children.push(target);
    }
    for (const child of reference.Ref) add(target, child);
  };
  const modifiers = Object.entries(data)
    .filter(([file]) => file.endsWith('/modifiedprofile.json'))
    .flatMap(([, entries]) => entries);
  for (const optionId of optionIds) {
    assert.ok(records.has(optionId), `Unknown option: ${optionId}`);
    const modifier = modifiers.find(
      entry =>
        entry.OptionId === optionId && entry.ProfileId === profileId && entry.UnitId === unitId,
    );
    assert.ok(modifier, `Option does not apply to this unit/profile: ${optionId}`);
    for (const reference of modifier.ReferencedItemsToRemove ?? []) remove(profile, reference);
    for (const reference of modifier.ReferencedItemsToAdd ?? []) add(profile, reference);
    for (const reference of records.get(optionId).ItemsToAdd ?? []) add(profile, reference);
  }
  return profile;
}
