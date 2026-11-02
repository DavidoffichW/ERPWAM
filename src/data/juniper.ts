import { contentIdentity } from '../domain/canonical';
import type {
  Asset,
  DataQualityIssue,
  DatasetRevision,
  MetricDefinition,
  Observation,
  ResourceClass,
} from '../domain/contracts';

const SEED = 4_271_903;
const GENERATED_AT = '2026-11-02T00:00:00.000Z';
const START = new Date('2025-01-01T00:00:00.000Z');
const DAYS = 546;

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function dateAt(day: number): string {
  return new Date(START.getTime() + day * 86_400_000).toISOString();
}

const classes: ResourceClass[] = [
  { id: 'class-forming', name: 'Forming', description: 'Shape-forming assets.' },
  { id: 'class-finishing', name: 'Finishing', description: 'Finishing assets.' },
  { id: 'class-inspection', name: 'Inspection', description: 'Inspection assets.' },
];

const metrics: MetricDefinition[] = [
  { id: 'scheduled-hours', name: 'Scheduled hours', unit: 'h', quantity: 'duration', aggregation: 'SUM', expectedCadence: 'P1D', zeroIsMeaningful: true },
  { id: 'available-hours', name: 'Available hours', unit: 'h', quantity: 'duration', aggregation: 'SUM', expectedCadence: 'P1D', zeroIsMeaningful: true },
  { id: 'output', name: 'Output', unit: 'u', quantity: 'count', aggregation: 'SUM', expectedCadence: 'P1D', zeroIsMeaningful: true },
  { id: 'demand', name: 'Demand', unit: 'u', quantity: 'count', aggregation: 'SUM', expectedCadence: 'P1D', zeroIsMeaningful: true },
  { id: 'energy', name: 'Energy', unit: 'kWh', quantity: 'energy', aggregation: 'SUM', expectedCadence: 'P1D', zeroIsMeaningful: true },
];

function createAssets(): Asset[] {
  const locations = ['North Hall', 'East Hall', 'West Hall'];
  return Array.from({ length: 18 }, (_, index) => {
    const classItem = classes[index % classes.length]!;
    const number = String(index + 1).padStart(2, '0');
    return {
      id: `asset-${number}`,
      code: `JW-${number}`,
      name: `${classItem.name} unit ${number}`,
      classId: classItem.id,
      location: locations[index % locations.length]!,
      ratedCapacity: 34 + (index % 6) * 4 + Math.floor(index / 6) * 3,
      capacityUnit: 'u/h',
      commissionedAt: `202${index % 4}-0${(index % 8) + 1}-01T00:00:00.000Z`,
      retiredAt: null,
    };
  });
}

function observation(
  asset: Asset,
  metric: MetricDefinition,
  day: number,
  value: number,
): Observation {
  const time = dateAt(day);
  return {
    id: `${asset.id}:${metric.id}:${time.slice(0, 10)}`,
    assetId: asset.id,
    metricId: metric.id,
    phenomenonTime: time,
    resultTime: new Date(new Date(time).getTime() + 3_600_000).toISOString(),
    value: Number(value.toFixed(6)),
    unit: metric.unit,
    quality: 'VALID',
    provenanceId: 'provenance-juniper-v1',
    layer: 'OBSERVED',
  };
}

export async function createJuniperDataset(): Promise<DatasetRevision> {
  const random = createRandom(SEED);
  const assets = createAssets();
  const observations: Observation[] = [];
  const qualityIssues: DataQualityIssue[] = [];

  for (let assetIndex = 0; assetIndex < assets.length; assetIndex += 1) {
    const asset = assets[assetIndex]!;
    for (let day = 0; day < DAYS; day += 1) {
      const issueKey = assetIndex * 37 + day;
      const time = dateAt(day);
      const missingOutput = issueKey > 0 && issueKey % 613 === 0;
      const invalidAvailableHours = issueKey > 0 && issueKey % 997 === 0;
      if (missingOutput) {
        qualityIssues.push({ id: `missing:${asset.id}:${day}`, kind: 'MISSING', assetId: asset.id, metricId: 'output', phenomenonTime: time, message: 'Expected daily observation was not supplied.' });
      }
      if (invalidAvailableHours) {
        qualityIssues.push({ id: `invalid:${asset.id}:${day}`, kind: 'INVALID', assetId: asset.id, metricId: 'available-hours', phenomenonTime: time, message: 'Source value exceeded the declared 24-hour domain and was rejected.' });
      }

      const scheduledHours = 24;
      const plannedStop = (day + assetIndex * 5) % 97 === 0;
      const weekly = Math.sin((2 * Math.PI * day) / 7);
      const seasonal = Math.sin((2 * Math.PI * day) / 91);
      const assetAvailabilityOffset = ((assetIndex % 6) - 2.5) * 0.008;
      const availability = plannedStop ? 0 : Math.min(0.99, Math.max(0.72, 0.94 + assetAvailabilityOffset + 0.025 * weekly - random() * 0.035));
      const availableHours = scheduledHours * availability;
      const trend = 0.00008 * day;
      const assetUtilizationOffset = ((assetIndex % 6) - 2.5) * 0.018 + ((assetIndex % 3) - 1) * 0.025;
      const utilization = plannedStop ? 0 : Math.min(0.94, Math.max(0.38, 0.62 + assetUtilizationOffset + trend + 0.09 * seasonal + (random() - 0.5) * 0.08));
      const output = asset.ratedCapacity * availableHours * utilization;
      const demand = asset.ratedCapacity * scheduledHours * Math.min(0.96, 0.69 + 0.07 * seasonal + (random() - 0.5) * 0.04);
      const energy = output * (0.44 + (assetIndex % 4) * 0.025);
      const values = [scheduledHours, availableHours, output, demand, energy];
      for (let metricIndex = 0; metricIndex < metrics.length; metricIndex += 1) {
        const metric = metrics[metricIndex]!;
        if ((metric.id === 'output' && missingOutput)
          || (metric.id === 'available-hours' && invalidAvailableHours)) continue;
        observations.push(observation(asset, metric, day, values[metricIndex]!));
      }

      if (issueKey > 0 && issueKey % 887 === 0) {
        qualityIssues.push({ id: `duplicate:${asset.id}:${day}`, kind: 'DUPLICATE', assetId: asset.id, metricId: 'output', phenomenonTime: time, message: 'An exact duplicate source row was detected and excluded.' });
      }
      if (issueKey > 0 && issueKey % 503 === 0) {
        qualityIssues.push({ id: `conflict:${asset.id}:${day}`, kind: 'CONFLICTING', assetId: asset.id, metricId: 'output', phenomenonTime: time, message: 'A conflicting duplicate source value was excluded; the independently identified admitted value was retained.' });
      }
      if (issueKey > 0 && issueKey % 701 === 0) {
        qualityIssues.push({ id: `excluded:${asset.id}:${day}`, kind: 'EXCLUDED', assetId: asset.id, metricId: 'energy', phenomenonTime: time, message: 'A source record outside the admitted study interval was excluded.' });
      }
    }
  }

  const source = { assets, classes, metrics, observations, qualityIssues, seed: SEED };
  const contentHash = await contentIdentity(source);
  return {
    schema: 'erpwam.analytics.dataset/1',
    revisionId: `juniper-${contentHash.slice(0, 16)}`,
    title: 'Juniper Works',
    fictional: true,
    timezone: 'UTC',
    startDate: dateAt(0),
    endDate: dateAt(DAYS - 1),
    resourceClasses: classes,
    assets,
    metrics,
    observations,
    qualityIssues,
    provenance: [{
      id: 'provenance-juniper-v1',
      sourceKind: 'SYNTHETIC_GENERATOR',
      sourceName: 'Juniper Works generator',
      sourceHash: contentHash,
      generatedAt: GENERATED_AT,
      generatorVersion: '1',
      seed: SEED,
      notes: 'Daily Juniper Works observations generated from versioned inputs.',
    }],
    contentHash,
  };
}

export async function createJuniperProject() {
  const dataset = await createJuniperDataset();
  return {
    schema: 'erpwam.analytics.project/1' as const,
    id: 'project-juniper-works',
    title: 'Juniper Works analysis',
    createdAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    dataset,
    view: {
      selectedAssetId: null,
      classFilter: 'all',
      locationFilter: 'all',
      route: 'overview' as const,
    },
    forecastRuns: [],
    scenarios: [],
  };
}
