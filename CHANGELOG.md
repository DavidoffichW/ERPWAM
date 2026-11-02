# Changelog

## 0.2.0 (2026-11-02)

- Replace the planning-specific product domain with asset and resource analytics.
- Add the deterministic Juniper Works corpus, statistical exploration, transparent forecast baselines, rolling-origin backtests, and isolated scenarios.
- Add versioned analytical project storage and integrity-checked portable exports in a new browser database namespace.
- Keep the prior planning application's storage and backup formats untouched; no automatic reinterpretation or migration is performed.
- Validate portable projects deeply before saving or opening them, including references, bounds, semantic layers, and source-content identity.
- Qualify forecast controls before iteration, record missing-target fold exclusions, and report sequential held-out interval coverage and width.
- Restrict the first hypothetical workflow to the capacity-multiplier assumption that the output baseline can represent correctly.

This is the next minor release after v0.1.0. The entries below preserve the
public application's historical and qualified-but-unreleased record; no
v0.1.1, v0.2.1, or v0.2.2 tag was published.

## 0.2.2 (Historical qualified interface label, not released)

- Replace the explanatory, panel-heavy interface with a compact task-oriented workspace.
- Make the planning grid, replacement candidates, portfolio results, and saved decisions the dominant content in each view.
- Move mappings, validation findings, Priority Lists, metric definitions, and technical evidence into contextual surfaces.
- Add accessible icon controls, contextual help, keyboard-safe dialogs and disclosures, responsive layouts, and transient routine feedback.
- Incorporate the qualified 0.1.1 reliability work listed below.

## 0.1.1 (Qualified, not released)

- Add independent domain, evidence, Excel, IndexedDB, browser, and offline qualification.
- Reject incomplete or duplicated ranking populations before producing recommendation evidence.
- Prevent the bounded portfolio heuristic from selecting non-positive-value work merely to fill capacity.
- Prefer the current online application shell while retaining a cached offline fallback.
- Gate the manual Pages deployment behind the same application checks used by CI.
- Document planning-data identity, advisory ranking, exact and approximate portfolio methods, browser persistence, and offline limits.

This qualification was not tagged or published as a standalone release. At
that point there were no 0.2.0 or 0.2.1 releases; the analytical v0.2.0 release
was created later from independent source.

## 0.1.0 (2026-10-27)

- Import, map, validate, edit, and export multi-sheet Excel planning workbooks.
- Preserve dynamic columns, source values, provenance, and externally edited scalar cells.
- Create or import immutable Priority List revisions without renumbering source priorities.
- Compare priority, weighted-reference, example-model, and manual replacement choices.
- Select incomplete or review-required records while retaining visible data-quality evidence.
- Record context-bound replacement decisions, scenarios, feedback, and outcomes.
- Build constrained work portfolios and review evidence-derived planning summaries.
- Store work locally, export backups, and support cached offline use after an initial hosted load.
- Provide compact dark and light workbench themes across desktop and mobile layouts.
