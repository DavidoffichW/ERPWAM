import { describe, expect, it } from 'vitest';
import { createJuniperProject } from '../src/data/juniper';
import { canonicalStringify, sha256 } from '../src/domain/canonical';
import { exportPortableProject, importPortableProject } from '../src/persistence/portable';

describe('portable analytical projects', () => {
  it('round-trips a verified project independently', async () => {
    const project = await createJuniperProject();
    const source = await exportPortableProject(project);
    expect(new TextEncoder().encode(source).length).toBeLessThan(20 * 1024 * 1024);
    expect(await importPortableProject(source)).toEqual(project);
  });

  it('rejects corruption and historical schema identities', async () => {
    const project = await createJuniperProject();
    const source = await exportPortableProject(project);
    const corrupted = source.replace('Juniper Works analysis', 'Changed without rehashing');
    await expect(importPortableProject(corrupted)).rejects.toThrow('integrity verification failed');
    await expect(importPortableProject(JSON.stringify({ schema: 'enterprise-resource-planner/1' }))).rejects.toThrow('Unsupported or historical');
    await expect(importPortableProject(JSON.stringify({ schema: 'erpwam.analytics.portable/2' }))).rejects.toThrow('Unsupported or historical');
  });

  it('rejects a self-hashed payload that violates domain references', async () => {
    const source = await exportPortableProject(await createJuniperProject());
    const portable = JSON.parse(source) as {
      payload: { dataset: { observations: { assetId: string }[] } };
      integrity: { digest: string };
    };
    portable.payload.dataset.observations[0]!.assetId = 'unknown-asset';
    portable.integrity.digest = await sha256(canonicalStringify(portable.payload));
    await expect(importPortableProject(JSON.stringify(portable))).rejects.toThrow('unknown asset or metric');
  });
});
