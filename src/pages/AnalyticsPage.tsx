import { useMemo } from 'react';
import { analyzeOverview } from '../analytics/overview';
import { ChartPanel } from '../components/ChartPanel';
import type { AnalyticalProject } from '../domain/contracts';

export function AnalyticsPage({ project }: { project: AnalyticalProject }) {
  const analysis = useMemo(() => analyzeOverview(project.dataset, { classId: 'all', location: 'all' }), [project.dataset]);
  const stats = analysis.utilizationStatistics;
  const option = {
    color: ['#923f59'],
    tooltip: { trigger: 'axis' },
    grid: { left: 58, right: 18, top: 18, bottom: 46 },
    xAxis: { type: 'category', data: analysis.utilizationDistribution.map((bin) => `${(bin.lower * 100).toFixed(0)}–${(bin.upper * 100).toFixed(0)}%`), axisLabel: { interval: 0 } },
    yAxis: { type: 'value', minInterval: 1, name: 'Assets' },
    series: [{ type: 'bar', data: analysis.utilizationDistribution.map((bin) => bin.count) }],
  };
  return (
    <div className="workspace-page" data-testid="analytics-page">
      <header className="page-heading"><div><h1>Utilization distribution</h1></div></header>
      <div className="detail-grid">
        <section className="panel compact-details"><h2>Summary statistics</h2><dl>
          <div><dt>Sample size</dt><dd>{stats.count}</dd></div>
          <div><dt>Mean</dt><dd>{stats.mean === null ? 'Unavailable' : `${(stats.mean * 100).toFixed(2)}%`}</dd></div>
          <div><dt>Median</dt><dd>{stats.median === null ? 'Unavailable' : `${(stats.median * 100).toFixed(2)}%`}</dd></div>
          <div><dt>Q1 – Q3</dt><dd>{stats.q1 === null || stats.q3 === null ? 'Unavailable' : `${(stats.q1 * 100).toFixed(2)}% – ${(stats.q3 * 100).toFixed(2)}%`}</dd></div>
          <div><dt>Sample standard deviation</dt><dd>{stats.standardDeviation === null ? 'Unavailable' : `${(stats.standardDeviation * 100).toFixed(2)} pp`}</dd></div>
          <div><dt>Missing asset summaries</dt><dd>{stats.missing}</dd></div>
        </dl></section>
        <ChartPanel title="Asset utilization" description="Eight equal-width bins over the observed asset summaries." option={option} />
      </div>
      <details className="methodology"><summary>Calculation notes</summary><p>Utilization is total output divided by rated capacity multiplied by observed available hours. Percentages are calculated from totals, not averaged. Quartiles use Type 7 interpolation.</p></details>
    </div>
  );
}
