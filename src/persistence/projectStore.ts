import type { AnalyticalProject } from '../domain/contracts';
import { validateAnalyticalProject } from '../domain/validation';

const DATABASE_NAME = 'erpwam-analytics-v1';
const DATABASE_VERSION = 1;
const PROJECT_STORE = 'analytical-projects';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        database.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open the analytical project database.'));
    request.onblocked = () => reject(new Error('The analytical project database is blocked by another page.'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Project transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Project transaction was aborted.'));
  });
}

export async function saveProject(project: AnalyticalProject): Promise<AnalyticalProject> {
  await validateAnalyticalProject(project);
  const database = await openDatabase();
  try {
    const saved = structuredClone(project);
    const transaction = database.transaction(PROJECT_STORE, 'readwrite', { durability: 'strict' });
    transaction.objectStore(PROJECT_STORE).put(saved);
    await transactionComplete(transaction);
    return saved;
  } finally {
    database.close();
  }
}

export async function loadProject(id: string): Promise<AnalyticalProject | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECT_STORE, 'readonly');
    const request = transaction.objectStore(PROJECT_STORE).get(id);
    const result = await new Promise<AnalyticalProject | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as AnalyticalProject | undefined);
      request.onerror = () => reject(request.error ?? new Error('Unable to read the project.'));
    });
    await transactionComplete(transaction);
    return result ? structuredClone(await validateAnalyticalProject(result)) : null;
  } finally {
    database.close();
  }
}

export async function listProjects(): Promise<Pick<AnalyticalProject, 'id' | 'title' | 'updatedAt'>[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECT_STORE, 'readonly');
    const request = transaction.objectStore(PROJECT_STORE).getAll();
    const projects = await new Promise<AnalyticalProject[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as AnalyticalProject[]);
      request.onerror = () => reject(request.error ?? new Error('Unable to list projects.'));
    });
    await transactionComplete(transaction);
    return projects.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
  } finally {
    database.close();
  }
}

export async function deleteProject(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECT_STORE, 'readwrite', { durability: 'strict' });
    transaction.objectStore(PROJECT_STORE).delete(id);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export const analyticalDatabaseIdentity = DATABASE_NAME;
