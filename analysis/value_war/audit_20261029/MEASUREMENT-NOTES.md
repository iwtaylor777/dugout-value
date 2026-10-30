# Measurement notes before candidate scoring

- The source code matches every available v1 lock hash, including the explicitly recorded post-lock secondary-test changes.
- Independent recovered data use OAK through 2024 and ATH in 2025–26. The evaluator maps both names to one franchise before merging teams or differencing years. Without this, the Athletics can disappear or be treated as a different team. This is an audit implementation fix, not an edit to locked source.
- The original event code uses full-season event run weights and full-season sprint speed before splitting games. The added prior-speed batting check removes same-season speed as an explanation for the batting gain; it does not claim every upstream input is point in time.
- Pitch-derived final game scores nearly reproduce official season runs (0–2 missing runs per team in the checked seasons). Official season RS/RA and wins remain the season-level targets. Final game scores, rather than sums of completed PA scoring events, are the half-season targets.
- Five credit-accounting tests passed on the reconstructed 2024 season before evaluating candidate scores.
- Before scoring, added a roster-change diagnostic that predicts next-season RD while controlling prior-season actual RD, with calibration leaving one target season out. Subtracting prior measured credit from a predictor and prior actual results from the outcome can otherwise create shared-baseline dependence. This is an explanatory sensitivity, not an additional candidate selected for success.

## After the first season-level results

The fixed contact blend improved raw next-year batting RMSE, including movers. This could partly be ordinary regression toward average. Added a post-result falsification: fit an intercept and slope on raw batting results using only the four original development pairs, then compare it with a two-input regression on raw and contact value, also fit only on development. Report the fixed 50/50 blend too, including cases where it loses to the calibrated baseline. This is explicitly a later exploratory diagnostic, not a prespecified claim or a new 2027 specification.
