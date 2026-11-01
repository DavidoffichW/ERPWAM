import type {
  CandidateScope,
  CaseSnapshot,
  DecisionContext,
  PlanningDataset,
  WorkbookState,
} from '../../src/contracts';
import {
  confirmMappings,
  createCandidateScope,
  createDecisionContext,
  createSyntheticFacilitiesDataset,
  stampDatasetRevisions,
  validateDataset,
} from '../../src/core';

export async function qualifiedDataset(): Promise<PlanningDataset> {
  const confirmed = validateDataset(confirmMappings(createSyntheticFacilitiesDataset()));
  if (!confirmed.mappingsConfirmed || !confirmed.grainConfirmed) {
    throw new Error('Synthetic fixture mappings did not qualify.');
  }
  return stampDatasetRevisions(confirmed);
}

export function workbookFor(dataset: PlanningDataset): WorkbookState {
  return {
    sourceName: dataset.sourceName,
    sourceIdentity: dataset.sourceIdentity,
    sheets: [dataset],
    activeSheetIndex: 0,
  };
}

export async function replacementContext(dataset: PlanningDataset): Promise<{
  context: DecisionContext;
  scope: CandidateScope;
}> {
  const context = createDecisionContext(
    dataset,
    'JOB_REPLACEMENT',
    [dataset.rows[0].id],
    '2028-12-31',
    '2026-11-01T00:00:00.000Z',
  );
  const scope = await createCandidateScope(dataset, context, {
    mode: 'ALL_RECORDS',
    now: '2026-11-01T00:00:00.000Z',
  });
  return { context, scope };
}

export function caseSnapshot(
  dataset: PlanningDataset,
  context: DecisionContext,
  scope: CandidateScope,
): CaseSnapshot {
  return {
    workbook: workbookFor(dataset),
    dataset,
    context,
    scope,
    ruleSet: null,
    eligibility: null,
    rankings: [],
    myRank: [],
    portfolio: null,
    relationships: [],
    historicalEvents: [],
  };
}
