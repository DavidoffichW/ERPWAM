import { describe, expect, it } from 'vitest';
import type { PortfolioCandidate, PortfolioConstraint } from '../../src/contracts';
import { optimizePortfolio } from '../../src/core';

function referenceSelection(candidates: PortfolioCandidate[], constraint: PortfolioConstraint): string[] {
  let best: PortfolioCandidate[] = [];
  let bestValue = 0;
  let bestCost = 0;
  let bestKey = '';
  const ordered = [...candidates].sort((left, right) => left.rowId.localeCompare(right.rowId));
  for (let mask = 0; mask < 2 ** ordered.length; mask += 1) {
    const selected = ordered.filter((_, index) => (mask & (2 ** index)) !== 0);
    const cost = selected.reduce((sum, candidate) => sum + candidate.cost, 0);
    const resources = selected.reduce<Record<string, number>>((totals, candidate) => {
      for (const [name, value] of Object.entries(candidate.resourceRequirements)) {
        totals[name] = (totals[name] ?? 0) + value;
      }
      return totals;
    }, {});
    if (cost > constraint.budget + Number.EPSILON) continue;
    if (Object.entries(resources).some(([name, used]) => used > (constraint.resourceCapacities[name] ?? 0) + Number.EPSILON)) continue;
    const value = selected.reduce((sum, candidate) => sum + candidate.value, 0);
    const key = selected.map((candidate) => candidate.rowId).join('\0');
    if (value > bestValue || (value === bestValue && (cost < bestCost || (cost === bestCost && key < bestKey)))) {
      best = selected;
      bestValue = value;
      bestCost = cost;
      bestKey = key;
    }
  }
  return best.map((candidate) => candidate.rowId);
}

const constraint: PortfolioConstraint = { budget: 10, resourceCapacities: { crew: 4 } };

describe('portfolio optimization', () => {
  it.each([
    { name: 'empty population', candidates: [] },
    { name: 'one feasible candidate', candidates: [{ rowId: 'a', value: 4, cost: 2, resourceRequirements: { crew: 1 } }] },
    { name: 'zero cost and zero value', candidates: [
      { rowId: 'a', value: 5, cost: 0, resourceRequirements: { crew: 1 } },
      { rowId: 'b', value: 0, cost: 0, resourceRequirements: {} },
    ] },
    { name: 'negative value', candidates: [
      { rowId: 'a', value: 5, cost: 3, resourceRequirements: { crew: 1 } },
      { rowId: 'b', value: -2, cost: 1, resourceRequirements: { crew: 1 } },
    ] },
    { name: 'tied optimum', candidates: [
      { rowId: 'a', value: 5, cost: 5, resourceRequirements: { crew: 1 } },
      { rowId: 'b', value: 5, cost: 4, resourceRequirements: { crew: 1 } },
      { rowId: 'c', value: 1, cost: 7, resourceRequirements: { crew: 4 } },
    ] },
  ])('matches an independent brute-force oracle for $name', async ({ candidates }) => {
    const typedCandidates = candidates as PortfolioCandidate[];
    const result = await optimizePortfolio('context', 'snapshot', typedCandidates, constraint, '2026-11-01T00:00:00.000Z');
    expect(result.selectedRowIds).toEqual(referenceSelection(typedCandidates, constraint));
    expect(result.method).toBe('EXACT');
    expect(result.globallyOptimal).toBe(true);
  });

  it('is invariant to candidate input order under exact tie policy', async () => {
    const candidates = [
      { rowId: 'c', value: 7, cost: 6, resourceRequirements: { crew: 2 } },
      { rowId: 'a', value: 4, cost: 3, resourceRequirements: { crew: 1 } },
      { rowId: 'b', value: 4, cost: 3, resourceRequirements: { crew: 1 } },
    ];
    const forward = await optimizePortfolio('context', 'snapshot', candidates, constraint);
    const reverse = await optimizePortfolio('context', 'snapshot', [...candidates].reverse(), constraint);
    expect(forward.selectedRowIds).toEqual(reverse.selectedRowIds);
  });

  it('rejects duplicate identities and invalid numeric inputs', async () => {
    await expect(optimizePortfolio('context', 'snapshot', [
      { rowId: 'a', value: 1, cost: 1, resourceRequirements: {} },
      { rowId: 'a', value: 2, cost: 2, resourceRequirements: {} },
    ], constraint)).rejects.toThrow(/duplicate identities/i);
    await expect(optimizePortfolio('context', 'snapshot', [
      { rowId: 'a', value: Number.NaN, cost: 1, resourceRequirements: {} },
    ], constraint)).rejects.toThrow(/invalid numeric/i);
  });

  it('does not add feasible negative-value candidates in bounded greedy mode', async () => {
    const candidates: PortfolioCandidate[] = [
      ...Array.from({ length: 20 }, (_, index) => ({
        rowId: `positive-${String(index).padStart(2, '0')}`,
        value: 1,
        cost: 0,
        resourceRequirements: {},
      })),
      { rowId: 'negative', value: -100, cost: 0, resourceRequirements: {} },
    ];
    const result = await optimizePortfolio('context', 'snapshot', candidates, { budget: 0, resourceCapacities: {} });

    expect(result.method).toBe('BOUNDED_GREEDY');
    expect(result.globallyOptimal).toBe(false);
    expect(result.selectedRowIds).not.toContain('negative');
    expect(result.totalValue).toBe(20);
  });

  it('keeps bounded greedy results feasible, unique, deterministic, and internally consistent', async () => {
    const candidates: PortfolioCandidate[] = Array.from({ length: 25 }, (_, index) => ({
      rowId: `candidate-${String(index).padStart(2, '0')}`,
      value: 30 - index,
      cost: (index % 5) + 1,
      resourceRequirements: { crew: (index % 3) + 1 },
    }));
    const limits = { budget: 24, resourceCapacities: { crew: 18 } };
    const first = await optimizePortfolio('context', 'snapshot', candidates, limits);
    const second = await optimizePortfolio('context', 'snapshot', [...candidates].reverse(), limits);
    const selected = candidates.filter((candidate) => first.selectedRowIds.includes(candidate.rowId));

    expect(first.selectedRowIds).toEqual(second.selectedRowIds);
    expect(new Set(first.selectedRowIds).size).toBe(first.selectedRowIds.length);
    expect(first.totalCost).toBe(selected.reduce((sum, candidate) => sum + candidate.cost, 0));
    expect(first.totalValue).toBe(selected.reduce((sum, candidate) => sum + candidate.value, 0));
    expect(first.totalCost).toBeLessThanOrEqual(limits.budget);
    expect(first.resourceUse.crew).toBeLessThanOrEqual(limits.resourceCapacities.crew);
  });
});
