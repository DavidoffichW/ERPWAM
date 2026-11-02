import { describe, expect, it } from 'vitest';
import type { ForecastRun } from '../src/domain/contracts';
import { applyScenario } from '../src/scenarios/scenario';

const baseline: ForecastRun = {
  schema: 'erpwam.analytics.forecast-run/1', id: 'forecast-1', inputRevisionId: 'revision-1', algorithmVersion: '1',
  spec: { schema: 'erpwam.analytics.forecast-spec/1', assetId: 'asset-01', metricId: 'output', method: 'NAIVE', horizon: 2, initialWindow: 4, step: 1, seasonalPeriod: 2, movingWindow: 2, missingPolicy: 'REQUIRE_CONTIGUOUS', maxGap: 0, intervalMinimumSamples: 2 },
  trainingCutoff: '2026-01-01', predictions: [], excludedFolds: [], metrics: { mae: null, rmse: null, mase: null, bias: null, sampleCount: 0, foldCount: 0 }, diagnostics: [], warnings: [],
  forecast: [
    { time: '2026-01-02', value: 100, lower80: null, upper80: null, unit: 'u', layer: 'FORECAST' },
    { time: '2026-01-03', value: 120, lower80: null, upper80: null, unit: 'u', layer: 'FORECAST' },
  ],
};

describe('scenario isolation', () => {
  it('creates a separate hypothetical layer without mutating the forecast', async () => {
    const original = structuredClone(baseline);
    const result = await applyScenario(baseline, { kind: 'CAPACITY_MULTIPLIER', value: 1.1, unit: '1', effectiveFrom: '2026-01-02' });
    expect(result.points[0]!.value).toBeCloseTo(110);
    expect(result.points[1]!.value).toBeCloseTo(132);
    expect(result.points.every((item) => item.layer === 'SCENARIO')).toBe(true);
    expect(baseline).toEqual(original);
  });
});
