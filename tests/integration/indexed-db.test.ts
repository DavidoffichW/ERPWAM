import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PersistedApplicationState } from '../../src/contracts';
import { emptyApplicationState } from '../../src/core';
import {
  clearApplicationStorage,
  loadApplicationState,
  LocalStorageError,
  saveApplicationState,
} from '../../src/web/adapters/indexed-db';

function stateAt(label: string): PersistedApplicationState {
  return { ...emptyApplicationState(), lastCommittedAt: label };
}

async function deleteDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('erp-local-application');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Test database deletion was blocked.'));
  });
}

describe('IndexedDB application-state persistence', () => {
  beforeEach(deleteDatabase);
  afterEach(deleteDatabase);

  it('starts empty, commits state, reloads it, and clears without deleting the database', async () => {
    expect(await loadApplicationState()).toEqual(emptyApplicationState());
    const state = stateAt('2026-11-01T01:00:00.000Z');
    await saveApplicationState(state);
    expect(await loadApplicationState()).toEqual(state);
    await clearApplicationStorage();
    expect(await loadApplicationState()).toEqual(emptyApplicationState());
  });

  it('preserves the newest state after overlapping save requests', async () => {
    const first = stateAt('first');
    const second = stateAt('second');
    await Promise.all([saveApplicationState(first), saveApplicationState(second)]);
    expect((await loadApplicationState()).lastCommittedAt).toBe('second');
  });

  it('rejects unsupported state schemas before opening a write transaction', async () => {
    await expect(saveApplicationState({ ...emptyApplicationState(), schemaVersion: '1.0' } as unknown as PersistedApplicationState))
      .rejects.toBeInstanceOf(LocalStorageError);
    expect(await loadApplicationState()).toEqual(emptyApplicationState());
  });

  it('fails closed on corrupted committed state', async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('erp-local-application', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('application-state');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('application-state', 'readwrite');
    transaction.objectStore('application-state').put({ schemaVersion: '999' }, 'current');
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    await expect(loadApplicationState()).rejects.toThrow(/unsupported/i);
  });
});
