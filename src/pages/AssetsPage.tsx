import { useMemo } from 'react';
import { analyzeOverview, assetDailySeries } from '../analytics/overview';
import { summarize } from '../analytics/statistics';
import { AssetTable } from '../components/AssetTable';
import { ChartPanel } from '../components/ChartPanel';
import type { AnalyticalProject } from '../domain/contracts';

interface AssetsPageProps {
  project: AnalyticalProject;
  selectedAssetId: string | null;
  onSelectAsset: (id: string) => void;
}

export function AssetsPage({ project, selectedAssetId, onSelectAsset }: AssetsPageProps) {
  const analysis = useMemo(() => analyzeOverview(project.dataset, { classId: 'all', location: 'all' }), [project.dataset]);
  const activeId = selectedAssetId ?? project.dataset.assets[0]!.id;
  const selected = analysis.assetSummaries.find((item) => item.asset.id === activeId)!;
  const output = assetDailySeries(project.dataset, activeId, 'output');
  const stats = summarize(output.map((item) => item.value));
  const recent = output.slice(-120);
  const option = {
    color: ['#923f59'],
    tooltip: { trigger: 'axis' },
    grid: { left: 64, right: 18, top: 18, bottom: 42 },
    xAxis: { type: 'category', data: recent.map((item) => item.time), axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', name: 'Output (u)' },
    series: [{ type: 'line', showSymbol: false, connectNulls: false, data: recent.map((item) => item.value) }],
  };
  return (
    <div className="workspace-page" data-testid="assets-page">
      <header className="page-heading"><div><h1>{selected.asset.name}</h1><p>{selected.asset.code} · {selected.asset.location} · {selected.asset.ratedCapacity} u/h rated capacity</p></div></header>
      <div className="detail-grid">
        <section className="panel compact-details">
          <h2>Observed history</h2>
          <dl>
            <div><dt>Utilization</dt><dd>{(selected.utilization * 100).toFixed(1)}%</dd></div>
            <div><dt>Availability</dt><dd>{(selected.availability * 100).toFixed(1)}%</dd></div>
            <div><dt>Coverage</dt><dd>{(selected.coverage * 100).toFixed(2)}%</dd></div>
            <div><dt>Mean daily output</dt><dd>{stats.mean?.toFixed(1) ?? 'Unavailable'} u</dd></div>
            <div><dt>Median daily output</dt><dd>{stats.median?.toFixed(1) ?? 'Unavailable'} u</dd></div>
            <div><dt>Missing days</dt><dd>{stats.missing}</dd></div>
          </dl>
        </section>
        <ChartPanel title="Recent output" description="Final 120 daily positions. Gaps are not connected or treated as zero." option={option} />
      </div>
      <section className="panel asset-table-panel"><div className="panel-heading"><div><h2>Asset register</h2></div></div><AssetTable rows={analysis.assetSummaries} selectedAssetId={activeId} onSelect={onSelectAsset} /></section>
    </div>
  );
}
