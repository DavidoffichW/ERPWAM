# Reproducibility

The Juniper Works generator uses seed `4271903`, generator version `1`, UTC
daily timestamps, fixed synthetic asset definitions, and explicit equations.
Repeated generation produces the same canonical SHA-256 dataset identity.

Portable projects use schema `erpwam.analytics.portable/1`. The payload is
canonicalized and verified with SHA-256 before import. Unknown, historical,
oversized, malformed, and corrupted project files fail closed. After envelope
verification, bounded domain validation checks references, finite values,
semantic layers, units, source-content identity, and calculation contracts.

Charts are projections over framework-independent calculations. The unit test
suite provides hand-verifiable references for quantiles, sample standard
deviation, unit conversion, forecast methods, error metrics, temporal leakage,
and scenario isolation.
