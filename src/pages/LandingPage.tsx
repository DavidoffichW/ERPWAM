import type { ChangeEvent } from 'react';

interface SavedProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface LandingPageProps {
  loading: boolean;
  savedProjects: SavedProjectSummary[];
  onExplore: () => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  onImport: (file: File) => Promise<void>;
}

export function LandingPage({ loading, savedProjects, onExplore, onOpen, onImport }: LandingPageProps) {
  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) await onImport(file);
    event.target.value = '';
  }
  return <main className="landing-page">
    <header className="landing-nav"><a className="brand" href="/" onClick={(event) => event.preventDefault()}><span>ERPWAM</span></a><span>Local asset analysis</span></header>
    <section className="landing-hero">
      <div className="hero-copy"><h1>Understand how assets and resources perform over time.</h1><p>Review history, compare simple forecast baselines, and test capacity assumptions. Everything stays in this browser.</p><div className="button-row"><button type="button" className="primary-button large" disabled={loading} onClick={onExplore}>{loading ? 'Preparing dataset…' : 'Open example workspace'}</button><label className="secondary-button file-button">Import project<input type="file" accept="application/json,.json" onChange={handleFile} /></label></div></div>
      <div className="hero-visual" aria-label="Illustrative analytical preview"><div className="preview-header"><span>Juniper Works</span></div><div className="preview-kpis"><span><b>18</b> assets</span><span><b>3</b> classes</span><span><b>18 mo</b> history</span></div><svg viewBox="0 0 520 220" role="img" aria-label="Illustrative historical trend"><path d="M10 180 C70 160,90 130,140 145 S220 80,280 105 S360 40,420 72 S475 30,510 48" fill="none" stroke="currentColor" strokeWidth="5"/><path d="M10 195 C90 180,110 165,170 170 S260 125,320 138 S420 95,510 106" fill="none" stroke="#b76f21" strokeWidth="3" strokeDasharray="8 8"/></svg><div className="preview-legend"><span><i className="legend-blue"/>Observed output</span><span><i className="legend-amber"/>Demand</span></div></div>
    </section>
    <section className="landing-features"><article><h2>History</h2><p>See capacity, utilization, availability, and trends.</p></article><article><h2>Forecasts</h2><p>Backtest simple baselines before trusting a projection.</p></article><article><h2>Scenarios</h2><p>Change one assumption without rewriting history.</p></article></section>
    {savedProjects.length > 0 && <section className="saved-projects"><div><h2>Saved workspaces</h2></div><div className="saved-grid">{savedProjects.map((project) => <button type="button" key={project.id} className="saved-card" onClick={() => onOpen(project.id)}><strong>{project.title}</strong><span>Saved {new Date(project.updatedAt).toLocaleString()}</span></button>)}</div></section>}
  </main>;
}
