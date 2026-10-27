import path from 'node:path';
import { readJson } from '../io.mjs';
import { projectRoot } from '../paths.mjs';

function positiveDimension(value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid base diameter: ${value}`);
  }
  return value;
}

function roundFootprint(diameter) {
  return {
    shape: 'round',
    widthMm: positiveDimension(diameter),
    lengthMm: diameter,
  };
}

function mappedFootprint(value) {
  if (typeof value === 'number') return roundFootprint(value);
  if (!value || value.shape !== 'oval') {
    throw new Error('Base override must be a diameter or an oval footprint');
  }

  const widthMm = positiveDimension(value.widthMm);
  const lengthMm = positiveDimension(value.lengthMm);
  if (widthMm === lengthMm) throw new Error('Oval footprint must have unequal axes');

  return { shape: 'oval', widthMm, lengthMm };
}

function printedFootprint(unit) {
  const printed = unit.provenance?.officialBase;

  if (/flight stand/i.test(printed?.label ?? '')) {
    return {
      ...roundFootprint(100),
      source: 'user flight stand convention (100 mm)',
    };
  }

  if (printed?.shape === 'round') {
    if (printed.widthMm !== printed.lengthMm) {
      throw new Error(`Unequal axes on printed round base: ${unit.name}`);
    }
    return { ...roundFootprint(printed.widthMm), source: 'printed PDF footprint' };
  }

  if (printed?.shape === 'oval') {
    return { ...mappedFootprint(printed), source: 'printed PDF footprint' };
  }

  throw new Error(`Missing or unreadable printed PDF base size: ${unit.name}`);
}

export async function loadBaseMapping(mode) {
  if (mode === 'pdf') return null;

  const mapping = await readJson(path.join(projectRoot, 'base-sizes.json'));
  positiveDimension(mapping.defaultDiameterMm);
  positiveDimension(mapping.heroDiameterMm);
  positiveDimension(mapping.flightStandDiameterMm);

  for (const units of Object.values(mapping.units)) {
    for (const value of Object.values(units)) {
      if (value !== null) mappedFootprint(value);
    }
  }

  return mapping;
}

export function resolveFootprint(unit, faction, mapping) {
  if (!mapping) return printedFootprint(unit);

  const override = mapping.units[faction]?.[unit.name];
  if (override != null) {
    return { ...mappedFootprint(override), source: 'unit override' };
  }

  if (unit.categories.includes('Hero')) {
    return { ...roundFootprint(mapping.heroDiameterMm), source: 'hero default' };
  }

  return {
    ...roundFootprint(mapping.defaultDiameterMm),
    source: 'default (pending confirmation)',
  };
}

export function describeFootprint(footprint) {
  if (footprint.shape === 'round') return `${footprint.widthMm} mm round`;
  return `${footprint.widthMm} x ${footprint.lengthMm} mm oval`;
}

export function baseDefinition(footprint) {
  const id =
    footprint.shape === 'round'
      ? `base_round_${footprint.widthMm}`
      : `base_oval_${footprint.widthMm}x${footprint.lengthMm}`;

  return {
    Id: id,
    Name: describeFootprint(footprint),
    Shape: 1,
    Width: footprint.widthMm,
    Length: footprint.lengthMm,
  };
}
