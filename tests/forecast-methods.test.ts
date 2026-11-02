import { describe, expect, it } from 'vitest';
import { forecastValues } from '../src/forecast/methods';

const parameters = { seasonalPeriod: 3, movingWindow: 3 };

describe('forecast baselines', () => {
  it('matches hand-calculated method references', () => {
    expect(forecastValues('NAIVE', [1, 2, 4], 3, parameters)).toEqual([4, 4, 4]);
    expect(forecastValues('SEASONAL_NAIVE', [1, 2, 3, 4, 5, 6], 4, parameters)).toEqual([4, 5, 6, 4]);
    expect(forecastValues('DRIFT', [1, 2, 5], 2, parameters)).toEqual([7, 9]);
    expect(forecastValues('MOVING_MEAN', [1, 2, 3, 4], 2, parameters)).toEqual([3, 3]);
  });

  it('rejects incomplete or non-finite method inputs', () => {
    expect(() => forecastValues('DRIFT', [1], 1, parameters)).toThrow(RangeError);
    expect(() => forecastValues('NAIVE', [Number.NaN], 1, parameters)).toThrow(TypeError);
    expect(() => forecastValues('SEASONAL_NAIVE', [1, 2], 1, parameters)).toThrow(RangeError);
  });
});
