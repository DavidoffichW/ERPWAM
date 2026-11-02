import { describe, expect, it } from 'vitest';
import { createJuniperDataset } from '../src/data/juniper';

describe('Fictional Juniper Works corpus', () => {
  it('generates byte-identical scientific content repeatedly', async () => {
    const first = await createJuniperDataset();
    const second = await createJuniperDataset();
    expect(first.contentHash).toBe('ceb2e1fe169008675ff0a927c9b7c03e6b071dccc0a929d106144d2105a8df0e');
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.revisionId).toBe(second.revisionId);
    expect(first.observations).toEqual(second.observations);
  });

  it('contains the declared synthetic scope and quality distinctions', async () => {
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
  });
});
