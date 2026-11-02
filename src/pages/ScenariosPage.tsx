import { useState } from 'react';
import { ChartPanel } from '../components/ChartPanel';
import type { AnalyticalProject } from '../domain/contracts';
import { applyScenario } from '../scenarios/scenario';

interface ScenariosPageProps {
  project: AnalyticalProject;
  onProjectChange: (project: AnalyticalProject) => void;
  onOpenForecasts: () => void;
}

export function ScenariosPage({ project, onProjectChange, onOpenForecasts }: ScenariosPageProps) {
  const baseline = project.forecastRuns.at(-1);
  const [value, setValue] = useState(1.1);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scenario = baseline ? [...project.scenarios].reverse().find((item) => item.baselineForecastId === baseline.id) : undefined;

  async function execute() {
    if (!baseline) return;
    setWorking(true);
    setError(null);
    try {
      const result = await applyScenario(baseline, { kind: 'CAPACITY_MULTIPLIER', value, unit: '1', effectiveFrom: baseline.forecast[0]!.time });
      onProjectChange({ ...project, scenarios: [...project.scenarios.filter((item) => item.id !== result.id), result], updatedAt: new Date().toISOString() });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Scenario calculation failed.');
    } finally {
      setWorking(false);
    }
  }

  if (!baseline) return <div className="workspace-page" data-testid="scenarios-page"><header className="page-heading"><div><span className="eyebrow">Scenarios</span><h1>Explore explicit assumptions</h1><p>A scenario requires a fixed forecast baseline.</p></div></header><section className="empty-state"><h2>Create a baseline first</h2><p>Run a transparent forecast before applying a hypothetical assumption.</p><button type="button" className="primary-button" onClick={onOpenForecasts}>Open forecasts</button></section></div>;

  const option = {
    color: ['#7157a8', '#b76f21'],
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 64, right: 20, top: 42, bottom: 48 },
    xAxis: { type: 'category', data: baseline.forecast.map((item) => item.time), axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', name: `Output (${baseline.forecast[0]!.unit})` },
    series: [
      { name: 'Forecast baseline', type: 'line', lineStyle: { type: 'dashed' }, data: baseline.forecast.map((item) => item.value) },
      { name: 'Hypothetical scenario', type: 'line', lineStyle: { type: 'dotted' }, data: scenario?.points.map((item) => item.value) ?? [] },
    ],
  };
  return <div className="workspace-page" data-testid="scenarios-page">
    <header className="page-heading"><div><span className="eyebrow">Scenarios</span><h1>Compare a hypothetical future</h1><p>The scenario preserves the forecast and observed history. It does not claim the assumption will occur.</p></div><span className="scenario-badge">Hypothetical</span></header>
    <section className="context-bar" aria-label="Scenario configuration">
      <div className="context-note"><strong>Capacity multiplier</strong><br />Assumes forecast output changes in direct proportion to declared capacity.</div>
      <label>Multiplier<input type="number" min="0" max="2" step="0.05" value={value} onChange={(event) => setValue(event.target.valueAsNumber)} /></label>
      <div className="context-note">Effective {baseline.forecast[0]!.time} · baseline {baseline.id}</div>
      <button type="button" className="primary-button" disabled={working || !Number.isFinite(value) || value < 0 || value > 2} onClick={execute}>{working ? 'Calculating…' : 'Apply scenario'}</button>
    </section>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {scenario ? <><ChartPanel title="Baseline and scenario" description="Both lines retain their semantic layer and source identity." option={option} /><section className="panel"><div className="panel-heading"><div><h2>Scenario evidence</h2><p>{scenario.warning}</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Baseline forecast</th><th>Scenario</th><th>Difference</th><th>Layer</th></tr></thead><tbody>{scenario.points.map((point) => <tr key={point.time}><td>{point.time}</td><td>{point.baseline.toFixed(2)} {point.unit}</td><td>{point.value.toFixed(2)} {point.unit}</td><td>{point.delta >= 0 ? '+' : ''}{point.delta.toFixed(2)} {point.unit}</td><td>{point.layer}</td></tr>)}</tbody></table></div></section></> : <section className="empty-state"><h2>No scenario result yet</h2><p>Apply the declared multiplier to create a separately identified hypothetical series.</p></section>}
  </div>;
}
