import { describe, expect, it } from 'vitest';
import { analyzeOverview } from '../src/analytics/overview';
import { createJuniperDataset } from '../src/data/juniper';

describe('overview calculations', () => {
  it('recomputes weighted ratios from their denominators', async () => {
    const dataset = await createJuniperDataset();
    const analysis = analyzeOverview(dataset, { classId: 'all', location: 'all' });
    const output = dataset.observations.filter((item) => item.metricId === 'output').reduce((total, item) => total + item.value, 0);
    const capacityHours = dataset.observations.filter((item) => item.metricId === 'available-hours').reduce((total, item) => {
      const asset = dataset.assets.find((candidate) => candidate.id === item.assetId)!;
      return total + item.value * asset.ratedCapacity;
    }, 0);
    expect(analysis.assetCount).toBe(18);
    expect(analysis.availableAssetCount).toBeLessThanOrEqual(18);
    expect(analysis.utilization).toBeGreaterThan(0);
    expect(analysis.utilization).toBeLessThan(1);
    expect(analysis.availability).toBeGreaterThan(0);
    expect(analysis.observationCoverage).toBeLessThan(1);
    expect(analysis.utilization).toBeCloseTo(output / capacityHours, 12);
    expect(analysis.trends).toHaveLength(18);
  });

  it('applies class and location filters without changing the dataset', async () => {
    const dataset = await createJuniperDataset();
    const originalCount = dataset.observations.length;
    const result = analyzeOverview(dataset, { classId: 'class-forming', location: 'North Hall' });
    expect(result.assetSummaries.every((item) => item.asset.classId === 'class-forming' && item.asset.location === 'North Hall')).toBe(true);
    expect(dataset.observations).toHaveLength(originalCount);
  });
});
