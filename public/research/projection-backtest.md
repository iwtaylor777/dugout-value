# In-season projection backtest

Last run: July 21, 2026

## Decision

Dugout Value does **not** use the ridge challenger in production. The model was
promising for predicting the remainder of the same season, but it did not clear
the pre-set uncertainty gate and it performed worse than published future ZiPS
on the following-season holdout.

The production model keeps published ZiPS as the anchor. The transparent
in-season bridge carries 50% of the change from preseason ZiPS to current ZiPS
RoS. For hitters, a role guard now dampens a contradictory defense/position
signal when it is larger than the offensive signal. This is a conservative
shrinkage choice, not a claim that 50% is the statistically proven optimum.

The previous production version averaged ZiPS and Steamer changes. That blend
has been removed from the future-year adjustment because the historical test
validates a ZiPS-to-ZiPS change, while the available archived Steamer pages do
not support the same leakage-safe following-season test. Steamer remains part
of FanGraphs Depth Charts for the current rest-of-season forecast.

## What production actually uses

- The current season uses FanGraphs Depth Charts rest-of-season fWAR. Depth
  Charts blends ZiPS and Steamer talent with FanGraphs playing-time estimates.
- The next two seasons begin with published future ZiPS.
- A player's ZiPS rest-of-season rate is compared with preseason ZiPS at a
  common workload: 600 PA, 180 starter innings, or 65 relief innings.
- If ZiPS changes a pitcher from a starting role to a relief role or vice
  versa, no custom adjustment is made. The published future ZiPS row remains
  the forecast because WAR per inning is not directly portable across roles.
- For hitters, the total WAR-rate change is separated into offense and
  non-offense. When those pieces have opposite signs and the non-offensive
  change is larger, the non-offensive piece gets half weight. This is designed
  to keep a new defensive or positional-role assumption from overwhelming an
  improving or declining offensive projection.
- Half of the resulting ZiPS change is carried into the next season. The
  retained signal decays by another 15% in each later season.

This means the site is not simply adding season-to-date WAR to an old forecast,
and it is not replacing ZiPS with an internal black box.

## Challenger design

The ridge model was anchored to ZiPS. It predicted only a correction using age,
sample size, and season-to-date differences in WAR rate, wRC+, walks,
strikeouts, ISO, BABIP, OBP, SLG, xwOBA, barrels, and hard-hit rate. This makes
the comparison harder to game: ridge cannot win merely by rebuilding a generic
projection and regressing every player toward the league mean.

Training and testing were separated by time. Tuning used 2023 and 2024 only;
the 2025 checkpoints were untouched until the final test. Error was weighted by
future playing time, and uncertainty was bootstrapped by player so that the same
player appearing at two checkpoints did not count as two independent people.

The production gate required all of the following:

1. At least a 2% out-of-time RMSE improvement.
2. An MAE improvement as well as an RMSE improvement.
3. Improvement at both 2025 checkpoints.
4. A player-clustered 95% interval that excluded no improvement.

## Results

### Rest of the same season

The historical sample used archived hitter RoS ZiPS snapshots from July 2023,
May and August 2024, and June and July 2025. After minimum playing-time filters,
the 2025 holdout contained 673 player-checkpoints.

| Test | ZiPS RMSE | Ridge RMSE | Ridge change |
| --- | ---: | ---: | ---: |
| All 2025 holdout observations | 2.154 fWAR/600 | 2.058 | 4.42% better |
| June 30 checkpoint | 2.034 | 1.931 | 5.07% better |
| July 31 checkpoint | 2.311 | 2.225 | 3.73% better |
| Age 25 or younger | 2.353 | 2.311 | 1.79% better |

The pooled player-clustered 95% interval ran from **0.22% worse to 8.79%
better**. Simpler, more stable feature sets improved RMSE by only 0.4% to 0.8%,
and the full model sometimes proposed corrections larger than three fWAR per
600 PA. The same-season production gate therefore failed.

### Following season

This is the test that most closely matches the trade tool's 2027 and 2028 use
case. The challenger was trained on the 2023 checkpoint and 2024 outcomes, then
tested using two 2024 checkpoints and the complete 2025 season. The holdout
contained 504 player-checkpoints.

| Model | RMSE change vs. future ZiPS | MAE change vs. future ZiPS |
| --- | ---: | ---: |
| 85% ZiPS signal carry | 0.30% worse | 0.34% worse |
| 50% total ZiPS signal carry | 1.34% better | 1.69% better |
| 50% role-aware ZiPS carry | 1.41% better | 1.82% better |
| Ridge correction | 3.32% worse | 6.31% worse |

The role-aware carry's player-clustered 95% interval ranged from about **0.8%
worse to 3.6% better**. Its advantage over the unguarded 50% carry was also not
statistically decisive. In the 109-player subgroup where offense and
non-offense disagreed and non-offense was larger, however, the guard improved
both RMSE and MAE while the unguarded version made MAE slightly worse. That is
the exact failure mode the rule is intended to address.

A second challenger used season-to-date WAR as a directional veto. It improved
pooled RMSE by another tenth of a percentage point but reduced the MAE gain and
did not improve both checkpoints. It was not deployed. Current ZiPS already
incorporates the season's underlying performance; adding raw WAR would give a
noisy accounting statistic a second vote.

## Limits and next test

- This audit covers hitters. Comparable archived pitcher snapshots were not
  complete enough for the same leakage-safe design.
- The following-season test has only one fully independent target season
  (2025). That is not enough to lock a custom model into production.
- Some archived Steamer pages were truncated by the archive. This is why the
  production future-year adjustment now uses only the tested ZiPS-to-ZiPS
  signal instead of an unvalidated equal-weight Steamer overlay.
- Requiring 100 PA in the target season evaluates rate accuracy among players
  who actually played; it does not test injury or roster-survival probability.

The next version should save scheduled point-in-time ZiPS, Steamer, Depth
Charts, roster, and injury snapshots prospectively. After the 2026 and 2027
seasons, the same locked script can test hitters and pitchers across multiple
independent target years before a ridge model is reconsidered.

## Reproduce the audit

The full download, matching, training, robustness checks, and bootstrap live in
`scripts/backtest-in-season-projection.py`. It uses archived official FanGraphs
projection pages and FanGraphs custom-date leaderboards, caching downloads in a
temporary directory.

Primary methodology references:

- [FanGraphs Depth Charts introduction](https://blogs.fangraphs.com/introducing-fangraphs-depth-charts-and-standings/)
- [FanGraphs projection-system overview](https://library.fangraphs.com/principles/projections/)
- [FanGraphs 2026 projection availability and daily updates](https://blogs.fangraphs.com/all-the-2026-projections-are-in/)
