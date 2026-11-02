import { quantile } from '../analytics/statistics';
import { contentIdentity } from '../domain/canonical';
import type {
  BacktestPrediction,
  ForecastMetricSummary,
  ForecastRun,
  ForecastSpec,
  HorizonDiagnostic,
} from '../domain/contracts';
import { forecastValues } from './methods';

export interface SeriesPoint {
  time: string;
  value: number | null;
}

export function prepareTraining(
  values: readonly (number | null)[],
  policy: ForecastSpec['missingPolicy'],
  maxGap: number,
): number[] {
  if (!Number.isInteger(maxGap) || maxGap < 0) {
    throw new RangeError('Maximum interpolated gap must be a non-negative integer.');
  }
  if (policy === 'REQUIRE_CONTIGUOUS') {
    if (values.some((value) => value === null)) throw new RangeError('Training window contains missing observations.');
    return values as number[];
  }
  const result = [...values];
  let index = 0;
  while (index < result.length) {
    if (result[index] !== null) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < result.length && result[index] === null) index += 1;
    const length = index - start;
    if (start === 0 || index === result.length || length > maxGap) {
      throw new RangeError(`Training window contains an unsupported gap of ${length} observation(s).`);
    }
    const left = result[start - 1]!;
    const right = result[index]!;
    for (let offset = 1; offset <= length; offset += 1) {
      result[start + offset - 1] = left + ((right - left) * offset) / (length + 1);
    }
  }
  return result as number[];
}

function naiveScale(training: readonly number[]): number | null {
  if (training.length < 2) return null;
  let sum = 0;
  for (let index = 1; index < training.length; index += 1) {
    sum += Math.abs(training[index]! - training[index - 1]!);
  }
  const scale = sum / (training.length - 1);
  return scale > 0 ? scale : null;
}

interface IntervalEvidence {
  coverage: number | null;
  meanWidth: number | null;
  sampleCount: number;
}

function intervalEvidence(
  predictions: readonly BacktestPrediction[],
  minimumSamples: number,
): IntervalEvidence {
  const priorByHorizon = new Map<number, number[]>();
  const outcomes: { covered: boolean; width: number }[] = [];
  for (const prediction of predictions) {
    const prior = priorByHorizon.get(prediction.horizon) ?? [];
    if (prior.length >= minimumSamples) {
      const lower = quantile(prior, 0.1)!;
      const upper = quantile(prior, 0.9)!;
      const lowerBound = prediction.predicted + lower;
      const upperBound = prediction.predicted + upper;
      outcomes.push({
        covered: prediction.actual >= lowerBound && prediction.actual <= upperBound,
        width: upperBound - lowerBound,
      });
    }
    prior.push(prediction.error);
    priorByHorizon.set(prediction.horizon, prior);
  }
  if (!outcomes.length) return { coverage: null, meanWidth: null, sampleCount: 0 };
  return {
    coverage: outcomes.filter((item) => item.covered).length / outcomes.length,
    meanWidth: outcomes.reduce((sum, item) => sum + item.width, 0) / outcomes.length,
    sampleCount: outcomes.length,
  };
}

function summarize(
  predictions: readonly BacktestPrediction[],
  intervalMinimumSamples: number,
): ForecastMetricSummary {
  if (!predictions.length) {
    return {
      mae: null,
      rmse: null,
      mase: null,
      bias: null,
      sampleCount: 0,
      foldCount: 0,
      intervalCoverage80: null,
      intervalMeanWidth80: null,
      intervalSampleCount: 0,
    };
  }
  const absoluteErrors = predictions.map((item) => Math.abs(item.error));
  const scaled = predictions.map((item) => item.scaledAbsoluteError).filter((value): value is number => value !== null);
  const interval = intervalEvidence(predictions, intervalMinimumSamples);
  return {
    mae: absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length,
    rmse: Math.sqrt(predictions.reduce((sum, item) => sum + item.error ** 2, 0) / predictions.length),
    mase: scaled.length === predictions.length ? scaled.reduce((sum, value) => sum + value, 0) / scaled.length : null,
    bias: predictions.reduce((sum, item) => sum + item.error, 0) / predictions.length,
    sampleCount: predictions.length,
    foldCount: new Set(predictions.map((item) => item.originIndex)).size,
    intervalCoverage80: interval.coverage,
    intervalMeanWidth80: interval.meanWidth,
    intervalSampleCount: interval.sampleCount,
  };
}

function diagnostics(
  predictions: readonly BacktestPrediction[],
  horizon: number,
  intervalMinimumSamples: number,
): HorizonDiagnostic[] {
  return Array.from({ length: horizon }, (_, index) => {
    const level = index + 1;
    const levelPredictions = predictions.filter((item) => item.horizon === level);
    const residuals = levelPredictions.map((item) => item.error);
    const scaled = levelPredictions
      .map((item) => item.scaledAbsoluteError)
      .filter((value): value is number => value !== null);
    const interval = intervalEvidence(levelPredictions, intervalMinimumSamples);
    return {
      horizon: level,
      residuals,
      mae: residuals.length ? residuals.reduce((sum, value) => sum + Math.abs(value), 0) / residuals.length : null,
      rmse: residuals.length
        ? Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / residuals.length)
        : null,
      mase: scaled.length === residuals.length && scaled.length
        ? scaled.reduce((sum, value) => sum + value, 0) / scaled.length
        : null,
      bias: residuals.length ? residuals.reduce((sum, value) => sum + value, 0) / residuals.length : null,
      intervalCoverage80: interval.coverage,
      intervalMeanWidth80: interval.meanWidth,
      intervalSampleCount: interval.sampleCount,
    };
  });
}

function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${label} must be a positive integer.`);
}

function validateInputs(series: readonly SeriesPoint[], spec: ForecastSpec): void {
  if (spec.schema !== 'erpwam.analytics.forecast-spec/1') throw new RangeError('Unsupported forecast specification schema.');
  if (!spec.assetId || !spec.metricId) throw new TypeError('Forecast asset and metric identities are required.');
  if (!['NAIVE', 'SEASONAL_NAIVE', 'DRIFT', 'MOVING_MEAN'].includes(spec.method)) {
    throw new RangeError('Unsupported forecast method.');
  }
  requirePositiveInteger(spec.horizon, 'Forecast horizon');
  requirePositiveInteger(spec.initialWindow, 'Initial window');
  requirePositiveInteger(spec.step, 'Rolling-origin step');
  requirePositiveInteger(spec.seasonalPeriod, 'Seasonal period');
  requirePositiveInteger(spec.movingWindow, 'Moving window');
  requirePositiveInteger(spec.intervalMinimumSamples, 'Interval minimum sample count');
  if (!Number.isInteger(spec.maxGap) || spec.maxGap < 0) {
    throw new RangeError('Maximum interpolated gap must be a non-negative integer.');
  }
  if (!['REQUIRE_CONTIGUOUS', 'LINEAR_INTERIOR_SHORT_GAPS'].includes(spec.missingPolicy)) {
    throw new RangeError('Unsupported forecast missing-data policy.');
  }
  for (let index = 0; index < series.length; index += 1) {
    const point = series[index]!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(point.time)
      || Number.isNaN(Date.parse(`${point.time}T00:00:00.000Z`))) {
      throw new TypeError(`Series time at position ${index} is not a valid UTC calendar date.`);
    }
    if (point.value !== null && !Number.isFinite(point.value)) {
      throw new TypeError(`Series value at position ${index} must be finite or null.`);
    }
    if (index > 0) {
      const previous = Date.parse(`${series[index - 1]!.time}T00:00:00.000Z`);
      const current = Date.parse(`${point.time}T00:00:00.000Z`);
      if (current - previous !== 86_400_000) {
        throw new RangeError('Forecast series must use a strictly ordered daily UTC cadence.');
      }
    }
  }
}

export async function runForecast(
  inputRevisionId: string,
  unit: string,
  series: readonly SeriesPoint[],
  spec: ForecastSpec,
): Promise<ForecastRun> {
  if (!inputRevisionId || !unit) throw new TypeError('Forecast input revision and unit are required.');
  validateInputs(series, spec);
  if (series.length < spec.initialWindow + spec.horizon) {
    throw new RangeError('Series is too short for the requested initial window and horizon.');
  }
  const predictions: BacktestPrediction[] = [];
  const excludedFolds: { originIndex: number; reason: string }[] = [];

  for (let origin = spec.initialWindow - 1; origin + spec.horizon < series.length; origin += spec.step) {
    const targetWindow = series.slice(origin + 1, origin + spec.horizon + 1);
    const missingTargets = targetWindow
      .map((point, index) => point.value === null ? index + 1 : null)
      .filter((offset): offset is number => offset !== null);
    if (missingTargets.length) {
      excludedFolds.push({
        originIndex: origin,
        reason: `Test window contains missing target observation(s) at horizon ${missingTargets.join(', ')}.`,
      });
      continue;
    }
    let training: number[];
    try {
      training = prepareTraining(series.slice(0, origin + 1).map((item) => item.value), spec.missingPolicy, spec.maxGap);
    } catch (error) {
      excludedFolds.push({ originIndex: origin, reason: error instanceof Error ? error.message : 'Training preparation failed.' });
      continue;
    }
    let proposed: number[];
    try {
      proposed = forecastValues(spec.method, training, spec.horizon, spec);
    } catch (error) {
      excludedFolds.push({ originIndex: origin, reason: error instanceof Error ? error.message : 'Forecast method failed.' });
      continue;
    }
    const scale = naiveScale(training);
    for (let offset = 1; offset <= spec.horizon; offset += 1) {
      const actualPoint = series[origin + offset]!;
      const predicted = proposed[offset - 1]!;
      const actual = actualPoint.value!;
      const error = actual - predicted;
      predictions.push({
        originIndex: origin,
        trainingEndTime: series[origin]!.time,
        targetTime: actualPoint.time,
        horizon: offset,
        predicted,
        actual,
        error,
        scaledAbsoluteError: scale === null ? null : Math.abs(error) / scale,
      });
    }
  }

  const prepared = prepareTraining(series.map((item) => item.value), spec.missingPolicy, spec.maxGap);
  const values = forecastValues(spec.method, prepared, spec.horizon, spec);
  const horizonDiagnostics = diagnostics(predictions, spec.horizon, spec.intervalMinimumSamples);
  const lastTime = series.at(-1)!.time;
  const forecast = values.map((value, index) => {
    const residuals = horizonDiagnostics[index]!.residuals;
    const intervalReady = residuals.length >= spec.intervalMinimumSamples;
    const lowerResidual = intervalReady ? quantile(residuals, 0.1) : null;
    const upperResidual = intervalReady ? quantile(residuals, 0.9) : null;
    return {
      time: addDays(lastTime, index + 1),
      value,
      lower80: lowerResidual === null ? null : value + lowerResidual,
      upper80: upperResidual === null ? null : value + upperResidual,
      unit,
      layer: 'FORECAST' as const,
    };
  });
  const runIdentity = await contentIdentity({ inputRevisionId, spec, predictions, forecast });
  const warnings: string[] = [];
  if (forecast.some((point) => point.lower80 === null)) warnings.push('Empirical interval unavailable where held-out residual support is insufficient.');
  if (excludedFolds.length) warnings.push(`${excludedFolds.length} backtest fold(s) were excluded with recorded reasons.`);
  return {
    schema: 'erpwam.analytics.forecast-run/1',
    id: `forecast-${runIdentity.slice(0, 16)}`,
    inputRevisionId,
    algorithmVersion: '1',
    spec,
    trainingCutoff: lastTime,
    predictions,
    excludedFolds,
    metrics: summarize(predictions, spec.intervalMinimumSamples),
    diagnostics: horizonDiagnostics,
    forecast,
    warnings,
  };
}
