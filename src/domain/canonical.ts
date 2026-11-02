function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('Canonical values must contain only finite numbers.');
  }
  return value;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function contentIdentity(value: unknown): Promise<string> {
  return sha256(canonicalStringify(value));
}
