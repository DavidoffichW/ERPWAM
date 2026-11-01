import { describe, expect, it } from 'vitest';
import {
  canonicalDigest,
  canonicalSerialize,
  confirmMappings,
  createCandidateScope,
  createDatasetFromTable,
  createDecisionContext,
  editCell,
  restoreCell,
  setColumnRole,
  stampDatasetRevisions,
  validateDataset,
} from '../../src/core';
import { qualifiedDataset } from '../helpers/planning';

describe('dataset and revision contracts', () => {
  it('preserves duplicate and blank source headers with stable positional identities', () => {
    const dataset = createDatasetFromTable({
      sourceName: 'headers.xlsx',
      sourceIdentity: 'sha256:fixture',
      sheetName: 'Plan',
      synthetic: false,
      headers: ['', 'Priority', 'Priority', 'Unknown source field'],
      rows: [[1, 'P1', 'High', 'kept']],
    });

    expect(new Set(dataset.columns.map((column) => column.id)).size).toBe(4);
    expect(dataset.columns.map((column) => column.duplicateOrdinal)).toEqual([1, 1, 2, 1]);
    expect(dataset.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['EMPTY_HEADER', 'DUPLICATE_HEADER']));
    expect(dataset.rows[0].cells[dataset.columns[3].id].currentRaw).toBe('kept');
  });

  it('keeps source and edited values distinct and restores provenance', () => {
    const dataset = createDatasetFromTable({
      sourceName: 'plan.xlsx',
      sourceIdentity: 'sha256:source',
      sheetName: 'Plan',
      synthetic: false,
      headers: ['Planned Job ID', 'Estimated Cost'],
      rows: [['JOB-1', 100]],
    });
    const row = dataset.rows[0];
    const cost = dataset.columns[1];
    const original = structuredClone(row.cells[cost.id]);
    const edited = editCell(dataset, row.id, cost.id, 125);

    expect(edited.rows[0].cells[cost.id]).toMatchObject({
      originalRaw: 100,
      currentRaw: 125,
      acceptedRaw: 100,
      modified: true,
      provenance: { kind: 'USER_ENTERED' },
      originalProvenance: { kind: 'IMPORTED' },
    });
    const restored = restoreCell(edited, row.id, cost.id, original);
    expect(restored.rows[0].cells[cost.id]).toEqual(original);
  });

  it('detects duplicate grain values without removing either record', () => {
    const dataset = createDatasetFromTable({
      sourceName: 'duplicates.xlsx',
      sourceIdentity: 'sha256:duplicates',
      sheetName: 'Plan',
      synthetic: false,
      headers: ['Planned Job ID', 'Status'],
      rows: [['JOB-1', 'Ready'], ['JOB-1', 'Proposed']],
    });
    const checked = validateDataset(confirmMappings(dataset));

    expect(checked.rows).toHaveLength(2);
    expect(checked.issues.filter((issue) => issue.code === 'DUPLICATE_GRAIN_VALUE')).toHaveLength(2);
    expect(checked.rows.every((row) => row.readiness === 'INVALID')).toBe(true);
  });

  it('changes mapping and snapshot identities only when their governing evidence changes', async () => {
    const first = await qualifiedDataset();
    const repeated = await stampDatasetRevisions(first);
    expect(repeated.mappingRevision).toBe(first.mappingRevision);
    expect(repeated.snapshotRevision).toBe(first.snapshotRevision);

    const description = first.columns.find((column) => column.semanticRole === 'job_description')!;
    const remapped = await stampDatasetRevisions(setColumnRole(first, description.id, null));
    expect(remapped.mappingRevision).not.toBe(first.mappingRevision);
    expect(remapped.snapshotRevision).not.toBe(first.snapshotRevision);

    const status = first.columns.find((column) => column.semanticRole === 'status')!;
    const edited = await stampDatasetRevisions(editCell(first, first.rows[0].id, status.id, 'Scheduled'));
    expect(edited.mappingRevision).toBe(first.mappingRevision);
    expect(edited.snapshotRevision).not.toBe(first.snapshotRevision);
  });

  it('uses canonical key ordering and rejects non-finite evidence numbers', async () => {
    expect(canonicalSerialize({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(await canonicalDigest({ b: 2, a: 1 })).toBe(await canonicalDigest({ a: 1, b: 2 }));
    expect(canonicalSerialize(-0)).toBe('-0');
    expect(() => canonicalSerialize(Number.POSITIVE_INFINITY)).toThrow(/non-finite/i);
  });
});

describe('decision scope compatibility', () => {
  it('rejects contexts and scopes from a different dataset snapshot', async () => {
    const dataset = await qualifiedDataset();
    const context = createDecisionContext(dataset, 'JOB_REPLACEMENT', [dataset.rows[0].id], '2028-12-31');
    const changed = { ...dataset, snapshotRevision: `sha256:${'f'.repeat(64)}` };
    await expect(createCandidateScope(changed, context, { mode: 'ALL_RECORDS' })).rejects.toThrow(/exact dataset snapshot/i);
  });

  it('keeps review-required rows available in all-records and manual scopes', async () => {
    const dataset = await qualifiedDataset();
    const reviewId = dataset.rows[2].id;
    const withWarning = {
      ...dataset,
      rows: dataset.rows.map((row) => row.id === reviewId ? { ...row, readiness: 'REVIEW_REQUIRED' as const } : row),
    };
    const context = createDecisionContext(withWarning, 'JOB_REPLACEMENT', [dataset.rows[0].id], '2028-12-31');
    const all = await createCandidateScope(withWarning, context, { mode: 'ALL_RECORDS' });
    const manual = await createCandidateScope(withWarning, context, { mode: 'MANUAL', manualIncludedRowIds: [reviewId] });

    expect(all.candidateRowIds).toContain(reviewId);
    expect(manual.candidateRowIds).toEqual([reviewId]);
  });
});
