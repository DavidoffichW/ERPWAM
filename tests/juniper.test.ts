import { describe, expect, it } from 'vitest';
import { createJuniperDataset } from '../src/data/juniper';

describe('Juniper Works corpus', () => {
  it('generates byte-identical scientific content repeatedly', async () => {
    const first = await createJuniperDataset();
    const second = await createJuniperDataset();
    expect(first.contentHash).toBe('7be8622f2d3966cb63b04b55dbce3ff487df3bf4150a1f80436ad6352282e0f8');
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.revisionId).toBe(second.revisionId);
    expect(first.observations).toEqual(second.observations);
  });

  it('contains the declared scope and quality distinctions', async () => {
    const dataset = await createJuniperDataset();
    expect(dataset.fictional).toBe(true);
    expect(dataset.assets).toHaveLength(18);
    expect(dataset.resourceClasses).toHaveLength(3);
    expect(dataset.metrics).toHaveLength(5);
    expect(new Set(dataset.qualityIssues.map((issue) => issue.kind))).toEqual(new Set(['MISSING', 'INVALID', 'DUPLICATE', 'CONFLICTING', 'EXCLUDED']));
    expect(dataset.observations.some((item) => item.metricId === 'output' && item.value === 0)).toBe(true);
    expect(dataset.observations.every((item) => item.layer === 'OBSERVED' && Number.isFinite(item.value))).toBe(true);
  });

  it('uses an explicit UTC daily cadence and records admitted gaps separately', async () => {
    const dataset = await createJuniperDataset();
    expect(dataset.metrics.every((metric) => metric.expectedCadence === 'P1D')).toBe(true);
    const series = dataset.observations
      .filter((item) => item.assetId === 'asset-01' && item.metricId === 'output')
      .map((item) => Date.parse(item.phenomenonTime));
    const day = 86_400_000;
    expect(series.every((time, index) => index === 0 || (time - series[index - 1]!) % day === 0)).toBe(true);
    expect(dataset.qualityIssues.some((issue) => issue.kind === 'MISSING')).toBe(true);
    const missingOrInvalid = dataset.qualityIssues.filter((issue) => issue.kind === 'MISSING' || issue.kind === 'INVALID');
    const expected = dataset.assets.length * 546 * dataset.metrics.length;
    expect(expected - dataset.observations.length).toBe(missingOrInvalid.length);
    for (const issue of missingOrInvalid) {
      const admitted = dataset.observations.some((item) => item.assetId === issue.assetId
        && item.metricId === issue.metricId
        && item.phenomenonTime === issue.phenomenonTime);
      expect(admitted).toBe(false);
    }
  });
});
