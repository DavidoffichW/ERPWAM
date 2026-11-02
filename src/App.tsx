import { Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { createJuniperProject } from './data/juniper';
import type { AnalyticalProject, ProjectViewState } from './domain/contracts';
import { LandingPage } from './pages/LandingPage';
import { deleteProject, listProjects, loadProject, saveProject } from './persistence/projectStore';
import { downloadPortableProject, exportPortableProject, importPortableProject, MAX_PORTABLE_BYTES } from './persistence/portable';

type Route = ProjectViewState['route'];

const OverviewPage = lazy(() => import('./pages/OverviewPage').then((module) => ({ default: module.OverviewPage })));
const AssetsPage = lazy(() => import('./pages/AssetsPage').then((module) => ({ default: module.AssetsPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const ForecastsPage = lazy(() => import('./pages/ForecastsPage').then((module) => ({ default: module.ForecastsPage })));
const ScenariosPage = lazy(() => import('./pages/ScenariosPage').then((module) => ({ default: module.ScenariosPage })));
const DataPage = lazy(() => import('./pages/DataPage').then((module) => ({ default: module.DataPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

const routes: { id: Route; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'assets', label: 'Assets' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'forecasts', label: 'Forecasts' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'data', label: 'Data' },
  { id: 'settings', label: 'Settings' },
];

function NavIcon({ route }: { route: Route }) {
  const paths: Record<Route, ReactNode> = {
    overview: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></>,
    assets: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></>,
    analytics: <path d="M4 20V12M10 20V7M16 20V10M22 20V4M2 21h20" />,
    forecasts: <path d="m3 17 6-6 4 4 8-9M15 6h6v6" />,
    scenarios: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="18" cy="19" r="2" /><path d="M6 7v9a3 3 0 0 0 3 3h7M6 7v1a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4" /></>,
    data: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M10 2h4l.7 3 2 .9 2.6-1.5 2.3 3.5-2.2 2 .1 2.2 2.1 2-2.2 3.5-2.6-1.5-2 .9-.8 3h-4l-.7-3-2-.9-2.6 1.5-2.2-3.5 2.1-2-.1-2.2-2.1-2 2.2-3.5 2.6 1.5 2-.9z" /></>,
  };
  return <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[route]}</svg>;
}

interface AppState {
  project: AnalyticalProject | null;
  saved: { id: string; title: string; updatedAt: string }[];
  loading: boolean;
  dirty: boolean;
  notice: string | null;
  error: string | null;
}

export function App() {
  const [state, setState] = useState<AppState>({ project: null, saved: [], loading: false, dirty: false, notice: null, error: null });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('erpwam-analytics-theme') === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    void refreshSaved();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('erpwam-analytics-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!state.notice) return;
    const timeout = window.setTimeout(() => setState((current) => current.notice === state.notice ? { ...current, notice: null } : current), 4000);
    return () => window.clearTimeout(timeout);
  }, [state.notice]);

  async function refreshSaved() {
    try {
      const saved = await listProjects();
      setState((current) => ({ ...current, saved }));
    } catch (reason) {
      setState((current) => ({ ...current, error: reason instanceof Error ? reason.message : 'Unable to inspect local projects.' }));
    }
  }

  async function explore() {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const project = await createJuniperProject();
      setState((current) => ({ ...current, project, loading: false, dirty: true, notice: null }));
    } catch (reason) {
      setState((current) => ({ ...current, loading: false, error: reason instanceof Error ? reason.message : 'Unable to open the example workspace.' }));
    }
  }

  async function openSaved(id: string) {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const project = await loadProject(id);
      if (!project) {
        setState((current) => ({ ...current, loading: false, error: 'The selected local project no longer exists.' }));
        return;
      }
      setState((current) => ({ ...current, project, loading: false, dirty: false, notice: 'Project reopened.' }));
    } catch (reason) {
      setState((current) => ({ ...current, loading: false, error: reason instanceof Error ? reason.message : 'Unable to reopen the local project.' }));
    }
  }

  async function importProject(file: File) {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      if (file.size > MAX_PORTABLE_BYTES) {
        throw new RangeError('Portable project exceeds the 20 MiB admission limit.');
      }
      const project = await importPortableProject(await file.text());
      setState((current) => ({ ...current, project, loading: false, dirty: true, notice: 'Project imported and checked.' }));
    } catch (reason) {
      setState((current) => ({ ...current, loading: false, error: reason instanceof Error ? reason.message : 'Portable project import failed.' }));
    }
  }

  function updateProject(project: AnalyticalProject) {
    setState((current) => ({ ...current, project, dirty: true, notice: null }));
  }

  function navigate(route: Route) {
    if (!state.project) return;
    updateProject({ ...state.project, view: { ...state.project.view, route } });
  }

  function selectAsset(id: string) {
    if (!state.project) return;
    updateProject({ ...state.project, view: { ...state.project.view, selectedAssetId: id } });
  }

  function openAsset(id: string) {
    if (!state.project) return;
    updateProject({ ...state.project, view: { ...state.project.view, selectedAssetId: id, route: 'assets' } });
  }

  function updateFilter(key: 'classFilter' | 'locationFilter', value: string) {
    if (!state.project) return;
    updateProject({ ...state.project, view: { ...state.project.view, [key]: value } });
  }

  async function persist() {
    if (!state.project) return;
    try {
      const savedProject = { ...state.project, updatedAt: new Date().toISOString() };
      await saveProject(savedProject);
      setState((current) => ({ ...current, project: savedProject, dirty: false, notice: 'Project saved in this browser.', error: null }));
      await refreshSaved();
    } catch (reason) {
      setState((current) => ({ ...current, error: reason instanceof Error ? reason.message : 'The project could not be saved.' }));
    }
  }

  async function exportProject() {
    if (!state.project) return;
    try {
      const source = await exportPortableProject(state.project);
      downloadPortableProject(source, 'erpwam-juniper-works-project.json');
      setState((current) => ({ ...current, notice: 'Project export ready.', error: null }));
    } catch (reason) {
      setState((current) => ({ ...current, error: reason instanceof Error ? reason.message : 'The project could not be exported.' }));
    }
  }

  async function removeProject() {
    if (!state.project) return;
    if (!window.confirm(`Delete the local project “${state.project.title}”? Export it first if you need a backup.`)) return;
    try {
      await deleteProject(state.project.id);
      setState((current) => ({ ...current, project: null, dirty: false, notice: 'Local project deleted.', error: null }));
      await refreshSaved();
    } catch (reason) {
      setState((current) => ({ ...current, error: reason instanceof Error ? reason.message : 'The local project could not be deleted.' }));
    }
  }

  if (!state.project) {
    return <ErrorBoundary><LandingPage loading={state.loading} savedProjects={state.saved} onExplore={explore} onOpen={openSaved} onImport={importProject} />{state.error && <div className="global-message error-banner" role="alert">{state.error}</div>}{state.notice && <div className="global-message toast-message" role="status">{state.notice}</div>}</ErrorBoundary>;
  }

  const project = state.project;
  const route = project.view.route;
  const isSynthetic = project.dataset.provenance.some((item) => item.sourceKind === 'SYNTHETIC_GENERATOR');
  return <ErrorBoundary><div className="app-shell">
    <aside className="sidebar">
      <button type="button" className="brand sidebar-brand" onClick={() => setState((current) => ({ ...current, project: null }))}>ERPWAM</button>
      <nav aria-label="Workspace">{routes.map((item) => <button type="button" key={item.id} className={route === item.id ? 'nav-item active' : 'nav-item'} aria-current={route === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><NavIcon route={item.id} /><span>{item.label}</span></button>)}</nav>
    </aside>
    <div className="app-main">
      <header className="app-toolbar"><div><strong>{project.title}</strong>{isSynthetic && <span className="dataset-badge">Synthetic data</span>}{state.dirty && <span className="unsaved-indicator" title="Workspace changes not saved">Unsaved</span>}</div><div className="toolbar-actions"><button type="button" className="secondary-button" onClick={persist}>Save</button><button type="button" className="secondary-button" onClick={exportProject}>Export</button></div></header>
      {state.error && <div className="error-banner" role="alert">{state.error}</div>}
      {state.notice && <div className="toast-message" role="status">{state.notice}</div>}
      <main><Suspense fallback={<div className="workspace-loading" role="status">Loading workspace…</div>}>
        {route === 'overview' && <OverviewPage project={project} selectedAssetId={project.view.selectedAssetId} classFilter={project.view.classFilter} locationFilter={project.view.locationFilter} onClassFilter={(value) => updateFilter('classFilter', value)} onLocationFilter={(value) => updateFilter('locationFilter', value)} onSelectAsset={selectAsset} onOpenAsset={openAsset} />}
        {route === 'assets' && <AssetsPage project={project} selectedAssetId={project.view.selectedAssetId} onSelectAsset={selectAsset} />}
        {route === 'analytics' && <AnalyticsPage project={project} />}
        {route === 'forecasts' && <ForecastsPage project={project} selectedAssetId={project.view.selectedAssetId} onSelectAsset={selectAsset} onProjectChange={updateProject} />}
        {route === 'scenarios' && <ScenariosPage project={project} onProjectChange={updateProject} onOpenForecasts={() => navigate('forecasts')} />}
        {route === 'data' && <DataPage project={project} onSave={persist} onExport={exportProject} />}
        {route === 'settings' && <SettingsPage project={project} theme={theme} onTheme={setTheme} onDelete={removeProject} />}
      </Suspense></main>
    </div>
  </div></ErrorBoundary>;
}

interface ErrorBoundaryState { failed: boolean; message: string }

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, message: '' };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { failed: true, message: error.message }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('ERPWAM render failure', error, info.componentStack); }
  render() { return this.state.failed ? <main className="fatal-error"><h1>ERPWAM could not render this workspace</h1><p>{this.state.message}</p><button type="button" className="primary-button" onClick={() => location.reload()}>Reload application</button></main> : this.props.children; }
}
