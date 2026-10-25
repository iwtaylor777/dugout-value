# Projection rates and playing time

Specification written October 19, 2026, before this benchmark's scores were
calculated. These are retrospective development samples. The 2024 and 2025
seasons have already been examined in other Dugout Value studies; this document
does not turn them into an untouched test.

## Questions

1. How well did the archived rate estimates predict later performance compared
   with a simple estimate based on that season's results?
2. How well did archived Depth Charts plate appearances predict later MLB
   playing time, including players who received none?

Basic ZiPS (`rzips`) and Depth Charts (`rfangraphsdc`) are different products.
Only Depth Charts enters the primary playing-time comparison. The basic ZiPS
workload column is retained as a diagnostic, not graded as a roster forecast.
Different capture dates are separate samples, never a head-to-head system ranking.

## Archives and windows

Use complete embedded projection lists, preserving their original IDs,
from these exact Internet Archive captures:

| Product | Players | Capture UTC | Outcomes begin |
| --- | --- | --- | --- |
| ZiPS RoS | Pitchers | 2024-06-21 17:38:41 | 2024-06-21 |
| ZiPS RoS | Pitchers | 2025-06-24 04:25:35 | 2025-06-24 |
| ZiPS RoS | Hitters | 2025-07-31 08:37:05 | 2025-07-31 |
| Depth Charts RoS | Hitters | 2024-04-10 08:29:20 | 2024-04-10 |
| Depth Charts RoS | Hitters | 2025-06-01 11:32:24 | 2025-06-01 |

Check captures against the first game of the target window. Reject silent
Wayback redirects to other dates. Check the embedded season and product when
available. No parsing of a truncated JSON payload or extrapolation from the
visible first page. Record raw checksums and URLs. A structurally complete list
is not proof that its publisher projected every MLB player.

Pre-scoring amendment, October 19: replace the initially proposed August 25,
2024 ZiPS hitter capture and July 18, 2024 Depth Charts hitter capture with
May 15 and April 10, respectively. MLB's schedule identifies the June 26
Toronto–Boston game as resumed August 26. Retrospective date-filtered statistics
can attribute those later events to June 26. The replacement source windows end
before either portion of that game, and their outcome windows include both.
The scorer rejects a resumed game that crosses a forecast boundary.

The replacement May 15, 2024 ZiPS hitter capture also failed the timing check:
that day's first game started before the page was captured. It is excluded
entirely. The final benchmark has five checkpoints, including two Depth Charts
hitter samples but only one basic ZiPS hitter sample. These decisions preceded
score calculation and are based on source integrity, not forecast performance.

The June 24, 2025 pitcher capture was at 00:25 Eastern, before late June 23
games had finished. Its simple baselines therefore stop at June 22; June 23
is an unscored gap and outcomes begin June 24. The archived ZiPS rates can
have more recent information than that conservative baseline. Other captures
were well after the preceding day's games and before their target games.

Regular-season windows include the overseas openers (March 20, 2024; March 18,
2025) and run through September 30, 2024 and September 28, 2025. Baselines use
statistics only through the day before the outcome window. Historical source
statistics downloaded now may contain later scoring corrections. Record that
limitation; do not describe these baselines as forecasts actually published then.

## Cohorts and missing outcomes

The forecast roster is fixed before examining outcomes. No minimum future
playing-time requirement applies to workload scoring. Keep zero-work forecasts
too. Scored rows require unique, verified numeric FanGraphs or MLBAM identities
and complete outcome responses
(`totalCount` equals row count, no duplicate IDs, requested date range matches).
An absent ID then means zero MLB work in the requested interval, conditional on
stable source IDs. Do not impute a performance rate for a player with zero work.
Report missing/invalid IDs, zero work, unforecast players and their workload,
and coverage. Reject duplicate rows rather than choosing the best-looking match.

Implementation review, after the first scoring pass: some archived forecasts
use prospect IDs. Resolve these with the archive's own MLBAM field or FanGraphs'
provider crosswalk saved October 18, 2026. The later crosswalk supplies identity
only; no later statistics, injury reports or roster status enter a forecast.
Publish unresolved identities separately instead of treating them as zero work.
The final April 2024 Depth Charts cohort excludes 16 of 600 forecasts, totaling
554 projected PA. All 612 June 2025 Depth Charts identities are resolved.

## Comparators

- Archived rates, using the supplied rate columns rather than rounded count
  ratios. Primary hitter endpoint: K%. Primary pitcher endpoint: K-BB%, with
  all walks in both projection and outcome. Secondary endpoints: hitter BB%
  and wOBA, pitcher FIP.
- Fixed-prior baseline: `(source_work * source_rate + 200 * league_rate) /
  (source_work + 200)`. League rates use the complete source window only.
  Work is PA for hitters and BF for pitchers. For wOBA and FIP this is a
  weighted-rate heuristic, not an exact event-count estimator. Two hundred
  opportunities is an illustrative fixed choice, not fitted to these outcomes.
- Unregressed year-to-date rate, evaluated only on the common subset with
  positive source work. The prior baseline remains defined for MLB newcomers.
- Naive workload pace: source PA (or BF) times remaining calendar days divided
  by elapsed calendar days since the season's first game. This ignores roster
  status, injuries, team schedules and the long gap after overseas openers.
  It is a sanity check, not a competitive playing-time model.

## Scores

Report each checkpoint separately. Primary rate scores: actual-opportunity-
weighted RMSE, MAE and signed forecast-minus-outcome bias among all players
with positive target work and finite endpoint values. Also show unweighted
scores and a sensitivity restricted to at least 100 PA or 75 BF. Report endpoint
exclusions. No pooling across repeated players or different horizons.

Workload scores: equal-player RMSE, MAE, bias, totals, zero-work share, and
forecast-volume groups fixed at 0, (0, 50], (50, 150], (150, 300], and over 300
opportunities. Report weighted rate bias separately from workload bias.

Compare paired errors with 5,000 seeded player bootstrap resamples within each
checkpoint. Recompute opportunity-weighted scores in every draw. Intervals are
descriptive 95% percentile intervals conditional on these seasons and lists;
they do not quantify year-to-year generalization. Multiple secondary endpoints
are descriptive, with no multiple-testing claim.

Post-scoring methods review: wOBA weights and FIP constants can be recalculated
for a whole season. Those secondary historical source values may therefore
contain hindsight. Keep them exploratory; the primary K% and K-BB% endpoints
use event counts and avoid that issue. Pitchers with no recorded outs have no
defined FIP and are excluded only from that secondary endpoint.

## Decision

This pass does not change the trade model or establish a new metric. Any new
rate or playing-time model must beat a stronger dated comparator and a fixed
simple baseline on later seasons. The next prospective test must save forecasts,
complete rosters, source timestamps, model specification and scoring rules before
its target games begin. A 2027 preseason evaluation is distinct from in-season
updates. Probability forecasts will need coverage and proper distribution scores;
point forecasts here cannot validate uncertainty bands.

Sources: [FanGraphs on its 2026 projection products](https://blogs.fangraphs.com/all-the-2026-projections-are-in/),
[Dan Szymborski on ZiPS](https://blogs.fangraphs.com/here-come-the-2024-zips-projections/),
and [Tom Tango's Marcel baseline](https://tangotiger.net/marcel/).
The baseline in this study is not Marcel.
