# Analytical contract

Every result identifies its dataset revision, input population, period, units,
method/version, parameters, missing-data policy, and sample count.

Ratios are recalculated from their numerator and denominator. Percentages are
not blindly averaged. Unit conversion is limited to the reviewed registry, and
incompatible dimensions fail explicitly.

Forecast evaluation uses expanding chronological origins. Each model fit sees
only its training prefix. Missing observations are rejected or interpolated
only under the declared short-interior-gap policy inside that prefix.
Folds with missing target values are excluded as a unit and retain a reason.
Empirical interval coverage and width use only residuals from earlier forecast
origins; the resulting bands are evidence summaries, not calibrated
probability guarantees.

The first scenario applies one declared, dimensionless capacity multiplier to
a fixed output-forecast baseline. Utilization-cap and demand scenarios are not
implemented because the current forecast does not carry the denominators or a
demand baseline required to calculate them honestly.

The application can sort evidence but does not choose an operational action or
declare one baseline universally best.
