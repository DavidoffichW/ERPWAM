import { assetDailySeries } from '../analytics/overview';
import { runForecast } from '../forecast/backtest';
import { applyScenario } from '../scenarios/scenario';
import { canonicalStringify, contentIdentity } from './canonical';
import type {
  AnalyticalProject,
  DatasetRevision,
  ForecastRun,
  ScenarioResult,
} from './contracts';
import { UNIT_REGISTRY } from './units';

const LIMITS = {
  assets: 10_000,
  metrics: 100,
  observations: 250_000,
  issues: 250_000,
  forecastRuns: 20,
  scenarios: 50,
} as const;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maximum = 512): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum) {
    throw new TypeError(`${label} must be a non-empty string no longer than ${maximum} characters.`);
  }
  return value;
}

function finite(value: unknown, label: string, minimum?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (minimum !== undefined && value < minimum)) {
    throw new TypeError(`${label} must be a finite number${minimum === undefined ? '' : ` greater than or equal to ${minimum}`}.`);
  }
  return value;
}

function integer(value: unknown, label: string, minimum = 0): number {
  const number = finite(value, label, minimum);
  if (!Number.isInteger(number)) throw new TypeError(`${label} must be an integer.`);
  return number;
}

function array(value: unknown, label: string, maximum: number): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  if (value.length > maximum) throw new RangeError(`${label} exceeds the ${maximum.toLocaleString()} item limit.`);
  return value;
}

function utc(value: unknown, label: string): string {
  const candidate = text(value, label, 64);
  if (!candidate.endsWith('Z') || Number.isNaN(Date.parse(candidate))) {
    throw new TypeError(`${label} must be a valid ISO 8601 UTC instant.`);
  }
  return candidate;
}

function calendarDate(value: unknown, label: string): string {
  const candidate = text(value, label, 32);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)
    || Number.isNaN(Date.parse(`${candidate}T00:00:00.000Z`))) {
    throw new TypeError(`${label} must be a valid UTC calendar date.`);
  }
  return candidate;
}

function unique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new TypeError(`${label} must be unique.`);
}

function optionalMetric(value: unknown, label: string): number | null {
  if (value === null) return null;
  return finite(value, label);
}

function validateDataset(value: unknown): DatasetRevision {
  const dataset = record(value, 'Dataset');
  if (dataset.schema !== 'erpwam.analytics.dataset/1') throw new RangeError('Unsupported analytical dataset schema.');
  text(dataset.revisionId, 'Dataset revision identity', 128);
  text(dataset.title, 'Dataset title');
  if (dataset.fictional !== true || dataset.timezone !== 'UTC') {
    throw new TypeError('This release admits only the included UTC dataset format.');
  }
  utc(dataset.startDate, 'Dataset start time');
  utc(dataset.endDate, 'Dataset end time');
  const classes = array(dataset.resourceClasses, 'Resource classes', 1_000).map((item, index) => {
    const candidate = record(item, `Resource class ${index}`);
    return { id: text(candidate.id, `Resource class ${index} identity`, 128), value: candidate };
  });
  unique(classes.map((item) => item.id), 'Resource class identities');
  classes.forEach(({ value: candidate }, index) => {
    text(candidate.name, `Resource class ${index} name`);
    text(candidate.description, `Resource class ${index} description`, 2_000);
  });
  const classIds = new Set(classes.map((item) => item.id));

  const assets = array(dataset.assets, 'Assets', LIMITS.assets).map((item, index) => {
    const candidate = record(item, `Asset ${index}`);
    const id = text(candidate.id, `Asset ${index} identity`, 128);
    text(candidate.code, `Asset ${index} code`, 128);
    text(candidate.name, `Asset ${index} name`);
    if (!classIds.has(text(candidate.classId, `Asset ${index} class`, 128))) throw new TypeError(`Asset ${id} references an unknown resource class.`);
    text(candidate.location, `Asset ${index} location`);
    finite(candidate.ratedCapacity, `Asset ${index} rated capacity`, 0);
    if (candidate.capacityUnit !== 'u/h') throw new RangeError(`Asset ${id} uses an unsupported capacity unit.`);
    utc(candidate.commissionedAt, `Asset ${index} commissioning time`);
    if (candidate.retiredAt !== null) utc(candidate.retiredAt, `Asset ${index} retirement time`);
    return { id, code: candidate.code as string };
  });
  unique(assets.map((item) => item.id), 'Asset identities');
  unique(assets.map((item) => item.code), 'Asset codes');
  const assetIds = new Set(assets.map((item) => item.id));

  const metrics = array(dataset.metrics, 'Metrics', LIMITS.metrics).map((item, index) => {
    const candidate = record(item, `Metric ${index}`);
    const id = text(candidate.id, `Metric ${index} identity`, 128);
    const unit = text(candidate.unit, `Metric ${index} unit`, 32);
    if (!UNIT_REGISTRY[unit]) throw new RangeError(`Metric ${id} uses an unsupported unit.`);
    text(candidate.name, `Metric ${index} name`);
    if (!['count', 'duration', 'energy', 'rate', 'ratio'].includes(candidate.quantity as string)) throw new RangeError(`Metric ${id} uses an unsupported quantity.`);
    if (!['SUM', 'MEAN', 'LAST', 'RATIO'].includes(candidate.aggregation as string)) throw new RangeError(`Metric ${id} uses an unsupported aggregation.`);
    if (candidate.expectedCadence !== 'P1D' || typeof candidate.zeroIsMeaningful !== 'boolean') throw new TypeError(`Metric ${id} has an invalid cadence or zero policy.`);
    return { id, unit };
  });
  unique(metrics.map((item) => item.id), 'Metric identities');
  const metricUnits = new Map(metrics.map((item) => [item.id, item.unit]));

  const provenance = array(dataset.provenance, 'Provenance records', 100).map((item, index) => {
    const candidate = record(item, `Provenance record ${index}`);
    const id = text(candidate.id, `Provenance record ${index} identity`, 128);
    if (!['SYNTHETIC_GENERATOR', 'PORTABLE_PROJECT'].includes(candidate.sourceKind as string)) throw new RangeError(`Provenance record ${id} has an unsupported source kind.`);
    text(candidate.sourceName, `Provenance record ${index} source name`);
    if (typeof candidate.sourceHash !== 'string' || !/^[0-9a-f]{64}$/.test(candidate.sourceHash)) throw new TypeError(`Provenance record ${id} has an invalid source hash.`);
    utc(candidate.generatedAt, `Provenance record ${index} generation time`);
    text(candidate.generatorVersion, `Provenance record ${index} generator version`, 64);
    integer(candidate.seed, `Provenance record ${index} seed`);
    text(candidate.notes, `Provenance record ${index} notes`, 2_000);
    return { id, seed: candidate.seed as number, sourceHash: candidate.sourceHash as string };
  });
  unique(provenance.map((item) => item.id), 'Provenance identities');
  if (provenance.length !== 1) throw new RangeError('This release requires exactly one source provenance record.');
  const provenanceIds = new Set(provenance.map((item) => item.id));

  const observationIds: string[] = [];
  for (const [index, item] of array(dataset.observations, 'Observations', LIMITS.observations).entries()) {
    const candidate = record(item, `Observation ${index}`);
    const id = text(candidate.id, `Observation ${index} identity`, 256);
    observationIds.push(id);
    const assetId = text(candidate.assetId, `Observation ${index} asset identity`, 128);
    const metricId = text(candidate.metricId, `Observation ${index} metric identity`, 128);
    if (!assetIds.has(assetId) || !metricUnits.has(metricId)) throw new TypeError(`Observation ${id} references an unknown asset or metric.`);
    utc(candidate.phenomenonTime, `Observation ${index} phenomenon time`);
    utc(candidate.resultTime, `Observation ${index} result time`);
    finite(candidate.value, `Observation ${index} value`);
    if (candidate.unit !== metricUnits.get(metricId)) throw new TypeError(`Observation ${id} does not use its metric's canonical unit.`);
    if (!['VALID', 'SUSPECT'].includes(candidate.quality as string) || candidate.layer !== 'OBSERVED') throw new TypeError(`Observation ${id} has an invalid quality or semantic layer.`);
    if (!provenanceIds.has(text(candidate.provenanceId, `Observation ${index} provenance identity`, 128))) throw new TypeError(`Observation ${id} references unknown provenance.`);
  }
  unique(observationIds, 'Observation identities');

  const issueIds: string[] = [];
  for (const [index, item] of array(dataset.qualityIssues, 'Quality issues', LIMITS.issues).entries()) {
    const candidate = record(item, `Quality issue ${index}`);
    const id = text(candidate.id, `Quality issue ${index} identity`, 256);
    issueIds.push(id);
    if (!['MISSING', 'INVALID', 'DUPLICATE', 'CONFLICTING', 'EXCLUDED'].includes(candidate.kind as string)) throw new RangeError(`Quality issue ${id} has an unsupported kind.`);
    if (!assetIds.has(text(candidate.assetId, `Quality issue ${index} asset identity`, 128))
      || !metricUnits.has(text(candidate.metricId, `Quality issue ${index} metric identity`, 128))) throw new TypeError(`Quality issue ${id} references an unknown asset or metric.`);
    utc(candidate.phenomenonTime, `Quality issue ${index} phenomenon time`);
    text(candidate.message, `Quality issue ${index} message`, 2_000);
  }
  unique(issueIds, 'Quality issue identities');
  if (typeof dataset.contentHash !== 'string' || !/^[0-9a-f]{64}$/.test(dataset.contentHash)) throw new TypeError('Dataset content hash is invalid.');
  if (provenance[0]!.sourceHash !== dataset.contentHash) throw new Error('Dataset provenance does not match its declared content hash.');
  return dataset as unknown as DatasetRevision;
}

function validateForecastRun(value: unknown, dataset: DatasetRevision): ForecastRun {
  const run = record(value, 'Forecast run');
  if (run.schema !== 'erpwam.analytics.forecast-run/1' || run.algorithmVersion !== '1') throw new RangeError('Unsupported forecast run schema or algorithm version.');
  text(run.id, 'Forecast run identity', 128);
  if (run.inputRevisionId !== dataset.revisionId) throw new TypeError('Forecast run references a different dataset revision.');
  const spec = record(run.spec, 'Forecast specification');
  if (spec.schema !== 'erpwam.analytics.forecast-spec/1') throw new RangeError('Unsupported forecast specification schema.');
  if (!dataset.assets.some((asset) => asset.id === spec.assetId) || !dataset.metrics.some((metric) => metric.id === spec.metricId)) throw new TypeError('Forecast specification references an unknown asset or metric.');
  if (!['NAIVE', 'SEASONAL_NAIVE', 'DRIFT', 'MOVING_MEAN'].includes(spec.method as string)) throw new RangeError('Forecast specification uses an unsupported method.');
  if (!['REQUIRE_CONTIGUOUS', 'LINEAR_INTERIOR_SHORT_GAPS'].includes(spec.missingPolicy as string)) throw new RangeError('Forecast specification uses an unsupported missing-data policy.');
  for (const key of ['horizon', 'initialWindow', 'step', 'seasonalPeriod', 'movingWindow', 'intervalMinimumSamples']) integer(spec[key], `Forecast ${key}`, 1);
  integer(spec.maxGap, 'Forecast maximum gap');
  calendarDate(run.trainingCutoff, 'Forecast training cutoff');
  for (const item of array(run.predictions, 'Backtest predictions', 1_000_000)) {
    const prediction = record(item, 'Backtest prediction');
    integer(prediction.originIndex, 'Backtest origin index');
    const trainingEnd = calendarDate(prediction.trainingEndTime, 'Backtest training end');
    const target = calendarDate(prediction.targetTime, 'Backtest target time');
    if (target <= trainingEnd) throw new TypeError('Backtest target must be later than its training boundary.');
    integer(prediction.horizon, 'Backtest horizon', 1);
    finite(prediction.predicted, 'Backtest prediction');
    finite(prediction.actual, 'Backtest actual');
    const error = finite(prediction.error, 'Backtest error');
    if (Math.abs(error - ((prediction.actual as number) - (prediction.predicted as number))) > 1e-9) {
      throw new TypeError('Backtest error is inconsistent with the recorded actual and prediction.');
    }
    optionalMetric(prediction.scaledAbsoluteError, 'Backtest scaled error');
  }
  const forecast = array(run.forecast, 'Forecast points', 10_000);
  if (forecast.length !== spec.horizon) throw new TypeError('Forecast point count does not match the declared horizon.');
  for (const point of forecast) {
    const candidate = record(point, 'Forecast point');
    calendarDate(candidate.time, 'Forecast point time');
    finite(candidate.value, 'Forecast point value');
    optionalMetric(candidate.lower80, 'Forecast lower interval');
    optionalMetric(candidate.upper80, 'Forecast upper interval');
    if (candidate.layer !== 'FORECAST') throw new TypeError('Forecast point has an invalid semantic layer.');
  }
  const metrics = record(run.metrics, 'Forecast metrics');
  for (const key of ['mae', 'rmse', 'mase', 'bias', 'intervalCoverage80', 'intervalMeanWidth80']) optionalMetric(metrics[key], `Forecast ${key}`);
  for (const key of ['sampleCount', 'foldCount', 'intervalSampleCount']) integer(metrics[key], `Forecast ${key}`);
  array(run.excludedFolds, 'Excluded forecast folds', 1_000_000);
  array(run.diagnostics, 'Forecast diagnostics', 10_000);
  array(run.warnings, 'Forecast warnings', 1_000);
  return run as unknown as ForecastRun;
}

function validateScenario(value: unknown, project: { dataset: DatasetRevision; forecastRuns: ForecastRun[] }): ScenarioResult {
  const scenario = record(value, 'Scenario');
  if (scenario.schema !== 'erpwam.analytics.scenario/1' || scenario.calculationVersion !== '1') throw new RangeError('Unsupported scenario schema or calculation version.');
  text(scenario.id, 'Scenario identity', 128);
  if (scenario.inputRevisionId !== project.dataset.revisionId) throw new TypeError('Scenario references a different dataset revision.');
  if (!project.forecastRuns.some((run) => run.id === scenario.baselineForecastId)) throw new TypeError('Scenario references an unknown forecast baseline.');
  const assumption = record(scenario.assumption, 'Scenario assumption');
  if (assumption.kind !== 'CAPACITY_MULTIPLIER' || assumption.unit !== '1') throw new RangeError('Unsupported scenario assumption.');
  const multiplier = finite(assumption.value, 'Scenario multiplier', 0);
  if (multiplier > 2) throw new RangeError('Scenario multiplier exceeds the supported upper bound.');
  calendarDate(assumption.effectiveFrom, 'Scenario effective time');
  for (const point of array(scenario.points, 'Scenario points', 10_000)) {
    const candidate = record(point, 'Scenario point');
    calendarDate(candidate.time, 'Scenario point time');
    finite(candidate.baseline, 'Scenario baseline value');
    finite(candidate.value, 'Scenario value');
    finite(candidate.delta, 'Scenario delta');
    if (candidate.layer !== 'SCENARIO') throw new TypeError('Scenario point has an invalid semantic layer.');
  }
  text(scenario.warning, 'Scenario warning', 2_000);
  return scenario as unknown as ScenarioResult;
}

export async function validateAnalyticalProject(value: unknown): Promise<AnalyticalProject> {
  const project = record(value, 'Analytical project');
  if (project.schema !== 'erpwam.analytics.project/1') throw new RangeError('Unsupported analytical project schema.');
  text(project.id, 'Project identity', 128);
  text(project.title, 'Project title');
  utc(project.createdAt, 'Project creation time');
  utc(project.updatedAt, 'Project update time');
  const dataset = validateDataset(project.dataset);
  const view = record(project.view, 'Project view');
  const routes = ['overview', 'assets', 'analytics', 'forecasts', 'scenarios', 'data', 'settings'];
  if (!routes.includes(view.route as string)) throw new RangeError('Project view route is unsupported.');
  if (view.selectedAssetId !== null && !dataset.assets.some((asset) => asset.id === view.selectedAssetId)) throw new TypeError('Project view references an unknown selected asset.');
  const classFilter = text(view.classFilter, 'Project class filter', 128);
  const locationFilter = text(view.locationFilter, 'Project location filter', 512);
  if (classFilter !== 'all' && !dataset.resourceClasses.some((item) => item.id === classFilter)) throw new TypeError('Project view references an unknown resource class.');
  if (locationFilter !== 'all' && !dataset.assets.some((item) => item.location === locationFilter)) throw new TypeError('Project view references an unknown location.');
  const forecastRuns = array(project.forecastRuns, 'Forecast runs', LIMITS.forecastRuns).map((item) => validateForecastRun(item, dataset));
  unique(forecastRuns.map((item) => item.id), 'Forecast run identities');
  const scenarios = array(project.scenarios, 'Scenarios', LIMITS.scenarios).map((item) => validateScenario(item, { dataset, forecastRuns }));
  unique(scenarios.map((item) => item.id), 'Scenario identities');

  const provenance = dataset.provenance[0]!;
  const actualContentHash = await contentIdentity({
    assets: dataset.assets,
    classes: dataset.resourceClasses,
    metrics: dataset.metrics,
    observations: dataset.observations,
    qualityIssues: dataset.qualityIssues,
    seed: provenance.seed,
  });
  if (actualContentHash !== dataset.contentHash) throw new Error('Dataset content hash verification failed.');
  if (dataset.revisionId !== `juniper-${actualContentHash.slice(0, 16)}`) {
    throw new Error('Dataset revision identity does not match its content hash.');
  }
  for (const run of forecastRuns) {
    const series = assetDailySeries(dataset, run.spec.assetId, run.spec.metricId);
    const reproduced = await runForecast(dataset.revisionId, dataset.metrics.find((item) => item.id === run.spec.metricId)!.unit, series, run.spec);
    if (canonicalStringify(reproduced) !== canonicalStringify(run)) {
      throw new Error(`Forecast run ${run.id} does not reproduce from its declared inputs.`);
    }
  }
  for (const scenario of scenarios) {
    const baseline = forecastRuns.find((run) => run.id === scenario.baselineForecastId)!;
    const reproduced = await applyScenario(baseline, scenario.assumption);
    if (canonicalStringify(reproduced) !== canonicalStringify(scenario)) {
      throw new Error(`Scenario ${scenario.id} does not reproduce from its declared baseline and assumption.`);
    }
  }
  return value as AnalyticalProject;
}
