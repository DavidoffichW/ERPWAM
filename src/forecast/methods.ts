import type { ForecastMethod } from '../domain/contracts';

export interface MethodParameters {
  seasonalPeriod: number;
  movingWindow: number;
}

function requireMinimum(values: readonly number[], minimum: number, method: string): void {
  if (values.length < minimum) throw new RangeError(`${method} requires at least ${minimum} training values.`);
}

export function forecastValues(
  method: ForecastMethod,
  training: readonly number[],
  horizon: number,
  parameters: MethodParameters,
): number[] {
  if (!Number.isInteger(horizon) || horizon < 1) throw new RangeError('Forecast horizon must be a positive integer.');
  if (training.some((value) => !Number.isFinite(value))) throw new TypeError('Forecast training values must be finite.');

  if (method === 'NAIVE') {
    requireMinimum(training, 1, 'Naive forecasting');
    return Array.from({ length: horizon }, () => training.at(-1)!);
  }
  if (method === 'SEASONAL_NAIVE') {
    if (!Number.isInteger(parameters.seasonalPeriod) || parameters.seasonalPeriod < 1) {
      throw new RangeError('Seasonal period must be a positive integer.');
    }
    requireMinimum(training, parameters.seasonalPeriod, 'Seasonal naive forecasting');
    const season = training.slice(-parameters.seasonalPeriod);
    return Array.from({ length: horizon }, (_, index) => season[index % season.length]!);
  }
  if (method === 'DRIFT') {
    requireMinimum(training, 2, 'Drift forecasting');
    const slope = (training.at(-1)! - training[0]!) / (training.length - 1);
    return Array.from({ length: horizon }, (_, index) => training.at(-1)! + slope * (index + 1));
  }
  if (!Number.isInteger(parameters.movingWindow) || parameters.movingWindow < 1) {
    throw new RangeError('Moving window must be a positive integer.');
  }
  requireMinimum(training, parameters.movingWindow, 'Moving-mean forecasting');
  const window = training.slice(-parameters.movingWindow);
  const average = window.reduce((sum, value) => sum + value, 0) / window.length;
  return Array.from({ length: horizon }, () => average);
}
