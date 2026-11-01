import { describe, expect, it } from 'vitest';
import type { PersistedApplicationState } from '../../src/contracts';
import {
  appendHumanEvent,
  createPlanningCase,
  emptyApplicationState,
  exportApplicationBackup,
  exportPortableCase,
  importApplicationBackup,
  importPortableCase,
  recordReplacementDecision,
  validateApplicationState,
  verifyPlanningCase,
} from '../../src/core';
import { caseSnapshot, qualifiedDataset, replacementContext, workbookFor } from '../helpers/planning';

describe('decision and case evidence', () => {
  it('rejects a Case assembled from incompatible snapshot revisions', async () => {
    const dataset = await qualifiedDataset();
    const { context, scope } = await replacementContext(dataset);
    const snapshot = caseSnapshot(dataset, context, { ...scope, datasetSnapshotRevision: `sha256:${'0'.repeat(64)}` });
    await expect(createPlanningCase('Invalid', snapshot)).rejects.toThrow(/one immutable dataset snapshot/i);
  });

  it('records one idempotent human decision without replacing it with a ranking', async () => {
    const dataset = await qualifiedDataset();
    const { context, scope } = await replacementContext(dataset);
    const snapshot = caseSnapshot(dataset, context, scope);
    const selectedRowId = scope.candidateRowIds[0];
    const first = await recordReplacementDecision([], {
      name: 'Replacement decision', snapshot, selectedRowId, rankingResultId: null,
      actorLabel: 'Planner', reason: 'Direct human selection.', now: '2026-11-01T00:00:00.000Z',
    });
    const duplicate = await recordReplacementDecision([first.planningCase], {
      name: 'Replacement decision', snapshot, selectedRowId, rankingResultId: null,
      actorLabel: 'Planner', reason: 'Direct human selection.', now: '2026-11-01T00:00:00.000Z',
    });

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(duplicate.planningCase.id).toBe(first.planningCase.id);
    const event = JSON.parse(first.planningCase.events[0].value) as { selectedRowId: string; rankingSource: unknown };
    expect(event).toMatchObject({ selectedRowId, rankingSource: null });
  });

  it('requires corrections to reference prior evidence and preserves event history', async () => {
    const dataset = await qualifiedDataset();
    const { context, scope } = await replacementContext(dataset);
    const initial = await createPlanningCase('Case', caseSnapshot(dataset, context, scope));
    const feedback = await appendHumanEvent(initial, {
      type: 'FEEDBACK_RECORDED', actorLabel: 'Planner', value: 'Review complete', reason: 'Observed result.',
      occurredAt: '2026-11-01T01:00:00.000Z',
    });
    await expect(appendHumanEvent(feedback, {
      type: 'EVIDENCE_CORRECTED', actorLabel: 'Planner', value: 'Correction', reason: 'Correct typo.',
      supersedesEventId: 'missing-event',
    })).rejects.toThrow(/existing event/i);
    const corrected = await appendHumanEvent(feedback, {
      type: 'EVIDENCE_CORRECTED', actorLabel: 'Planner', value: 'Review corrected', reason: 'Correct typo.',
      supersedesEventId: feedback.events[0].id, occurredAt: '2026-11-01T02:00:00.000Z',
    });
    expect(corrected.events).toHaveLength(2);
    expect(corrected.events[1].supersedesEventId).toBe(feedback.events[0].id);
    expect(await verifyPlanningCase(corrected)).toBe(true);
  });

  it('round-trips a portable Case and rejects altered historical evidence', async () => {
    const dataset = await qualifiedDataset();
    const { context, scope } = await replacementContext(dataset);
    const planningCase = await createPlanningCase('Portable', caseSnapshot(dataset, context, scope));
    const serialized = await exportPortableCase(planningCase);
    expect(await importPortableCase(serialized)).toEqual(planningCase);

    const envelope = JSON.parse(serialized) as { planningCase: { name: string } };
    envelope.planningCase.name = 'Altered';
    await expect(importPortableCase(JSON.stringify(envelope))).rejects.toThrow(/integrity/i);
  });
});

describe('application backup compatibility', () => {
  it('round-trips v2 state and retains workspace identities', async () => {
    const dataset = await qualifiedDataset();
    const workspace = { id: 'workspace-1', name: 'Qualified plan', workbook: workbookFor(dataset), savedAt: '2026-11-01T00:00:00.000Z' };
    const state: PersistedApplicationState = {
      ...emptyApplicationState(),
      workspaces: [workspace],
      activeWorkspaceId: workspace.id,
      decisionDrafts: [{
        workspaceId: workspace.id, context: null, scope: null, ruleSet: null, eligibility: null,
        rankings: [], activeRankingId: null, myRank: [], portfolio: null, updatedAt: '2026-11-01T00:00:00.000Z',
      }],
    };
    const restored = await importApplicationBackup(await exportApplicationBackup(state));
    expect(restored).toEqual(state);
    expect(await validateApplicationState(restored)).toBe(true);
  });

  it('accepts a correctly digested historical product envelope and migrates schema 1.0', async () => {
    const { canonicalDigest, canonicalSerialize } = await import('../../src/core');
    const legacyState = { ...emptyApplicationState(), schemaVersion: '1.0' as const };
    const body = {
      product: 'Enterprise Resource Planner', envelopeVersion: '1.0',
      contentType: 'ERP_APPLICATION_BACKUP', state: legacyState,
    };
    const restored = await importApplicationBackup(canonicalSerialize({ ...body, digest: await canonicalDigest(body) }));
    expect(restored.schemaVersion).toBe('2.0');
    expect(restored.workspaces).toEqual([]);
  });

  it('rejects corrupted backup content', async () => {
    const serialized = await exportApplicationBackup(emptyApplicationState());
    const envelope = JSON.parse(serialized) as { state: { activeWorkspaceId: string | null } };
    envelope.state.activeWorkspaceId = 'invented';
    await expect(importApplicationBackup(JSON.stringify(envelope))).rejects.toThrow(/integrity/i);
  });
});
