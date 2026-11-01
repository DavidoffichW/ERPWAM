import type { ReactNode } from 'react';

type IconName = 'columns' | 'download' | 'help' | 'menu' | 'moon' | 'redo' | 'search' | 'sun' | 'undo' | 'upload';

const paths: Record<IconName, ReactNode> = {
  columns: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/></>,
  download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 19h14"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.2 2.3c-.8.4-1 1-1 1.7M12 17h.01"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  moon: <path d="M20 15.4A8 8 0 0 1 8.6 4 8.5 8.5 0 1 0 20 15.4Z"/>,
  redo: <><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2.1 5"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  undo: <><path d="M4 7v5h5"/><path d="M5 12a7 7 0 1 1 2.1 5"/></>,
  upload: <><path d="M12 16V4m0 0 4 4m-4-4-4 4"/><path d="M5 20h14"/></>,
};

export function Icon({ name }: { name: IconName }) {
  return <svg className="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
