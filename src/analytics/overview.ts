import type { Asset, DatasetRevision, Observation } from '../domain/contracts';
import { histogram, summarize, type HistogramBin, type SummaryStatistics } from './statistics';

export interface AnalysisFilter {
  classId: string;
  location: string;
}

export interface AssetSummary {
  asset: Asset;
  output: number;
  demand: number;
  utilization: number;
  availability: number;
  coverage: number;
}

export interface MonthlyTrend {
  month: string;
  output: number;
  demand: number;
  potentialOutput: number;
}

export interface ClassComparison {
  classId: string;
  className: string;
  utilization: number;
  availability: number;
  assetCount: number;
}

export interface OverviewAnalysis {
  assetCount: number;
  availableAssetCount: number;
  effectiveCapacity: number;
  utilization: number;
  availability: number;
  observationCoverage: number;
  expectedObservations: number;
  admittedObservations: number;
  assetSummaries: AssetSummary[];
  trends: MonthlyTrend[];
  utilizationDistribution: HistogramBin[];
  utilizationStatistics: SummaryStatistics;
  classComparisons: ClassComparison[];
}

function observationsFor(dataset: DatasetRevision, assets: readonly Asset[]): Observation[] {
  const ids = new Set(assets.map((asset) => asset.id));
  return dataset.observations.filter((item) => ids.has(item.assetId));
}

function total(observations: readonly Observation[], metricId: string): number {
  return observations
    .filter((item) => item.metricId === metricId)
    .reduce((sum, item) => sum + item.value, 0);
}

function daysInDataset(dataset: DatasetRevision): number {
  return Math.round((new Date(dataset.endDate).getTime() - new Date(dataset.startDate).getTime()) / 86_400_000) + 1;
}

export function filterAssets(dataset: DatasetRevision, filter: AnalysisFilter): Asset[] {
  return dataset.assets.filter((asset) =>
    (filter.classId === 'all' || asset.classId === filter.classId)
    && (filter.location === 'all' || asset.location === filter.location));
}

export function analyzeOverview(dataset: DatasetRevision, filter: AnalysisFilter): OverviewAnalysis {
  const assets = filterAssets(dataset, filter);
  const observations = observationsFor(dataset, assets);
  const expectedObservations = daysInDataset(dataset) * assets.length * dataset.metrics.length;
  const summaries = assets.map((asset): AssetSummary => {
    const assetObservations = observations.filter((item) => item.assetId === asset.id);
    const output = total(assetObservations, 'output');
    const demand = total(assetObservations, 'demand');
    const availableHours = total(assetObservations, 'available-hours');
    const scheduledHours = total(assetObservations, 'scheduled-hours');
    const potential = availableHours * asset.ratedCapacity;
    const expected = daysInDataset(dataset) * dataset.metrics.length;
    return {
      asset,
      output,
      demand,
      utilization: potential > 0 ? output / potential : 0,
      availability: scheduledHours > 0 ? availableHours / scheduledHours : 0,
      coverage: expected > 0 ? assetObservations.length / expected : 0,
    };
  });
  const output = total(observations, 'output');
  const availableHours = total(observations, 'available-hours');
  const scheduledHours = total(observations, 'scheduled-hours');
  const potentialOutput = summaries.reduce((sum, item) => sum + item.asset.ratedCapacity * total(
    observations.filter((observation) => observation.assetId === item.asset.id),
    'available-hours',
  ), 0);
  const effectiveCapacity = scheduledHours > 0
    ? assets.reduce((sum, asset) => {
      const assetObservations = observations.filter((item) => item.assetId === asset.id);
      const scheduled = total(assetObservations, 'scheduled-hours');
      const available = total(assetObservations, 'available-hours');
      return sum + asset.ratedCapacity * (scheduled > 0 ? available / scheduled : 0);
    }, 0)
    : 0;

  const monthly = new Map<string, { output: number; demand: number; potentialOutput: number }>();
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  for (const item of observations) {
    const month = item.phenomenonTime.slice(0, 7);
    const entry = monthly.get(month) ?? { output: 0, demand: 0, potentialOutput: 0 };
    if (item.metricId === 'output') entry.output += item.value;
    if (item.metricId === 'demand') entry.demand += item.value;
    if (item.metricId === 'available-hours') entry.potentialOutput += item.value * assetMap.get(item.assetId)!.ratedCapacity;
    monthly.set(month, entry);
  }
  const trends = [...monthly.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([month, value]) => ({ month, ...value }));

  const classComparisons = dataset.resourceClasses.map((resourceClass) => {
    const classAssets = summaries.filter((item) => item.asset.classId === resourceClass.id);
    const classOutput = classAssets.reduce((sum, item) => sum + item.output, 0);
    const classAvailableHours = classAssets.reduce((sum, item) => sum + total(
      observations.filter((observation) => observation.assetId === item.asset.id),
      'available-hours',
    ), 0);
    const classScheduledHours = classAssets.reduce((sum, item) => sum + total(
      observations.filter((observation) => observation.assetId === item.asset.id),
      'scheduled-hours',
    ), 0);
    const classPotential = classAssets.reduce((sum, item) => sum + item.asset.ratedCapacity * total(
      observations.filter((observation) => observation.assetId === item.asset.id),
      'available-hours',
    ), 0);
    return {
      classId: resourceClass.id,
      className: resourceClass.name,
      utilization: classPotential > 0 ? classOutput / classPotential : 0,
      availability: classScheduledHours > 0 ? classAvailableHours / classScheduledHours : 0,
      assetCount: classAssets.length,
    };
  }).filter((item) => item.assetCount > 0);

  const utilizations = summaries.map((item) => item.utilization);
  const finalDay = dataset.endDate.slice(0, 10);
  const availableAssetIds = new Set(observations
    .filter((item) => item.metricId === 'available-hours' && item.phenomenonTime.startsWith(finalDay) && item.value > 0)
    .map((item) => item.assetId));

  return {
    assetCount: assets.length,
    availableAssetCount: availableAssetIds.size,
    effectiveCapacity,
    utilization: potentialOutput > 0 ? output / potentialOutput : 0,
    availability: scheduledHours > 0 ? availableHours / scheduledHours : 0,
    observationCoverage: expectedObservations > 0 ? observations.length / expectedObservations : 0,
    expectedObservations,
    admittedObservations: observations.length,
    assetSummaries: summaries,
    trends,
    utilizationDistribution: histogram(utilizations, 8),
    utilizationStatistics: summarize(utilizations),
    classComparisons,
  };
}

export function assetDailySeries(dataset: DatasetRevision, assetId: string, metricId: string): { time: string; value: number | null }[] {
  const byDay = new Map(dataset.observations
    .filter((item) => item.assetId === assetId && item.metricId === metricId)
    .map((item) => [item.phenomenonTime.slice(0, 10), item.value]));
  const start = new Date(dataset.startDate).getTime();
  const end = new Date(dataset.endDate).getTime();
  const points: { time: string; value: number | null }[] = [];
  for (let time = start; time <= end; time += 86_400_000) {
    const date = new Date(time).toISOString().slice(0, 10);
    points.push({ time: date, value: byDay.get(date) ?? null });
  }
  return points;
}
