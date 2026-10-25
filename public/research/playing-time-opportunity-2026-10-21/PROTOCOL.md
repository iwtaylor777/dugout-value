# Dated opportunity features — development test

Specified October 21, 2026, before fitting these models or calculating their
scores. Both 2024 and 2025 outcomes have been examined in earlier research;
this is retrospective development, not a fresh holdout.

## Population and time

Train on the 584 resolved hitters in the archived April 10, 2024 Depth Charts
list, with features through May 31 and MLB target PA from June 1–September 30.
The April list is legitimately available before this target but may omit May
arrivals. Evaluate on all 612 resolved June 1, 2025 Depth Charts hitters, using
features through May 31 and target PA June 1–September 28. Never filter on later
PA. Preserve the earlier exclusions and explain the April-vs-June candidate
list difference. No 2025 fitting, scaling, model selection or weight tuning.

Use existing verified MLBAM/FanGraphs identities, never names. Reconstruct 30
MLB active rosters at May 31 for each year; membership absent from those lists
means only not active, not minor-league assignment. Unknown identity is not a
zero-work observation. Fail incomplete downloads or missing expected IDs.

Minor-league features use Double-A and Triple-A regular-season PA only, for the
current season before the cutoff and previous full season. Do not use current
team, current age, full current-season totals, current prospect grades or later
transactions as historical predictors. Validate aggregate date-range behavior
against dated player game logs. Inspect schedules for games suspended across
the feature cutoff before accepting the totals. If necessary, use an explicitly
earlier common minor-league cutoff, fixed before fitting, rather than ingesting
future completion statistics. Document all such adjustments before scoring.
A complete, validated level leaderboard can establish zero recorded PA at that
level; it cannot establish no affiliated/foreign baseball experience.

## Fixed models

Predict two quantities: probability of any target MLB PA, and mean target PA per
remaining league-average team game conditional on positive PA. Expected PA is
their product times remaining games, r=162-2*completed MLB games/30.

Three nested feature sets, all specified before fitting:
1. MLB only: current PA / elapsed league-average team games; previous full
   season MLB PA / 162.
2. Roster: the two MLB features plus dated active-roster membership.
3. Roster + minors: those three plus log(1+PA) for current AAA, current AA,
   previous-season AAA and previous-season AA (seven features total).

Standardize each feature using only all 2024 training rows, recording means and
standard deviations. Zero variance features get scale one. Logistic regression
minimizes mean binary cross-entropy plus 0.01/2 times the sum of squared slopes;
intercept unpenalized. Conditional ridge regression on positive-outcome training
rows minimizes mean squared error plus 0.01 times the sum of squared slopes;
intercept unpenalized. Clip negative conditional workload to zero. No upper cap,
interaction search, tuning, age adjustment or performance-rate predictors.
A constant probability equals the 2024 training positive-outcome share; its
conditional workload equals the training positive-outcome mean PA/r.

## Score

On 2025 only, compare expected PA with archived Depth Charts and existing
calendar, games and multi-season baselines: equal-player RMSE, MAE, signed bias.
Probability uses Brier score, log loss (clip to [1e-6,1-1e-6] for scoring only),
mean predicted/observed probability, and fixed-width reliability bins. The
archived Depth Charts PA column does not supply a probability forecast; do not
invent one. Conditional workload error among positive-outcome players is
secondary. Report groups: active/not-active, no/prior MLB PA in preceding three
seasons, and no/current MLB PA. Include counts, zero outcomes and group bias.

Use 5,000 paired player resamples with seed 20261021 for expected-PA RMSE
reductions and Brier differences. Positive gains favor the first method.
Compare each nested addition with its immediate predecessor; compare full
model with Depth Charts and historical blend. Intervals condition on the fitted
2024 model and capture player-sample uncertainty, not training-year uncertainty.
No claims of superiority or promotion from this single development season.

## Deliverable

Publish the complete result, including losses, with normalized source features,
coefficients, training/evaluation rows, source receipts and offline fit/score
replay. Keep existing released bundles unchanged. A later untouched, dated
forecast is necessary before any trade-model adoption.

## Post-fit validation record

The first fixed fit was calculated before the independent timing review finished.
No features, tuning parameters, coefficients or predictions were changed after
seeing its scores. Added hard cohort-count and schedule-query assertions, and
expanded the prescribed subgroup output to include RMSE and probability scores.

Decision times are June 1, 2024 at 12:00 UTC (constructed training snapshot),
and the June 1, 2025 archive capture at 11:32:24 UTC. Official game feeds show
all recorded May 31 plays in MLB/AA/AAA ended before these times. This does not
prove when provider leaderboards finished updating. The archived Depth Charts
projection loaded at 05:15:51 UTC in 2025; one AAA game ended at 05:40:11, after
that load and before capture. Ten evaluation hitters had 60 combined PA in that
game. Consequently this is not an exact common-information-set comparison to
Depth Charts. All model variants retain their fixed capture-date information.

The 2024 AA global response mislabels Esteban Mejia's three AA PA as sport14
while naming Frisco. Individual AA game/season records and the dated team list
verify the AA assignment. An explicit audited correction accepts that row;
it is outside both fixed cohorts and changes no forecast. Two other rows have
incorrect league labels but correct sport/counts; league labels are not features.
See metadata-anomalies.json. Raw provider responses remain unchanged.
