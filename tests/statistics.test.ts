import { describe, expect, it } from 'vitest';
import { histogram, quantile, summarize } from '../src/analytics/statistics';

describe('statistics', () => {
  it('uses independently hand-verifiable Type 7 quantiles', () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0.75)).toBe(3.25);
  });

  it('reports missingness and sample standard deviation', () => {
    const result = summarize([1, 2, 3, null]);
    expect(result).toMatchObject({ count: 3, missing: 1, mean: 2, median: 2, standardDeviation: 1 });
  });

  it('places maximum values in the final histogram bin', () => {
    expect(histogram([0, 1, 2, 3, 4], 2)).toEqual([
      { lower: 0, upper: 2, count: 2 },
      { lower: 2, upper: 4, count: 3 },
    ]);
  });

  it('rejects invalid quantile probabilities and bin counts', () => {
    expect(() => quantile([1], -0.1)).toThrow(RangeError);
    expect(() => histogram([1], 0)).toThrow(RangeError);
  });
});
