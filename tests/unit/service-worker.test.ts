import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import packageMetadata from '../../package.json';

type WorkerHandler = (event: {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
  waitUntil(promise: Promise<unknown>): void;
}) => void;

async function serviceWorkerSource(): Promise<string> {
  return readFile(new URL('../../public/sw.js', import.meta.url), 'utf8');
}

async function exerciseNavigation(options: { online: boolean }): Promise<Response> {
  const handlers = new Map<string, WorkerHandler>();
  const cachedIndex = new Response('cached-shell', { status: 200 });
  const networkIndex = new Response('current-shell', { status: 200 });
  const cache = {
    put: vi.fn(async () => undefined),
    addAll: vi.fn(async () => undefined),
  };
  const caches = {
    open: vi.fn(async () => cache),
    match: vi.fn(async (request: RequestInfo | URL) => {
      const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
      return url.endsWith('index.html') || url.endsWith('/ERPWAM/') ? cachedIndex.clone() : undefined;
    }),
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
  };
  const fetch = vi.fn(async () => {
    if (!options.online) throw new Error('offline');
    return networkIndex.clone();
  });
  const self = {
    location: new URL('https://example.test/ERPWAM/sw.js'),
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(),
    addEventListener: (name: string, handler: WorkerHandler) => handlers.set(name, handler),
  };
  runInNewContext(await serviceWorkerSource(), {
    self, caches, fetch, URL, Promise, Set, Response, Request,
  });
  const handler = handlers.get('fetch');
  if (!handler) throw new Error('Service worker did not register a fetch handler.');
  let response: Promise<Response> | Response | undefined;
  const request = new Request('https://example.test/ERPWAM/', { method: 'GET' });
  Object.defineProperty(request, 'mode', { value: 'navigate' });
  handler({
    request,
    respondWith(value) { response = value; },
    waitUntil() {},
  });
  if (!response) throw new Error('Service worker did not respond to navigation.');
  return response;
}

describe('offline shell versioning and navigation', () => {
  it('couples the cache identity to the application release', async () => {
    expect(await serviceWorkerSource()).toContain(`erp-static-v${packageMetadata.version}-erpwam`);
  });

  it('prefers the current online application shell over a cached navigation', async () => {
    expect(await (await exerciseNavigation({ online: true })).text()).toBe('current-shell');
  });

  it('falls back to the cached application shell while offline', async () => {
    expect(await (await exerciseNavigation({ online: false })).text()).toBe('cached-shell');
  });
});
