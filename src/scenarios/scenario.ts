import { contentIdentity } from '../domain/canonical';
import type { ForecastRun, ScenarioAssumption, ScenarioResult } from '../domain/contracts';

export async function applyScenario(
  baseline: ForecastRun,
  assumption: ScenarioAssumption,
): Promise<ScenarioResult> {
  if (!Number.isFinite(assumption.value)) throw new TypeError('Scenario assumptions require a finite value.');
  if (assumption.value < 0) throw new RangeError('Scenario assumption values cannot be negative.');
  const points = baseline.forecast.map((point) => {
    let value = point.value;
    if (point.time >= assumption.effectiveFrom) {
      if (assumption.kind === 'CAPACITY_MULTIPLIER' || assumption.kind === 'DEMAND_MULTIPLIER') {
        value = point.value * assumption.value;
      } else {
        value = Math.min(point.value, point.value * assumption.value);
      }
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
