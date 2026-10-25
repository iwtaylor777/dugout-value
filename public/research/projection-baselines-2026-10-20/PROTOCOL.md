# Multi-season projection baselines

Written October 20, 2026, before calculating these new comparisons. The five
forecast lists and target outcomes are the same as the October 19 benchmark.
These seasons have been examined before; this is development work, not a fresh
holdout. Preserve the earlier public release unchanged.

## Fixed comparisons

For hitter K% and BB%, and pitcher K-BB%, sum MLB event counts and opportunities
from the current season through the original conservative cutoff and the three
previous full seasons. Their respective weights are 1, 0.8, 0.6 and 0.4. Add
200 opportunities at the original source-window league rate. These weights and
prior size are fixed, not selected from the five target samples. Historical
seasons with no MLB work contribute zero. This is an MLB-only baseline without
age adjustment or minor-league translations; it is not Marcel. Exclude wOBA/FIP
from the new comparison because retrospectively revised seasonal constants can
introduce hindsight.

For workload use league-average team games completed through the cutoff:
`g = 2 * completed_MLB_games / 30`. Check regular-season game type, unique game
IDs, played-final status and suspended-game completion before the cutoff. Let `r` be
`162 - g`, subtracting games in an explicitly unscored gap that had already
started at capture. The June 23, 2025 gap includes games still in progress at
capture; none of their performance counts enter the baseline. Do not
use actual future game totals to define the remaining schedule.

Compare three workload baselines with the same archived forecast:

1. Original calendar pace, retained for continuity.
2. Games pace: `YTD_work * r / g`.
3. Multi-season workload: prior annual work `H = (3*last_year + 2*two_years_ago
   + three_years_ago) / 6`; blend annualized current work `YTD_work*162/g` with H
   using weight `g/(g+81)` on current work; multiply by `r/162`.

Missing seasons contribute zero and the denominator remains six. The 81-game
prior strength is fixed and unfitted. No active-roster multiplier is applied.
These baselines may be especially poor for newly promoted players without
MLB history; keep those players in the scores and show that group separately.

## Roster context

For the two Depth Charts hitter checkpoints, request all 30 MLB active rosters
as of the day before the forecast. Require team/date metadata, unique IDs and
plausible roster counts. Check historical date behavior against contemporaneous
MLB transaction announcements and independent game box scores. Retrospective
roster reconstructions are not immutable archives; disclose that distinction.

Classify a verified MLBAM identity as on the active roster or absent from the
30 active rosters. Absence does not distinguish injury, minor leagues, suspension
or free agency. An unresolved MLBAM identity is unknown, never inactive. Later
identity crosswalks may resolve identifiers only, not supply predictive fields.
Roster groups describe the errors; they are not fitted forecast adjustments.
If date behavior cannot be validated, publish the roster limitation and omit
the affected groups rather than infer historical status from current rosters.

Pre-scoring input correction: the May 31 Minnesota response contains Royce
Lewis twice with identical fields. Deduplicate an exact repeated roster row,
record both raw and unique counts, and still reject conflicting duplicates or
membership on multiple clubs. This affects membership bookkeeping, not forecasts.

## Scoring and checks

Keep the original resolved cohorts, including all zero-work target outcomes.
Report workload RMSE, MAE and signed bias with equal player weights. Only Depth
Charts workload is a primary playing-time forecast; basic ZiPS workload stays
a labeled diagnostic. Show active-roster groups, history/no-history groups and
counts of zero outcomes. Do not use target work to define an eligibility cutoff.

Rate errors use actual target PA/BF weights on identical players for every
method. Keep the original current-season prior baseline. Report the multi-season
baseline against both the original baseline and archived forecast. Resample
players in paired draws within each checkpoint, 5,000 seeded bootstrap draws,
recomputing weighted metrics. Intervals describe the samples, not generalization
to new seasons. Do not pool different dates or choose a winning specification
from these outcomes. Prior-season event totals downloaded now can reflect later
official scoring corrections.

## Decision

This pass strengthens the evidence used to judge possible future models. It
does not alter trade valuations. A model promoted later needs dated forecasts,
a complete identity map, stronger comparison systems and an untouched target
season. Roster splits can identify a tractable next problem; they cannot by
themselves show that a roster adjustment will improve forecasts.

## Validation record

The completed roster checks cover selected Boston transactions and Soto’s club
assignment with the Yankees and Mets. Official MLB game evidence supports the
latter check: an April 9 highlight and May 31 lineup/scoreboard records. This
is narrower than the planned box-score validation and does not independently
verify all 30 active rosters. See roster-validation.json for the exact evidence.
