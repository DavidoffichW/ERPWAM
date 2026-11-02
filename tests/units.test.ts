import { describe, expect, it } from 'vitest';
import { convertUnit } from '../src/domain/units';

describe('unit conversion', () => {
  it('converts declared compatible units', () => {
    expect(convertUnit(60, 'min', 'h')).toBeCloseTo(1);
    expect(convertUnit(2.5, 'MWh', 'kWh')).toBe(2500);
    expect(convertUnit(75, '%', '1')).toBe(0.75);
  });

  it('rejects incompatible, unknown, and non-finite inputs', () => {
    expect(() => convertUnit(1, 'h', 'kWh')).toThrow('Incompatible units');
    expect(() => convertUnit(1, 'bogus', 'h')).toThrow('Unsupported unit');
    expect(() => convertUnit(Number.NaN, 'h', 'h')).toThrow(TypeError);
  });
});
