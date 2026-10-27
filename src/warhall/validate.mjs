import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function validateData(data) {
  const manifest = data['manifest.json'];
  if (!manifest || !Array.isArray(manifest.files)) throw new Error('Missing manifest.files');
  if (new Set(manifest.files).size !== manifest.files.length)
    throw new Error('Duplicate manifest paths');
  const ids = new Map();
  for (const name of manifest.files) {
    if (path.isAbsolute(name) || name.split(/[\\/]/).includes('..'))
      throw new Error(`Unsafe manifest path: ${name}`);
    if (!(name in data)) throw new Error(`Missing manifest file: ${name}`);
    if (!Array.isArray(data[name]) || ['objectives.json', 'deployments.json'].includes(name))
      continue;
    for (const record of data[name]) {
      if (!record || typeof record.Id !== 'string' || !record.Id)
        throw new Error(`Missing record ID: ${name}`);
      if (ids.has(record.Id)) throw new Error(`Duplicate ID: ${record.Id}`);
      ids.set(record.Id, record);
    }
  }
  const ref = (id, context, expected) => {
    const target = ids.get(id);
    if (!target) throw new Error(`Unresolved reference ${id}: ${context}`);
    if (expected && target.Type !== expected)
      throw new Error(`Expected ${expected} at ${context}: ${id}`);
    return target;
  };
  for (const item of ids.values()) {
    for (const id of item.BasicProfileIds ?? []) ref(id, item.Id, 'Profile');
    for (const child of item.Children ?? []) ref(child.Id, item.Id);
    if (item.BaseId) {
      const base = ref(item.BaseId, item.Id);
      if (
        base.Shape !== 1 ||
        !Number.isFinite(base.Width) ||
        base.Width <= 0 ||
        !Number.isFinite(base.Length) ||
        base.Length <= 0
      )
        throw new Error(`Expected positive round/oval base dimensions: ${item.Id}`);
    }
    if (item.Type === 'Statline') {
      const hpKey = data['gameconfig.json']?.WoundsAttribute;
      if (
        !hpKey ||
        !/^\d+$/.test(item.Attributes?.[hpKey] ?? '') ||
        Number(item.Attributes[hpKey]) <= 0
      )
        throw new Error(`Invalid configured HP: ${item.Id}`);
    }
  }
  for (const objective of data['objectives.json'] ?? []) {
    for (const item of objective.Items ?? []) ref(item.Id, `objective ${objective.Name}`);
  }
  const inHierarchy = new Set();
  for (const groups of Object.values(data['hierarchy.json']?.Factions ?? {})) {
    for (const units of Object.values(groups))
      for (const id of units) {
        ref(id, 'hierarchy', 'Unit');
        inHierarchy.add(id);
      }
  }
  const units = [...ids.values()].filter(item => item.Type === 'Unit');
  if (!units.length) throw new Error('Package contains no units');
  for (const unit of units)
    if (!inHierarchy.has(unit.Id)) throw new Error(`Unit missing from hierarchy: ${unit.Id}`);
  return { units: units.length, records: ids.size, files: manifest.files.length };
}
export async function validatePackage(root) {
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  const data = { 'manifest.json': manifest };
  for (const name of manifest.files) {
    if (path.isAbsolute(name) || name.split(/[\\/]/).includes('..'))
      throw new Error(`Unsafe manifest path: ${name}`);
    data[name] = JSON.parse((await readFile(path.join(root, name), 'utf8')).replace(/^\uFEFF/, ''));
  }
  return validateData(data);
}
