# ERPWAM

ERPWAM is a local asset and resource intelligence workspace. It turns a
versioned observation set into traceable utilization, availability, capacity,
distribution, forecast, and scenario views—all in the browser.

The included Juniper Works project is fictional. Its 18 assets and 18 months
of daily observations are generated from a fixed seed, so the examples and
tests can reproduce the same evidence without using operational data.

## What works

- An Overview dashboard with linked filters, charts, and an asset table.
- Asset history and data-coverage inspection.
- Deterministic statistical summaries and distributions.
- Naive, seasonal-naive, drift, and moving-mean forecast baselines.
- Expanding-window backtests with MAE, RMSE, MASE, bias, and residuals by
  horizon.
- A bounded hypothetical scenario that stays separate from observations and
  forecasts.
- Browser-local save, reopen, deletion, and integrity-checked project files.
- Offline reload after the application shell has been cached.

ERPWAM does not make operational decisions. Forecast intervals are empirical
held-out residual ranges, not guaranteed probabilities, and scenarios are
explicit assumptions rather than predictions.

## Run it

You need Node.js 24 or another compatible current Node.js release.

```powershell
npm ci
npm run dev
```

Open <http://127.0.0.1:5173> and choose **Explore fictional dataset**.

For a production build:

```powershell
npm run build
npm run preview
```

The preview server listens on <http://127.0.0.1:4173> by default.

## Verify it

```powershell
npm run verify
npx playwright install chromium
npm run test:browser
```

`verify` runs strict TypeScript checking, Oxlint, deterministic unit tests, and
the production build. Playwright exercises the full browser workflow,
persistence, responsive layout, linked keyboard selection, and offline shell.

## Data semantics

ERPWAM keeps four numerical layers distinct:

- `OBSERVED` — admitted historical observations.
- `DERIVED` — reproducible calculations over identified inputs.
- `FORECAST` — statistical estimates beyond a declared cutoff.
- `SCENARIO` — hypothetical transformations of a fixed baseline.

Missing, invalid, duplicate, conflicting, excluded, and measured-zero values
also remain separate. See [the analytical contract](docs/analytical-contract.md)
and [reproducibility notes](docs/reproducibility.md) for the exact boundaries.

## Local storage

Projects use the new `erpwam-analytics-v1` IndexedDB namespace. Historical
ERPWAM planning databases and files are neither read nor migrated. Browser
storage is convenient local persistence, not a guaranteed backup; export
important work from the Data workspace.

## Version and compatibility

The analytical application uses a separate `erpwam-analytics-v1` IndexedDB
database and versioned portable format. It leaves browser data created by the
earlier planning application untouched and will not reinterpret planning
backups as analytical projects. Any migration format would require a separate,
explicit conversion tool.

Version 0.2.0 is a deliberate pre-1.0 product change from the planning-oriented
v0.1.0 release. The historical source and release remain available at the
[`v0.1.0` tag](https://github.com/DavidoffichW/ERPWAM/tree/v0.1.0). The new
application does not delete the earlier `erp-local-application` browser
database, but it cannot open that data.

ERPWAM is licensed under the [MIT License](LICENSE). Third-party dependency
licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
