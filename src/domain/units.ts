import type { UnitDefinition } from './contracts';

export const UNIT_REGISTRY: Readonly<Record<string, UnitDefinition>> = {
  '1': { code: '1', symbol: '', quantity: 'ratio', toCanonicalFactor: 1 },
  '%': { code: '%', symbol: '%', quantity: 'ratio', toCanonicalFactor: 0.01 },
  h: { code: 'h', symbol: 'h', quantity: 'duration', toCanonicalFactor: 1 },
  min: { code: 'min', symbol: 'min', quantity: 'duration', toCanonicalFactor: 1 / 60 },
  u: { code: 'u', symbol: 'u', quantity: 'count', toCanonicalFactor: 1 },
  'u/h': { code: 'u/h', symbol: 'u/h', quantity: 'rate', toCanonicalFactor: 1 },
  kWh: { code: 'kWh', symbol: 'kWh', quantity: 'energy', toCanonicalFactor: 1 },
  MWh: { code: 'MWh', symbol: 'MWh', quantity: 'energy', toCanonicalFactor: 1000 },
};

export function convertUnit(value: number, fromCode: string, toCode: string): number {
  if (!Number.isFinite(value)) throw new TypeError('Unit conversion requires a finite value.');
  const from = UNIT_REGISTRY[fromCode];
  const to = UNIT_REGISTRY[toCode];
  if (!from || !to) throw new RangeError(`Unsupported unit conversion: ${fromCode} to ${toCode}`);
  if (from.quantity !== to.quantity) {
    throw new RangeError(`Incompatible units: ${fromCode} and ${toCode}`);
  }
  return (value * from.toCanonicalFactor) / to.toCanonicalFactor;
}
