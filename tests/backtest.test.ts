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
    expect(result.metrics.mase).toBe(1.5);
    expect(result.metrics.bias).toBe(1.5);
    expect(result.metrics.foldCount).toBe(3);
    expect(result.metrics.intervalCoverage80).toBe(1);
    expect(result.metrics.intervalMeanWidth80).toBe(0);
    expect(result.metrics.intervalSampleCount).toBe(2);
    expect(result.diagnostics[0]).toMatchObject({
      horizon: 1,
      mae: 1,
      rmse: 1,
      mase: 1,
      bias: 1,
      intervalCoverage80: 1,
      intervalSampleCount: 1,
    });
    expect(result.diagnostics[1]).toMatchObject({
      horizon: 2,
      mae: 2,
      rmse: 2,
      mase: 2,
      bias: 2,
      intervalCoverage80: 1,
      intervalSampleCount: 1,
    });
    expect(result.forecast.every((item) => item.layer === 'FORECAST')).toBe(true);
  });

  it('marks MASE unavailable for a constant training scale', async () => {
    const result = await runForecast('revision', 'u', points([2, 2, 2, 2, 2, 2, 2, 2]), spec);
    expect(result.metrics.mase).toBeNull();
  });

  it('rejects invalid rolling controls before iteration', async () => {
    await expect(runForecast('revision', 'u', points([1, 2, 3, 4, 5, 6]), { ...spec, step: 0 }))
      .rejects.toThrow('Rolling-origin step must be a positive integer');
    await expect(runForecast('revision', 'u', points([1, 2, 3, 4, 5, 6]), { ...spec, horizon: -1 }))
      .rejects.toThrow('Forecast horizon must be a positive integer');
    await expect(runForecast('revision', 'u', [
      { time: '2026-01-01', value: 1 },
      { time: '2026-01-03', value: 2 },
      { time: '2026-01-04', value: 3 },
      { time: '2026-01-05', value: 4 },
      { time: '2026-01-06', value: 5 },
      { time: '2026-01-07', value: 6 },
    ], spec)).rejects.toThrow('strictly ordered daily UTC cadence');
  });

  it('excludes and explains complete folds with missing targets', async () => {
    const result = await runForecast('revision', 'u', points([1, 2, 3, 4, null, 6, 7, 8]), spec);
    expect(result.excludedFolds).toEqual([
      { originIndex: 3, reason: 'Test window contains missing target observation(s) at horizon 1.' },
      { originIndex: 4, reason: 'Training window contains an unsupported gap of 1 observation(s).' },
    ]);
    expect(result.metrics.foldCount).toBe(1);
    expect(result.predictions).toHaveLength(2);
  });
});
