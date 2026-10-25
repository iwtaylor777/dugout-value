# Roster and minor-league opportunity test

Published October 21, 2026. This is a fixed, retrospective development experiment:
fit June 2024 outcomes, then evaluate the frozen models on June 2025. The player
lists differ in selection date, and both seasons were examined in earlier work.
It does not provide a new production projection system or untouched holdout.

## Offline reproduction

Unpack playing-time-opportunity-2026-10-21.tar.gz, enter its directory and run:

```sh
python3 -m pip install -r requirements.txt
python3 replay.py
```

The release used Python 3.13, NumPy 2.3.5 and SciPy 1.16.3. Replay verifies file
hashes, refits only the 584 training rows, reproduces all 612 evaluation forecasts,
and recalculates the scores and 5,000 paired bootstrap intervals. It needs no
network connection. Numeric comparisons allow 1e-8 floating-point tolerance.

The four forecasts are constant, MLB history only, MLB plus active-roster status,
and those three inputs plus current/prior AA and AAA PA. The last model has
seven inputs. Minor-league PA are transformed with log(1+PA); all feature scaling
uses training rows only. See PROTOCOL.md for the exact penalty and formulas.
No weights were tuned on 2025. Expected PA = probability of positive target PA ×
conditional PA per remaining game × remaining league-average team games.
This is the probability of any later MLB PA, not specifically a debut or promotion.

## Files

- inputs.json: normalized training and evaluation features, outcomes, IDs and
  fixed comparison forecasts. Prior-MLB groups mean PA in the preceding three
  seasons; the fitted MLB history input uses only the preceding full season.
- model.json: scaling values and fitted coefficients.
- predictions.json: every model probability, conditional workload and expected PA.
- results.json: overall/group errors, Brier scores, reliability bins and intervals.
- audits.json: cohort selection dates, cutoffs, coverage and schedule checks.
- sources.json: raw input request URLs and SHA-256 receipts.
- validated-aggregates.json, metadata-anomalies.json and feasibility.md: bounded
  primary-source validation, date checks and metadata corrections.
- timing-evidence/: compact official game-feed receipts and timing audit.
- source-checks/: selected provider responses used for the date/metadata checks.
- source-code/: fetch/normalization code for inspection. This full raw pipeline
  depends on the repository's two earlier projection studies and their raw files;
  use replay.py for the self-contained offline reproduction.

## Interpretation

Lower RMSE, MAE and Brier score are better. Bias is forecast minus actual.
Positive comparison gains favor the first named model. Brier is mean squared
probability error against an observed 0/1 event. Depth Charts supplies expected
PA, not an event probability, so no Depth Charts Brier score is invented.
Reliability-bin counts must accompany observed event fractions. Conditional
workload errors among actual positive players are secondary; primary workload
scores include all 77 zero outcomes.

Intervals resample evaluation players, holding the fitted 2024 model fixed.
They do not include training-year uncertainty. Archived Depth Charts loaded
before one final AAA game ended; ten evaluation hitters had 60 combined PA in
that game before our capture-time cutoff. The models may have that information
advantage. Raw retrospective queries can include later scoring corrections.
Zero recorded AA/AAA PA means no row in a complete, checked level leaderboard;
it does not mean no affiliated or foreign baseball experience.

The April 2024 list supplies the June 2024 training population. Players absent
from that April list cannot enter training even if promoted in May. The 2025
comparison uses the June list, so candidate-selection differences remain.
A later untouched forecast test is required before adopting these estimates.
