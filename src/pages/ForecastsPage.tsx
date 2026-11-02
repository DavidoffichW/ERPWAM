import { useMemo, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import { assetDailySeries } from '../analytics/overview';
import { ChartPanel } from '../components/ChartPanel';
import type { AnalyticalProject, ForecastMethod, ForecastRun, ForecastSpec } from '../domain/contracts';
import { runForecast } from '../forecast/backtest';

interface ForecastsPageProps {
  project: AnalyticalProject;
  selectedAssetId: string | null;
  onSelectAsset: (id: string) => void;
  onProjectChange: (project: AnalyticalProject) => void;
}

const methodNames: Record<ForecastMethod, string> = {
  NAIVE: 'Naive',
  SEASONAL_NAIVE: 'Seasonal naive (7 days)',
  DRIFT: 'Drift',
  MOVING_MEAN: 'Moving mean (7 days)',
};

export function ForecastsPage({ project, selectedAssetId, onSelectAsset, onProjectChange }: ForecastsPageProps) {
  const assetId = selectedAssetId ?? project.dataset.assets[0]!.id;
  const [method, setMethod] = useState<ForecastMethod>('SEASONAL_NAIVE');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = [...project.forecastRuns].reverse().find((item) => item.spec.assetId === assetId && item.spec.method === method)
    ?? [...project.forecastRuns].reverse().find((item) => item.spec.assetId === assetId);
  const series = useMemo(() => assetDailySeries(project.dataset, assetId, 'output'), [assetId, project.dataset]);
  const missingCount = series.filter((item) => item.value === null).length;

  async function execute() {
    setRunning(true);
    setError(null);
    const spec: ForecastSpec = {
      schema: 'erpwam.analytics.forecast-spec/1',
      assetId,
      metricId: 'output',
      method,
      horizon: 14,
      initialWindow: 120,
      step: 14,
      seasonalPeriod: 7,
      movingWindow: 7,
      missingPolicy: 'LINEAR_INTERIOR_SHORT_GAPS',
      maxGap: 2,
      intervalMinimumSamples: 10,
    };
    try {
      const result = await runForecast(project.dataset.revisionId, 'u', series, spec);
      const nextRuns = [...project.forecastRuns.filter((item) => item.id !== result.id), result];
      onProjectChange({ ...project, forecastRuns: nextRuns, updatedAt: new Date().toISOString() });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Forecast calculation failed.');
    } finally {
      setRunning(false);
    }
  }

  const recent = series.slice(-90);
  const forecastDates = run?.forecast.map((item) => item.time) ?? [];
  const lower = run?.forecast.map((item) => item.lower80) ?? [];
  const intervalWidth = run?.forecast.map((item) => item.lower80 === null || item.upper80 === null
    ? null
    : item.upper80 - item.lower80) ?? [];
  const chartOption = {
    color: ['#923f59', '#437c85'],
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: ['Observed', 'Forecast', '80% empirical band'] },
    grid: { left: 64, right: 20, top: 42, bottom: 48 },
    xAxis: { type: 'category', data: [...recent.map((item) => item.time), ...forecastDates], axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', name: 'Output (u)' },
    series: [
      {
        name: 'Observed',
        type: 'line',
        showSymbol: false,
        connectNulls: false,
        data: [...recent.map((item) => item.value), ...forecastDates.map(() => null)],
        markLine: run ? {
          symbol: 'none',
          label: { formatter: 'Forecast origin' },
          lineStyle: { type: 'dotted', color: '#66788c' },
          data: [{ xAxis: series.at(-1)!.time }],
        } : undefined,
      },
      { name: 'Forecast', type: 'line', showSymbol: true, lineStyle: { type: 'dashed' }, data: [...recent.map(() => null), ...(run?.forecast.map((item) => item.value) ?? [])] },
      {
        name: 'Interval lower boundary',
        type: 'line',
        stack: 'empirical-band',
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
        tooltip: { show: false },
        data: [...recent.map(() => null), ...lower],
      },
      {
        name: '80% empirical band',
        type: 'line',
        stack: 'empirical-band',
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: 'rgba(67, 124, 133, 0.22)' },
        tooltip: { show: false },
        data: [...recent.map(() => null), ...intervalWidth],
      },
    ],
  };

  return (
    <div className="workspace-page" data-testid="forecasts-page">
      <header className="page-heading"><div><h1>Output forecasts</h1></div></header>
      <section className="context-bar" aria-label="Forecast configuration">
        <label>Asset<select value={assetId} onChange={(event) => onSelectAsset(event.target.value)}>{project.dataset.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.code} — {asset.name}</option>)}</select></label>
        <label>Method<select value={method} onChange={(event) => setMethod(event.target.value as ForecastMethod)}>{Object.entries(methodNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <div className="context-note">14-day horizon · {missingCount} missing observations</div>
        <button type="button" className="primary-button" onClick={execute} disabled={running}>{running ? 'Running…' : 'Run backtest'}</button>
      </section>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {run ? <ForecastEvidence run={run} chartOption={chartOption} /> : <section className="empty-state"><h2>No forecast evidence yet</h2><p>Run a baseline to calculate chronological holdout errors and the final 14-day projection.</p></section>}
    </div>
  );
}

function formatMetric(value: number | null): string {
  return value === null ? 'Unavailable' : value.toFixed(3);
}

function ForecastEvidence({ run, chartOption }: { run: ForecastRun; chartOption: EChartsCoreOption }) {
  return <>
    <section className="metric-grid forecast-metrics" aria-label="Forecast evidence">
      <article className="metric-card" title="Mean absolute held-out error"><span>MAE</span><strong>{formatMetric(run.metrics.mae)} u</strong><small>Mean absolute held-out error</small></article>
      <article className="metric-card" title="Root mean squared held-out error"><span>RMSE</span><strong>{formatMetric(run.metrics.rmse)} u</strong><small>Root mean squared held-out error</small></article>
      <article className="metric-card" title="Scaled against naive changes"><span>MASE</span><strong>{formatMetric(run.metrics.mase)}</strong><small>Scaled against each fold's naive change</small></article>
      <article className="metric-card" title="Mean actual minus predicted error"><span>Bias</span><strong>{formatMetric(run.metrics.bias)} u</strong><small>Mean actual minus predicted error</small></article>
      <article className="metric-card" title="Admitted samples and folds"><span>Evidence</span><strong>{run.metrics.sampleCount}</strong><small>{run.metrics.foldCount} admitted folds · {run.excludedFolds.length} excluded</small></article>
      <article className="metric-card" title="Coverage over held-out intervals"><span>Empirical interval check</span><strong>{run.metrics.intervalCoverage80 === null ? 'Unavailable' : `${(run.metrics.intervalCoverage80 * 100).toFixed(1)}%`}</strong><small>{run.metrics.intervalSampleCount} sequential held-out intervals · mean width {formatMetric(run.metrics.intervalMeanWidth80)} u</small></article>
    </section>
    <ChartPanel title="Observed history and forecast" description="Solid values are observations; dashed values are forecasts. Empirical intervals are reported in the table when supported." option={chartOption} />
    <section className="panel"><div className="panel-heading"><div><h2>Forecast output</h2><p>The interval is an empirical held-out residual band, not a guaranteed predictive probability.</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Layer</th><th>Point</th><th>80% empirical lower</th><th>80% empirical upper</th></tr></thead><tbody>{run.forecast.map((point) => <tr key={point.time}><td>{point.time}</td><td>{point.layer}</td><td>{point.value.toFixed(2)} {point.unit}</td><td>{point.lower80?.toFixed(2) ?? 'Unavailable'}</td><td>{point.upper80?.toFixed(2) ?? 'Unavailable'}</td></tr>)}</tbody></table></div></section>
    <section className="panel"><div className="panel-heading"><div><h2>Residuals by horizon</h2><p>Signed error is actual minus predicted. Interval coverage uses only residuals from earlier origins.</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Horizon</th><th>Samples</th><th>MAE</th><th>RMSE</th><th>MASE</th><th>Bias</th><th>Interval coverage</th></tr></thead><tbody>{run.diagnostics.map((item) => <tr key={item.horizon}><td>{item.horizon} day</td><td>{item.residuals.length}</td><td>{formatMetric(item.mae)}</td><td>{formatMetric(item.rmse)}</td><td>{formatMetric(item.mase)}</td><td>{formatMetric(item.bias)}</td><td>{item.intervalCoverage80 === null ? 'Unavailable' : `${(item.intervalCoverage80 * 100).toFixed(1)}% (${item.intervalSampleCount})`}</td></tr>)}</tbody></table></div>{run.warnings.map((warning) => <p className="warning-text" key={warning}>{warning}</p>)}{run.excludedFolds.length > 0 && <details><summary>Excluded fold reasons</summary><ul>{run.excludedFolds.map((item) => <li key={item.originIndex}>Origin {item.originIndex}: {item.reason}</li>)}</ul></details>}</section>
  </>;
}
