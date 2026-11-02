import { contentIdentity } from '../domain/canonical';
import type { ForecastRun, ScenarioAssumption, ScenarioResult } from '../domain/contracts';

export async function applyScenario(
  baseline: ForecastRun,
  assumption: ScenarioAssumption,
): Promise<ScenarioResult> {
  if (!baseline.forecast.length) throw new RangeError('A scenario requires a non-empty forecast baseline.');
  if (!Number.isFinite(assumption.value)) throw new TypeError('Scenario assumptions require a finite value.');
  if (assumption.value < 0 || assumption.value > 2) {
    throw new RangeError('The capacity multiplier must be between 0 and 2.');
  }
  if (assumption.kind !== 'CAPACITY_MULTIPLIER' || assumption.unit !== '1') {
    throw new RangeError('Only a dimensionless capacity-multiplier scenario is supported.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(assumption.effectiveFrom)
    || Number.isNaN(Date.parse(`${assumption.effectiveFrom}T00:00:00.000Z`))) {
    throw new TypeError('Scenario effective time must be a valid UTC calendar date.');
  }
  if (assumption.effectiveFrom < baseline.forecast[0]!.time
    || assumption.effectiveFrom > baseline.forecast.at(-1)!.time) {
    throw new RangeError('Scenario effective time must fall within the forecast horizon.');
  }
  const points = baseline.forecast.map((point) => {
    let value = point.value;
    if (point.time >= assumption.effectiveFrom) {
      value = point.value * assumption.value;
    }
    return {
      time: point.time,
      baseline: point.value,
      value,
      delta: value - point.value,
      unit: point.unit,
      layer: 'SCENARIO' as const,
    };
  });
  const identity = await contentIdentity({ baselineForecastId: baseline.id, assumption, points });
  return {
    schema: 'erpwam.analytics.scenario/1',
    id: `scenario-${identity.slice(0, 16)}`,
    baselineForecastId: baseline.id,
    inputRevisionId: baseline.inputRevisionId,
    calculationVersion: '1',
    assumption,
    points,
    warning: 'Hypothetical transformation of a forecast baseline; not an observed value or calibrated forecast.',
  };
}
