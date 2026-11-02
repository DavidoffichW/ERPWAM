export type SemanticLayer = 'OBSERVED' | 'DERIVED' | 'FORECAST' | 'SCENARIO';

export type ObservationQuality = 'VALID' | 'SUSPECT';
export type DataIssueKind = 'MISSING' | 'INVALID' | 'DUPLICATE' | 'CONFLICTING' | 'EXCLUDED';

export interface UnitDefinition {
  code: string;
  symbol: string;
  quantity: 'count' | 'duration' | 'energy' | 'rate' | 'ratio';
  toCanonicalFactor: number;
}

export interface MetricDefinition {
  id: string;
  name: string;
  unit: string;
  quantity: UnitDefinition['quantity'];
  aggregation: 'SUM' | 'MEAN' | 'LAST' | 'RATIO';
  expectedCadence: 'P1D';
  zeroIsMeaningful: boolean;
}

export interface ResourceClass {
  id: string;
  name: string;
  description: string;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  classId: string;
  location: string;
  ratedCapacity: number;
  capacityUnit: 'u/h';
  commissionedAt: string;
  retiredAt: string | null;
}

export interface ProvenanceRecord {
  id: string;
  sourceKind: 'SYNTHETIC_GENERATOR' | 'PORTABLE_PROJECT';
  sourceName: string;
  sourceHash: string;
  generatedAt: string;
  generatorVersion: string;
  seed: number;
  notes: string;
}

export interface Observation {
  id: string;
  assetId: string;
  metricId: string;
  phenomenonTime: string;
  resultTime: string;
  value: number;
  unit: string;
  quality: ObservationQuality;
  provenanceId: string;
  layer: 'OBSERVED';
}

export interface DataQualityIssue {
  id: string;
  kind: DataIssueKind;
  assetId: string;
  metricId: string;
  phenomenonTime: string;
  message: string;
}

export interface DatasetRevision {
  schema: 'erpwam.analytics.dataset/1';
  revisionId: string;
  title: string;
  fictional: true;
  timezone: 'UTC';
  startDate: string;
  endDate: string;
  resourceClasses: ResourceClass[];
  assets: Asset[];
  metrics: MetricDefinition[];
  observations: Observation[];
  qualityIssues: DataQualityIssue[];
  provenance: ProvenanceRecord[];
  contentHash: string;
}

export interface DerivedPoint {
  time: string;
  value: number;
  unit: string;
  layer: 'DERIVED';
  inputRevisionId: string;
  calculation: string;
}

export type ForecastMethod = 'NAIVE' | 'SEASONAL_NAIVE' | 'DRIFT' | 'MOVING_MEAN';
export type MissingPolicy = 'REQUIRE_CONTIGUOUS' | 'LINEAR_INTERIOR_SHORT_GAPS';

export interface ForecastSpec {
  schema: 'erpwam.analytics.forecast-spec/1';
  assetId: string;
  metricId: string;
  method: ForecastMethod;
  horizon: number;
  initialWindow: number;
  step: number;
  seasonalPeriod: number;
  movingWindow: number;
  missingPolicy: MissingPolicy;
  maxGap: number;
  intervalMinimumSamples: number;
}

export interface BacktestPrediction {
  originIndex: number;
  trainingEndTime: string;
  targetTime: string;
  horizon: number;
  predicted: number;
  actual: number;
  error: number;
  scaledAbsoluteError: number | null;
}

export interface ForecastMetricSummary {
  mae: number | null;
  rmse: number | null;
  mase: number | null;
  bias: number | null;
  sampleCount: number;
  foldCount: number;
}

export interface HorizonDiagnostic {
  horizon: number;
  residuals: number[];
  mae: number | null;
  bias: number | null;
}

export interface ForecastPoint {
  time: string;
  value: number;
  lower80: number | null;
  upper80: number | null;
  unit: string;
  layer: 'FORECAST';
}

export interface ForecastRun {
  schema: 'erpwam.analytics.forecast-run/1';
  id: string;
  inputRevisionId: string;
  algorithmVersion: '1';
  spec: ForecastSpec;
  trainingCutoff: string;
  predictions: BacktestPrediction[];
  excludedFolds: { originIndex: number; reason: string }[];
  metrics: ForecastMetricSummary;
  diagnostics: HorizonDiagnostic[];
  forecast: ForecastPoint[];
  warnings: string[];
}

export interface ScenarioAssumption {
  kind: 'CAPACITY_MULTIPLIER' | 'UTILIZATION_CAP' | 'DEMAND_MULTIPLIER';
  value: number;
  unit: '1';
  effectiveFrom: string;
}

export interface ScenarioPoint {
  time: string;
  baseline: number;
  value: number;
  delta: number;
  unit: string;
  layer: 'SCENARIO';
}

export interface ScenarioResult {
  schema: 'erpwam.analytics.scenario/1';
  id: string;
  baselineForecastId: string;
  inputRevisionId: string;
  calculationVersion: '1';
  assumption: ScenarioAssumption;
  points: ScenarioPoint[];
  warning: string;
}

export interface ProjectViewState {
  selectedAssetId: string | null;
  classFilter: string;
  locationFilter: string;
  route: 'overview' | 'assets' | 'analytics' | 'forecasts' | 'scenarios' | 'data' | 'settings';
}

export interface AnalyticalProject {
  schema: 'erpwam.analytics.project/1';
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  dataset: DatasetRevision;
  view: ProjectViewState;
  forecastRuns: ForecastRun[];
  scenarios: ScenarioResult[];
}

export interface PortableProject {
  schema: 'erpwam.analytics.portable/1';
  payload: AnalyticalProject;
  integrity: {
    algorithm: 'SHA-256';
    digest: string;
  };
}
