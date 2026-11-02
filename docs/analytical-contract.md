# Analytical contract

Every result identifies its dataset revision, input population, period, units,
method/version, parameters, missing-data policy, and sample count.

Ratios are recalculated from their numerator and denominator. Percentages are
not blindly averaged. Unit conversion is limited to the reviewed registry, and
incompatible dimensions fail explicitly.

Forecast evaluation uses expanding chronological origins. Each model fit sees
only its training prefix. Missing observations are rejected or interpolated
only under the declared short-interior-gap policy inside that prefix.

The application can sort evidence but does not choose an operational action or
declare one baseline universally best.
