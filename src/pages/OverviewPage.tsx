import { useMemo } from 'react';
import { analyzeOverview } from '../analytics/overview';
import { AssetTable } from '../components/AssetTable';
import { ChartPanel } from '../components/ChartPanel';
import { MetricCard } from '../components/MetricCard';
import type { AnalyticalProject } from '../domain/contracts';

interface OverviewPageProps {
  project: AnalyticalProject;
  selectedAssetId: string | null;
  classFilter: string;
  locationFilter: string;
  onClassFilter: (value: string) => void;
  onLocationFilter: (value: string) => void;
  onSelectAsset: (id: string) => void;
  onOpenAsset: (id: string) => void;
}

export function OverviewPage(props: OverviewPageProps) {
  const { project, classFilter, locationFilter } = props;
  const analysis = useMemo(
    () => analyzeOverview(project.dataset, { classId: classFilter, location: locationFilter }),
    [classFilter, locationFilter, project.dataset],
  );
  const classMap = new Map(project.dataset.resourceClasses.map((item) => [item.id, item.name]));
  const selected = analysis.assetSummaries.find((item) => item.asset.id === props.selectedAssetId);

  const trendOption = {
    color: ['#2367a8', '#b76f21'],
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 66, right: 24, top: 42, bottom: 50 },
    xAxis: { type: 'category', data: analysis.trends.map((item) => item.month), name: 'Month' },
    yAxis: { type: 'value', name: 'Units' },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 5 }],
    series: [
      { name: 'Output', type: 'line', showSymbol: false, data: analysis.trends.map((item) => Math.round(item.output)) },
      { name: 'Demand', type: 'line', showSymbol: false, data: analysis.trends.map((item) => Math.round(item.demand)) },
    ],
  };
  const distributionOption = {
    color: ['#2367a8'],
    tooltip: { trigger: 'axis' },
    grid: { left: 54, right: 18, top: 20, bottom: 48 },
    xAxis: {
      type: 'category',
      name: 'Utilization',
      data: analysis.utilizationDistribution.map((bin) => `${(bin.lower * 100).toFixed(0)}–${(bin.upper * 100).toFixed(0)}%`),
      axisLabel: { rotate: 28 },
    },
    yAxis: { type: 'value', name: 'Assets', minInterval: 1 },
    series: [{ type: 'bar', data: analysis.utilizationDistribution.map((bin) => bin.count) }],
  };
  const scatterOption = {
    color: ['#2367a8'],
    tooltip: {
      formatter: (parameters: { data: { label: string; value: number[] } }) => `${parameters.data.label}<br/>Utilization ${parameters.data.value[0]!.toFixed(1)}%<br/>Availability ${parameters.data.value[1]!.toFixed(1)}%`,
    },
    grid: { left: 62, right: 22, top: 18, bottom: 48 },
    xAxis: { type: 'value', name: 'Utilization %', min: 0, max: 100 },
    yAxis: { type: 'value', name: 'Availability %', min: 0, max: 100 },
    series: [{
      type: 'scatter',
      symbolSize: (value: number[]) => 7 + value[2]! / 8,
      data: analysis.assetSummaries.map((item) => ({
        id: item.asset.id,
        label: `${item.asset.code} — ${item.asset.name}`,
        value: [item.utilization * 100, item.availability * 100, item.asset.ratedCapacity],
        itemStyle: { color: item.asset.id === props.selectedAssetId ? '#bf5a5a' : '#2367a8' },
      })),
    }],
  };
  const classOption = {
    color: ['#376f68', '#7c8ea6'],
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 62, right: 22, top: 42, bottom: 42 },
    xAxis: { type: 'category', data: analysis.classComparisons.map((item) => item.className) },
    yAxis: { type: 'value', name: 'Percent', min: 0, max: 100 },
    series: [
      { name: 'Utilization', type: 'bar', data: analysis.classComparisons.map((item) => ({ id: item.classId, value: item.utilization * 100 })) },
      { name: 'Availability', type: 'bar', data: analysis.classComparisons.map((item) => ({ id: item.classId, value: item.availability * 100 })) },
    ],
  };

  return (
    <div className="workspace-page" data-testid="overview-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Overview</span>
          <h1>Asset and resource performance</h1>
          <p>Historical calculations over {project.dataset.title}. Nothing here is live telemetry.</p>
        </div>
        <span className="fictional-badge">Fictional dataset</span>
      </header>

      <section className="context-bar" aria-label="Dashboard filters">
        <label>Asset class
          <select value={classFilter} onChange={(event) => props.onClassFilter(event.target.value)}>
            <option value="all">All classes</option>
            {project.dataset.resourceClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>Location
          <select value={locationFilter} onChange={(event) => props.onLocationFilter(event.target.value)}>
            <option value="all">All locations</option>
            {[...new Set(project.dataset.assets.map((item) => item.location))].map((location) => <option key={location}>{location}</option>)}
          </select>
        </label>
        <div className="context-note">{project.dataset.startDate.slice(0, 10)} – {project.dataset.endDate.slice(0, 10)} · UTC</div>
        {(classFilter !== 'all' || locationFilter !== 'all') && (
          <button type="button" className="secondary-button" onClick={() => { props.onClassFilter('all'); props.onLocationFilter('all'); }}>Reset filters</button>
        )}
      </section>

      <section className="metric-grid" aria-label="Overview metrics">
        <MetricCard label="Available assets" value={`${analysis.availableAssetCount} / ${analysis.assetCount}`} detail="Positive available hours on the final day" />
        <MetricCard label="Effective capacity" value={`${analysis.effectiveCapacity.toFixed(1)} u/h`} detail="Rated capacity weighted by observed availability" />
        <MetricCard label="Utilization" value={`${(analysis.utilization * 100).toFixed(1)}%`} detail="Output ÷ available capacity-hours" />
        <MetricCard label="Availability" value={`${(analysis.availability * 100).toFixed(1)}%`} detail="Available hours ÷ scheduled hours" />
        <MetricCard label="Observation coverage" value={`${(analysis.observationCoverage * 100).toFixed(2)}%`} detail={`${analysis.admittedObservations.toLocaleString()} of ${analysis.expectedObservations.toLocaleString()} expected values`} />
      </section>

      {selected && <div className="selection-banner" role="status">Selected {selected.asset.code} · {classMap.get(selected.asset.classId)} · {selected.asset.location}</div>}

      <div className="dashboard-grid">
        <ChartPanel title="Output and demand" description="Monthly totals across the current asset population." option={trendOption} />
        <ChartPanel title="Utilization distribution" description="Eight deterministic bins; each asset contributes one period-wide utilization value." option={distributionOption} />
        <ChartPanel
          title="Availability and utilization"
          description="Each point is an asset; point size represents rated capacity."
          option={scatterOption}
          keyboardItems={analysis.assetSummaries.map((item) => ({ id: item.asset.id, label: item.asset.code }))}
          selectedId={props.selectedAssetId}
          onSelect={props.onSelectAsset}
        />
        <ChartPanel
          title="Class comparison"
          description="Utilization and availability use one shared percent scale."
          option={classOption}
          keyboardItems={analysis.classComparisons.map((item) => ({ id: item.classId, label: item.className }))}
          selectedId={classFilter === 'all' ? null : classFilter}
          onSelect={props.onClassFilter}
        />
      </div>

      <section className="panel asset-table-panel">
        <div className="panel-heading"><div><h2>Assets in scope</h2><p>Sort, select, or open an asset without changing the observations.</p></div></div>
        <AssetTable rows={analysis.assetSummaries} selectedAssetId={props.selectedAssetId} onSelect={props.onSelectAsset} onOpen={props.onOpenAsset} />
      </section>
    </div>
  );
}
