import { describe, expect, it } from 'vitest';
import type { ForecastSpec } from '../src/domain/contracts';
import { prepareTraining, runForecast, type SeriesPoint } from '../src/forecast/backtest';

const spec: ForecastSpec = {
  schema: 'erpwam.analytics.forecast-spec/1', assetId: 'asset-01', metricId: 'output', method: 'NAIVE',
  horizon: 2, initialWindow: 4, step: 1, seasonalPeriod: 2, movingWindow: 2,
  missingPolicy: 'LINEAR_INTERIOR_SHORT_GAPS', maxGap: 1, intervalMinimumSamples: 2,
};

function points(values: (number | null)[]): SeriesPoint[] {
  return values.map((value, index) => ({ time: `2026-01-${String(index + 1).padStart(2, '0')}`, value }));
}

describe('rolling-origin backtesting', () => {
  it('interpolates only admitted interior gaps', () => {
    expect(prepareTraining([1, null, 3], 'LINEAR_INTERIOR_SHORT_GAPS', 1)).toEqual([1, 2, 3]);
    expect(() => prepareTraining([null, 2, 3], 'LINEAR_INTERIOR_SHORT_GAPS', 1)).toThrow(RangeError);
    expect(() => prepareTraining([1, null, null, 4], 'LINEAR_INTERIOR_SHORT_GAPS', 1)).toThrow(RangeError);
    expect(() => prepareTraining([1, null, 3], 'REQUIRE_CONTIGUOUS', 1)).toThrow(RangeError);
  });

  it('uses only values available before each target', async () => {
    const original = points([1, 2, 3, 4, 5, 6, 7, 8]);
    const changedFuture = points([1, 2, 3, 4, 5, 600, 700, 800]);
    const first = await runForecast('revision', 'u', original, spec);
    const second = await runForecast('revision', 'u', changedFuture, spec);
    const firstOriginPrediction = first.predictions.find((item) => item.originIndex === 3 && item.horizon === 1)!;
    const secondOriginPrediction = second.predictions.find((item) => item.originIndex === 3 && item.horizon === 1)!;
    expect(firstOriginPrediction.predicted).toBe(secondOriginPrediction.predicted);
    expect(firstOriginPrediction.trainingEndTime < firstOriginPrediction.targetTime).toBe(true);
  });

  it('reports independently checkable error metrics', async () => {
    const result = await runForecast('revision', 'u', points([1, 2, 3, 4, 5, 6, 7, 8]), spec);
    expect(result.metrics.sampleCount).toBeGreaterThan(0);
    expect(result.metrics.mae).toBe(1.5);
    expect(result.metrics.rmse).toBeCloseTo(Math.sqrt(2.5));
    expect(result.metrics.bias).toBe(1.5);
    expect(result.forecast.every((item) => item.layer === 'FORECAST')).toBe(true);
  });

  it('marks MASE unavailable for a constant training scale', async () => {
    const result = await runForecast('revision', 'u', points([2, 2, 2, 2, 2, 2, 2, 2]), spec);
    expect(result.metrics.mase).toBeNull();
  });
});
