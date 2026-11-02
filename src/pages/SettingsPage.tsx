import type { AnalyticalProject } from '../domain/contracts';
import { analyticalDatabaseIdentity } from '../persistence/projectStore';

interface SettingsPageProps {
  project: AnalyticalProject;
  theme: 'light' | 'dark';
  onTheme: (theme: 'light' | 'dark') => void;
  onDelete: () => Promise<void>;
}

export function SettingsPage({ project, theme, onTheme, onDelete }: SettingsPageProps) {
  return <div className="workspace-page" data-testid="settings-page"><header className="page-heading"><div><h1>Settings</h1></div></header><div className="detail-grid"><section className="panel compact-details"><h2>Display</h2><label>Theme<select value={theme} onChange={(event) => onTheme(event.target.value as 'light' | 'dark')}><option value="light">Light</option><option value="dark">Dark</option></select></label><dl><div><dt>Project time zone</dt><dd>{project.dataset.timezone}</dd></div></dl></section><section className="panel compact-details"><h2>Local persistence</h2><dl><div><dt>Project</dt><dd>{project.title}</dd></div></dl><p>Local projects remain in this browser. Export a copy for backup.</p><button type="button" className="danger-button" onClick={onDelete}>Delete local project</button><details className="methodology"><summary>Storage details</summary><dl><div><dt>Database</dt><dd className="mono">{analyticalDatabaseIdentity}</dd></div><div><dt>Schema</dt><dd className="mono">{project.schema}</dd></div></dl></details></section></div></div>;
}
