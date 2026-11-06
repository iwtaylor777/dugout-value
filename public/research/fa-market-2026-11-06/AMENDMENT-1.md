# Post-result term/annual-salary representation — November 6, 2026

The original log-total/log-duration ridge candidate improves broad total log error by 20.3% versus the legacy proxy reference, but has substantial underprediction among nine-figure outcomes (25 cases), and its >=$10M performance is essentially neutral. The broad gate alone is insufficient for a top-free-agent market model. Preserve all original results.

Before further scoring, fix two additional representations, using the same rows and rolling splits:

1. **AAV times duration:** same standardized ridge alpha=10 features, predicting log annual salary and untransformed contract years separately. Continuous duration is clamped 1–12; guaranteed total is geometric-mean AAV times continuous duration, independent of rounding the displayed term. This is a point forecast, not the conditional mean of guarantees or duration.
2. **Age/value interactions:** the preceding representation plus three fixed features, one per role: (30 minus age) times prior weighted WAR rate. This addresses the different contract-length return to value for younger versus older players, without player-specific overrides.

Report both candidates, including failed cohorts. Add an origin-defined high-value group (prior regressed proxy >=2 WAR or latest annualized WAR >=3), distinct from outcome-selected large contracts. Deployment requires the original broad/time gates and compatible high-value behavior; do not promote a broad gain while ignoring substantial harm to top free agents. Further gains are exploratory on the same examined years.

Exponentiating fitted log-duration gives a typical duration on the log scale, not an arithmetic conditional expectation. The original `expectedYears` field is retained for audit compatibility and must not be described as a calibrated expected number of years. New candidates use `durationYears`.
