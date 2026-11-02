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

function summarize(predictions: readonly BacktestPrediction[]): ForecastMetricSummary {
  if (!predictions.length) return { mae: null, rmse: null, mase: null, bias: null, sampleCount: 0, foldCount: 0 };
  const absoluteErrors = predictions.map((item) => Math.abs(item.error));
  const scaled = predictions.map((item) => item.scaledAbsoluteError).filter((value): value is number => value !== null);
  return {
    mae: absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length,
    rmse: Math.sqrt(predictions.reduce((sum, item) => sum + item.error ** 2, 0) / predictions.length),
    mase: scaled.length === predictions.length ? scaled.reduce((sum, value) => sum + value, 0) / scaled.length : null,
    bias: predictions.reduce((sum, item) => sum + item.error, 0) / predictions.length,
    sampleCount: predictions.length,
    foldCount: new Set(predictions.map((item) => item.originIndex)).size,
  };
}

function diagnostics(predictions: readonly BacktestPrediction[], horizon: number): HorizonDiagnostic[] {
  return Array.from({ length: horizon }, (_, index) => {
    const level = index + 1;
    const residuals = predictions.filter((item) => item.horizon === level).map((item) => item.error);
    return {
      horizon: level,
      residuals,
      mae: residuals.length ? residuals.reduce((sum, value) => sum + Math.abs(value), 0) / residuals.length : null,
      bias: residuals.length ? residuals.reduce((sum, value) => sum + value, 0) / residuals.length : null,
    };
  });
}

function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export async function runForecast(
  inputRevisionId: string,
  unit: string,
  series: readonly SeriesPoint[],
  spec: ForecastSpec,
): Promise<ForecastRun> {
  if (series.length < spec.initialWindow + spec.horizon) {
    throw new RangeError('Series is too short for the requested initial window and horizon.');
  }
  const predictions: BacktestPrediction[] = [];
  const excludedFolds: { originIndex: number; reason: string }[] = [];

  for (let origin = spec.initialWindow - 1; origin + spec.horizon < series.length; origin += spec.step) {
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
      if (actualPoint.value === null) continue;
      const predicted = proposed[offset - 1]!;
      const error = actualPoint.value - predicted;
      predictions.push({
        originIndex: origin,
        trainingEndTime: series[origin]!.time,
        targetTime: actualPoint.time,
        horizon: offset,
        predicted,
        actual: actualPoint.value,
        error,
        scaledAbsoluteError: scale === null ? null : Math.abs(error) / scale,
      });
    }
  }

  const prepared = prepareTraining(series.map((item) => item.value), spec.missingPolicy, spec.maxGap);
  const values = forecastValues(spec.method, prepared, spec.horizon, spec);
  const horizonDiagnostics = diagnostics(predictions, spec.horizon);
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
    metrics: summarize(predictions),
    diagnostics: horizonDiagnostics,
    forecast,
    warnings,
  };
}
