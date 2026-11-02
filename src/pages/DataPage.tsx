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
    <header className="page-heading"><div><span className="eyebrow">Data</span><h1>Dataset identity and quality</h1><p>Review the admitted synthetic source, exclusions, and portable project controls.</p></div><span className="fictional-badge">Fictional dataset</span></header>
    <div className="detail-grid">
      <section className="panel compact-details"><h2>Dataset revision</h2><dl>
        <div><dt>Schema</dt><dd>{project.dataset.schema}</dd></div><div><dt>Revision</dt><dd className="mono">{project.dataset.revisionId}</dd></div><div><dt>Content SHA-256</dt><dd className="mono breakable">{project.dataset.contentHash}</dd></div><div><dt>Assets</dt><dd>{project.dataset.assets.length}</dd></div><div><dt>Observations</dt><dd>{project.dataset.observations.length.toLocaleString()}</dd></div><div><dt>Time zone</dt><dd>{project.dataset.timezone}</dd></div>
      </dl><div className="button-row"><button type="button" className="primary-button" onClick={onSave}>Save locally</button><button type="button" className="secondary-button" onClick={onExport}>Export verified project</button></div></section>
      <section className="panel compact-details"><h2>Quality diagnostics</h2><dl>{['MISSING','INVALID','DUPLICATE','CONFLICTING','EXCLUDED'].map((kind) => <div key={kind}><dt>{kind.toLowerCase()}</dt><dd>{counts.get(kind) ?? 0}</dd></div>)}</dl><p>Measured zero remains a valid observation. Missing and rejected source positions are not converted to zero.</p></section>
    </div>
    <section className="panel compact-details"><h2>Source provenance</h2><dl><div><dt>Source</dt><dd>{provenance.sourceName}</dd></div><div><dt>Kind</dt><dd>{provenance.sourceKind}</dd></div><div><dt>Generator</dt><dd>Version {provenance.generatorVersion}, seed {provenance.seed}</dd></div><div><dt>Generated</dt><dd>{provenance.generatedAt}</dd></div><div><dt>Statement</dt><dd>{provenance.notes}</dd></div></dl></section>
  </div>;
}
