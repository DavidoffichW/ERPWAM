import { canonicalStringify, sha256 } from '../domain/canonical';
import type { AnalyticalProject, PortableProject } from '../domain/contracts';
import { validateAnalyticalProject } from '../domain/validation';

export const MAX_PORTABLE_BYTES = 20 * 1024 * 1024;

export async function exportPortableProject(project: AnalyticalProject): Promise<string> {
  await validateAnalyticalProject(project);
  const payload = structuredClone(project);
  const digest = await sha256(canonicalStringify(payload));
  const portable: PortableProject = {
    schema: 'erpwam.analytics.portable/1',
    payload,
    integrity: { algorithm: 'SHA-256', digest },
  };
  return `${JSON.stringify(portable, null, 2)}\n`;
}

export async function importPortableProject(source: string): Promise<AnalyticalProject> {
  if (new TextEncoder().encode(source).length > MAX_PORTABLE_BYTES) {
    throw new RangeError('Portable project exceeds the 20 MiB admission limit.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new TypeError('Portable project is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object') throw new TypeError('Portable project must be an object.');
  const candidate = parsed as Partial<PortableProject>;
  if (candidate.schema !== 'erpwam.analytics.portable/1') {
    throw new RangeError('Unsupported or historical portable project schema.');
  }
  if (candidate.integrity?.algorithm !== 'SHA-256' || typeof candidate.integrity.digest !== 'string') {
    throw new TypeError('Portable project integrity metadata is missing.');
  }
  const actual = await sha256(canonicalStringify(candidate.payload));
  if (actual !== candidate.integrity.digest) throw new Error('Portable project integrity verification failed.');
  const payload = await validateAnalyticalProject(candidate.payload);
  return structuredClone(payload);
}

export function downloadPortableProject(source: string, filename: string): void {
  const blob = new Blob([source], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
