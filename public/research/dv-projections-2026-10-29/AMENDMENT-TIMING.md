# Forecast-origin correction — October 29, 2026

The original horizon backtest restricted player inputs to T-h but trained on outcomes through T-1. For h>1, those labels were unavailable at the forecast origin. The historical contract refit called the same routine. The old results are superseded, not a valid test of a forecast made at that date. The locked one-year v1 code and results are preserved unchanged.

Before the corrected replay, the following rules are fixed:

- All training outcomes, feature history, league anchors and aging-curve observations must be available by T-h. Keep the original feature recipes, 50/50 tree/ridge blend, hyperparameters, 70/30 horizon/aging blend and original 17 horizon comparisons. Do not retune on these results.
- If a horizon has no observable training outcomes, use the one-year forecast plus the historical aging curve; do not borrow later outcomes. 2020 remains excluded as a training outcome.
- Report horizon-only and 70/30-blend errors separately. The original horizon chart did not evaluate the final smoothing and workload stages, so it cannot validate the complete trade-value pipeline.
- Refit contract prices on 2023–26, the seasons with archived preseason ZiPS workloads. Rebuild the workload percentile mapping separately at each forecast date; do not apply the 2026 mapping to earlier signings. Drop 2021–22 from this refit because matching archived workloads are unavailable. The fixed role/age workload retention remains a site policy assumption.
- Price fits are descriptive retrospective checks, not forecasts of salaries at signing: preseason public projections may postdate a signing, and the model recipe was developed later. Keep that distinction in the article.
- These are corrected, reused retrospective samples. They are not a new holdout. Preserve earlier results in `superseded/` and label the correction visibly.
- Current WAR-rate forecasts need not change merely because the historical evaluation is corrected: their available outcomes already end in 2026. Rebuild the site output from the existing current forecast inputs and compare it byte-for-byte with the published JSON.

Local raw inputs and player-level outputs are not redistributed. Record input hashes, software versions and code hashes with aggregate results. The historical source files were downloaded retrospectively and may include provider revisions.
