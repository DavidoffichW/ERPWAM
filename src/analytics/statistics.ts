export interface SummaryStatistics {
  count: number;
  missing: number;
  minimum: number | null;
  maximum: number | null;
  mean: number | null;
  median: number | null;
  q1: number | null;
  q3: number | null;
  standardDeviation: number | null;
  iqr: number | null;
}

export function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function quantile(values: readonly number[], probability: number): number | null {
  if (!values.length) return null;
  if (probability < 0 || probability > 1) throw new RangeError('Quantile probability must be between 0 and 1.');
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const fraction = index - lower;
  return sorted[lower]! * (1 - fraction) + sorted[upper]! * fraction;
}

export function summarize(values: readonly (number | null)[]): SummaryStatistics {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const average = mean(valid);
  const variance = valid.length > 1 && average !== null
    ? valid.reduce((sum, value) => sum + (value - average) ** 2, 0) / (valid.length - 1)
    : null;
  const q1 = quantile(valid, 0.25);
  const q3 = quantile(valid, 0.75);
  return {
    count: valid.length,
    missing: values.length - valid.length,
    minimum: valid.length ? Math.min(...valid) : null,
    maximum: valid.length ? Math.max(...valid) : null,
    mean: average,
    median: quantile(valid, 0.5),
    q1,
    q3,
    standardDeviation: variance === null ? null : Math.sqrt(variance),
    iqr: q1 === null || q3 === null ? null : q3 - q1,
  };
}

export interface HistogramBin {
  lower: number;
  upper: number;
  count: number;
}

export function histogram(values: readonly number[], binCount = 8): HistogramBin[] {
  if (!Number.isInteger(binCount) || binCount < 1) throw new RangeError('Histogram bin count must be a positive integer.');
  if (!values.length) return [];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) return [{ lower: minimum, upper: maximum, count: values.length }];
  const width = (maximum - minimum) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    lower: minimum + index * width,
    upper: index === binCount - 1 ? maximum : minimum + (index + 1) * width,
    count: 0,
  }));
  for (const value of values) {
    const index = Math.min(binCount - 1, Math.floor((value - minimum) / width));
    bins[index]!.count += 1;
  }
  return bins;
}
