import type { AnalyticalProject } from '../domain/contracts';

interface DataPageProps {
  project: AnalyticalProject;
  onSave: () => Promise<void>;
  onExport: () => Promise<void>;
}

export function DataPage({ project, onSave, onExport }: DataPageProps) {
  const counts = new Map<string, number>();
  for (const issue of project.dataset.qualityIssues) counts.set(issue.kind, (counts.get(issue.kind) ?? 0) + 1);
  const provenance = project.dataset.provenance[0]!;
  return <div className="workspace-page" data-testid="data-page">
    <header className="page-heading"><div><h1>Data &amp; quality</h1></div></header>
    <div className="detail-grid">
      <section className="panel compact-details"><h2>Dataset</h2><dl>
        <div><dt>Assets</dt><dd>{project.dataset.assets.length}</dd></div><div><dt>Observations</dt><dd>{project.dataset.observations.length.toLocaleString()}</dd></div><div><dt>Time zone</dt><dd>{project.dataset.timezone}</dd></div>
      </dl><div className="button-row"><button type="button" className="primary-button" onClick={onSave}>Save locally</button><button type="button" className="secondary-button" onClick={onExport}>Export verified project</button></div></section>
      <section className="panel compact-details"><h2>Quality</h2><dl>{['MISSING','INVALID','DUPLICATE','CONFLICTING','EXCLUDED'].map((kind) => <div key={kind}><dt>{kind.toLowerCase()}</dt><dd>{counts.get(kind) ?? 0}</dd></div>)}</dl><p>Missing values are not replaced with zero.</p></section>
    </div>
    <section className="panel compact-details"><h2>Source</h2><dl><div><dt>Source</dt><dd>{provenance.sourceName}</dd></div><div><dt>Type</dt><dd>{provenance.sourceKind === "PORTABLE_PROJECT" ? "Imported project" : "Included project"}</dd></div><div><dt>Generated</dt><dd>{provenance.generatedAt.slice(0, 10)}</dd></div></dl><details className="methodology"><summary>Technical provenance</summary><dl><div><dt>Schema</dt><dd className="mono">{project.dataset.schema}</dd></div><div><dt>Revision</dt><dd className="mono">{project.dataset.revisionId}</dd></div><div><dt>SHA-256</dt><dd className="mono breakable">{project.dataset.contentHash}</dd></div><div><dt>Seed</dt><dd>{provenance.seed}</dd></div><div><dt>Version</dt><dd>{provenance.generatorVersion}</dd></div></dl></details></section>
  </div>;
}
