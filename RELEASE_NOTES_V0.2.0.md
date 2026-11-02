# ERPWAM v0.2.0

ERPWAM is now an asset and resource intelligence workspace. The built-in
Juniper Works project is reproducible: use it to explore asset history,
utilization, availability, distributions, transparent forecast
baselines, and an explicit capacity scenario without sending data to a server.

This release includes:

- linked Overview charts, filters, tables, and asset drill-downs;
- deterministic statistical summaries over versioned observations;
- naive, seasonal-naive, drift, and moving-mean forecasts;
- expanding-window backtests with leakage checks, excluded-fold reasons,
  MAE, RMSE, MASE, bias, residuals, and qualified empirical intervals;
- an isolated hypothetical capacity-multiplier scenario;
- a new browser-local project database and integrity-checked portable files;
- responsive light/dark presentation and cached offline reload; and
- Windows and Ubuntu CI with deterministic and real-browser tests.

## Compatibility

v0.2.0 replaces the planning-oriented v0.1.0 product. It intentionally does
not read or reinterpret historical planning projects or backup files. It uses
the separate `erpwam-analytics-v1` IndexedDB database and leaves the earlier
`erp-local-application` database untouched. The historical source remains
available from the v0.1.0 tag.

Forecast intervals are empirical held-out residual bands, not calibrated
probability guarantees. Scenarios are assumptions, not predictions or
operational recommendations.
