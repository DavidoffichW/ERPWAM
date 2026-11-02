# ERPWAM

A local-first workspace for asset performance, resource utilization, and capacity analysis. ERPWAM brings operating history, statistical summaries, baseline forecasting, and scenarios into one browser project.

**[Open ERPWAM](https://davidoffichw.github.io/ERPWAM/)**

## What it does

- **Overview** — capacity, utilization, availability, observation coverage, and linked charts and asset tables.
- **Assets** — asset details and historical output.
- **Analytics** — distributions and descriptive statistics.
- **Forecasts** — naive, seasonal naive, drift, and moving-mean baselines evaluated with expanding-window chronological backtests.
- **Scenarios** — compare a declared capacity multiplier against a forecast without changing the input observations.
- **Data** — inspect data quality and provenance, save locally, and export integrity-checked projects.

The included **Juniper Works** example contains 18 assets and 18 months of generated daily observations. A fixed seed makes it reproducible; it is not connected to live operations.

## Run locally

Requires Node.js 24.15 or later and npm 11 or later.

```bash
npm ci
npm run dev
```

Open the address printed by Vite (normally `http://localhost:5173`) and select **Open example workspace**. Existing analytical projects can be imported as JSON.

For a production preview:

```bash
npm run build
npm run preview
```

## Verify

```bash
npm run verify
npx playwright install chromium
npm run test:browser
```

The checks cover strict TypeScript, linting, numerical and domain tests, build integrity, browser interactions, persistence, responsive layouts, and offline shell reload.

## Method and limitations

Ratios are calculated from underlying totals; missing values are never silently treated as zero. Forecasts preserve chronological training cutoffs and report MAE, RMSE, MASE where valid, bias, residuals, and excluded folds. Empirical forecast intervals are not calibrated probabilities. Scenarios are hypothetical comparisons, not operational recommendations.

See the [analytical contract](docs/analytical-contract.md) and [reproducibility notes](docs/reproducibility.md) for methodology and data rules.

Projects are held in browser IndexedDB. Export is recommended for backups. The analytical format introduced in v0.2.0 does not open earlier planning files from [v0.1.0](https://github.com/DavidoffichW/ERPWAM/tree/v0.1.0); historical browser data is not overwritten or migrated.

Built with TypeScript, React, Vite, ECharts, and IndexedDB. [MIT licensed](LICENSE); dependency licenses are listed in [third-party notices](THIRD_PARTY_NOTICES.md).
