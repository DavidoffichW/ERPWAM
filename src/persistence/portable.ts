import { canonicalStringify, sha256 } from '../domain/canonical';
import type { AnalyticalProject, PortableProject } from '../domain/contracts';

const MAX_PORTABLE_BYTES = 20 * 1024 * 1024;

function isAnalyticalProject(value: unknown): value is AnalyticalProject {
  if (!value || typeof value !== 'object') return false;
  const project = value as Partial<AnalyticalProject>;
  return project.schema === 'erpwam.analytics.project/1'
    && typeof project.id === 'string'
    && typeof project.title === 'string'
    && project.dataset?.schema === 'erpwam.analytics.dataset/1'
    && Array.isArray(project.dataset.assets)
    && Array.isArray(project.dataset.observations)
    && Array.isArray(project.forecastRuns)
    && Array.isArray(project.scenarios);
}

export async function exportPortableProject(project: AnalyticalProject): Promise<string> {
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
  if (!isAnalyticalProject(candidate.payload)) throw new TypeError('Portable analytical project payload is invalid.');
  const actual = await sha256(canonicalStringify(candidate.payload));
  if (actual !== candidate.integrity.digest) throw new Error('Portable project integrity verification failed.');
  return structuredClone(candidate.payload);
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
