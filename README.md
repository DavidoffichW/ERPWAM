# ERPWAM

ERPWAM is a browser-based workbench for ordinary asset questions. What is
available? What is underused? How much history is missing? Which simple
forecast holds up when it is tested against data it has not seen?

**[Open ERPWAM](https://davidoffichw.github.io/ERPWAM/)**

The included Juniper Works dataset is fake on purpose. It gives you 18 assets
and 18 months of repeatable daily observations, so you can use the whole app
without uploading anything.

## What you can do

- Review capacity, utilization, availability, coverage, and output history.
- Filter assets by class and location, then move between charts and the asset
  table without losing your selection.
- Compare naive, seasonal naive, drift, and moving-mean forecasts with
  expanding-window backtests.
- Change one capacity assumption in a scenario without rewriting the observed
  history.
- Save a project in the browser or export an integrity-checked JSON copy.
- Reopen the cached app offline after its first successful load.

ERPWAM does not pick a model for you, forecast real operations, or turn a
scenario into a recommendation. The baseline methods are there to be inspected
and compared.

## Run it locally

You need Node.js 24.15 or later and npm 11 or later.

```bash
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://localhost:5173`, then choose
**Open example workspace**.

To check the production build locally:

```bash
npm run build
npm run preview
```

## Run the checks

```bash
npm run verify
npx playwright install chromium
npm run test:browser
```

`npm run verify` runs the linter, strict TypeScript checks, unit tests, and the
production build. The browser suite covers the main workflow, local storage,
portable exports, narrow layouts, the offline shell, and corrupted-state
handling.

## How the numbers behave

Ratios come from the underlying totals. Missing observations are not silently
turned into zeroes. Forecast backtests keep their training cutoffs in the past
and report MAE, RMSE, MASE when valid, bias, residuals, and excluded folds.
Empirical intervals summarize earlier held-out errors; they are not calibrated
probabilities.

The [analytical contract](docs/analytical-contract.md) and
[reproducibility notes](docs/reproducibility.md) contain the exact data,
aggregation, forecast, and scenario rules.

## Storage and compatibility

Projects live in this browser's IndexedDB. That is convenient, but it is not a
backup, so export any project you want to keep.

The analytical format introduced in v0.2.0 does not open planning projects from
[v0.1.0](https://github.com/DavidoffichW/ERPWAM/tree/v0.1.0). ERPWAM leaves that
older browser data alone rather than guessing how to convert it.

Built with TypeScript, React, Vite, ECharts, and IndexedDB. The project is
[MIT licensed](LICENSE), and dependency licenses are listed in
[third-party notices](THIRD_PARTY_NOTICES.md).
