import { describe, expect, it } from 'vitest';
import {
  compareRankings,
  createPriorityListRevision,
  rankByDemonstrationModel,
  rankByPriorityList,
  rankByWeightedCriteria,
  validateHumanRank,
} from '../../src/core';
import { qualifiedDataset, replacementContext } from '../helpers/planning';

describe('ranking population contracts', () => {
  it('rejects a duplicate candidate identity that omits another population member', async () => {
    const dataset = await qualifiedDataset();
    const { context, scope } = await replacementContext(dataset);
    const malformed = {
      ...scope,
      candidateRowIds: [scope.candidateRowIds[0], scope.candidateRowIds[0]],
    };

    await expect(rankByWeightedCriteria(dataset, context.id, malformed, null))
      .rejects.toThrow(/unique.*candidate population/i);
  });

  it('rejects candidate identities and context identities that are outside the admitted scope', async () => {
    const dataset = await qualifiedDataset();
    const { context, scope } = await replacementContext(dataset);

    await expect(rankByWeightedCriteria(dataset, context.id, {
      ...scope,
      candidateRowIds: [...scope.candidateRowIds.slice(1), 'row-not-in-dataset'],
    }, null)).rejects.toThrow(/selected dataset and decision context/i);
    await expect(rankByWeightedCriteria(dataset, 'different-context', scope, null))
      .rejects.toThrow(/selected dataset and decision context/i);
  });

  it('keeps candidates with missing ranking inputs as explicitly unranked', async () => {
    const dataset = await qualifiedDataset();
    const cost = dataset.columns.find((column) => column.semanticRole === 'estimated_cost')!;
    const rowId = dataset.rows[2].id;
    const altered = {
      ...dataset,
      rows: dataset.rows.map((row) => row.id === rowId
        ? { ...row, cells: { ...row.cells, [cost.id]: { ...row.cells[cost.id], normalized: null } } }
        : row),
    };
    const { context, scope } = await replacementContext(altered);
    const ranking = await rankByWeightedCriteria(altered, context.id, scope, null);

    expect(ranking.candidateRowIds).toEqual(scope.candidateRowIds);
    expect(ranking.ranks).toHaveLength(scope.candidateRowIds.length);
    expect(ranking.ranks.find((rank) => rank.rowId === rowId)).toMatchObject({ score: null, rank: null });
  });

  it('preserves exact, nonconsecutive Priority List ranks and leaves missing matches unranked', async () => {
    const dataset = await qualifiedDataset();
    const { context, scope } = await replacementContext(dataset);
    const grain = dataset.grainColumnId!;
    const first = dataset.rows.find((row) => row.id === scope.candidateRowIds[0])!;
    const second = dataset.rows.find((row) => row.id === scope.candidateRowIds[1])!;
    const list = await createPriorityListRevision(
      'Maintenance priorities',
      'Planned Job ID',
      'Priority Rank',
      [
        { itemId: String(first.cells[grain].normalized), priorityRank: 10, additionalFields: {} },
        { itemId: String(second.cells[grain].normalized), priorityRank: 40, additionalFields: {} },
      ],
      'priority-list.xlsx',
      '2026-11-01T00:00:00.000Z',
    );
    const result = await rankByPriorityList(dataset, context.id, scope, null, list);

    expect(result.ranks.find((rank) => rank.rowId === first.id)?.rank).toBe(10);
    expect(result.ranks.find((rank) => rank.rowId === second.id)?.rank).toBe(40);
    expect(result.ranks.filter((rank) => rank.rank === null)).toHaveLength(scope.candidateRowIds.length - 2);
  });

  it('marks duplicate list identities and ranks invalid instead of renumbering them', async () => {
    const list = await createPriorityListRevision(
      'Conflicted list',
      'ID',
      'Rank',
      [
        { itemId: 'A', priorityRank: 7, additionalFields: {} },
        { itemId: 'A', priorityRank: 12, additionalFields: {} },
        { itemId: 'C', priorityRank: 12, additionalFields: {} },
        { itemId: 'D', priorityRank: null, additionalFields: {} },
      ],
      'list.xlsx',
    );

    expect(list.entries.map((entry) => entry.priorityRank)).toEqual([7, 12, 12, null]);
    expect(list.entries.every((entry) => entry.status === 'INVALID')).toBe(true);
    expect(list.issues).toEqual(expect.arrayContaining([
      expect.stringContaining('Duplicate item identifier'),
      expect.stringContaining('Duplicate Priority Rank 12'),
    ]));
  });

  it('produces deterministic weighted and demonstration rankings over the same population', async () => {
    const dataset = await qualifiedDataset();
    const { context, scope } = await replacementContext(dataset);
    const weighted = await rankByWeightedCriteria(dataset, context.id, scope, null);
    const model = await rankByDemonstrationModel(dataset, context.id, scope, null);
    const repeated = await rankByDemonstrationModel(dataset, context.id, scope, null);
    const comparison = compareRankings([weighted, model], 5);

    expect(model.ranks).toEqual(repeated.ranks);
    expect(model.candidateRowIds).toEqual(weighted.candidateRowIds);
    expect(comparison.populationRowIds).toEqual(scope.candidateRowIds);
    expect(comparison.topKOverlap).toBeGreaterThanOrEqual(0);
    expect(comparison.topKOverlap).toBeLessThanOrEqual(1);
  });

  it('rejects incompatible ranking snapshots and incomplete human rankings', async () => {
    const dataset = await qualifiedDataset();
    const { context, scope } = await replacementContext(dataset);
    const weighted = await rankByWeightedCriteria(dataset, context.id, scope, null);
    const changed = { ...weighted, datasetSnapshotRevision: `sha256:${'0'.repeat(64)}` };

    expect(() => compareRankings([weighted, changed])).toThrow(/incompatible/i);
    expect(() => validateHumanRank(
      scope.candidateRowIds.slice(0, -1).map((rowId, index) => ({ rowId, myRank: index + 1 })),
      scope.candidateRowIds,
    )).toThrow(/complete unique ordering/i);
  });
});
