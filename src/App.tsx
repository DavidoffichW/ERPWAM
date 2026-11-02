import { Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { createJuniperProject } from './data/juniper';
import type { AnalyticalProject, ProjectViewState } from './domain/contracts';
import { LandingPage } from './pages/LandingPage';
import { deleteProject, listProjects, loadProject, saveProject } from './persistence/projectStore';
import { downloadPortableProject, exportPortableProject, importPortableProject } from './persistence/portable';

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
      setState((current) => ({ ...current, project, loading: false, dirty: true, notice: 'Fictional Juniper Works dataset loaded.' }));
    } catch (reason) {
      setState((current) => ({ ...current, loading: false, error: reason instanceof Error ? reason.message : 'Unable to create the fictional dataset.' }));
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
      setState((current) => ({ ...current, project, loading: false, dirty: false, notice: 'Local project reopened.' }));
    } catch (reason) {
      setState((current) => ({ ...current, loading: false, error: reason instanceof Error ? reason.message : 'Unable to reopen the local project.' }));
    }
  }

  async function importProject(file: File) {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const project = await importPortableProject(await file.text());
      setState((current) => ({ ...current, project, loading: false, dirty: true, notice: 'Portable project integrity verified.' }));
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
      setState((current) => ({ ...current, notice: 'Integrity-checked project exported.', error: null }));
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
    return <ErrorBoundary><LandingPage loading={state.loading} savedProjects={state.saved} onExplore={explore} onOpen={openSaved} onImport={importProject} />{state.error && <div className="global-message error-banner" role="alert">{state.error}</div>}{state.notice && <div className="global-message notice-banner" role="status">{state.notice}</div>}</ErrorBoundary>;
  }

  const project = state.project;
  const route = project.view.route;
  return <ErrorBoundary><div className="app-shell">
    <aside className="sidebar">
      <button type="button" className="brand sidebar-brand" onClick={() => setState((current) => ({ ...current, project: null }))}><span className="brand-mark">E</span><span>ERPWAM</span></button>
      <nav aria-label="Workspace">{routes.map((item) => <button type="button" key={item.id} className={route === item.id ? 'nav-item active' : 'nav-item'} aria-current={route === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>{item.label}</button>)}</nav>
      <div className="sidebar-footer"><span className="fictional-badge">Fictional data</span><small>Analytical project schema 1</small></div>
    </aside>
    <div className="app-main">
      <header className="app-toolbar"><div><strong>{project.title}</strong>{state.dirty && <span className="unsaved-indicator">Unsaved changes</span>}</div><div className="toolbar-actions"><button type="button" className="secondary-button" onClick={persist}>Save</button><button type="button" className="secondary-button" onClick={exportProject}>Export</button></div></header>
      {state.error && <div className="error-banner" role="alert">{state.error}</div>}
      {state.notice && <div className="notice-banner" role="status">{state.notice}</div>}
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
