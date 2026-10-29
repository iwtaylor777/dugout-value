# Do projections measure value? Validation protocol

Written October 27, 2026, before any of these tests was scored. The hash and time of this file are in `LOCK-VALIDATION.json`. The projection model under test is Dugout Value projections v1, locked in `LOCK-MODEL-v1.json` and not changed for this study. Later models are run through the same tests unchanged.

## Question

Projecting a player's own future WAR or wOBA is partly circular: a system can be good at predicting a statistic without that statistic capturing what wins games. These tests ask whether each system's preseason projections, applied to the players who actually played, explain team runs, team wins and free-agent pay.

## Systems compared

- **Dugout Value v1.** Each season T is fit only on seasons before T.
- **ZiPS** and **Steamer** preseason projections, from the archived captures listed in `archive/manifest.json`.
- **Two baselines:**
  - **Last season:** each player's actual rate in T−1.
  - **Marcel:** 5/4/3 weights, regressed to league.

## Data

- **Team playing time.** Each player's plate appearances and innings by team, from MLB statsapi team-season splits for 2023–26. Traded players count for each team by their own playing time.
- **Team outcomes.** Wins, runs scored and runs allowed, from MLB statsapi standings.
- **Free-agent contracts.** The FanGraphs free-agent tracker for 2023–26.
- **Matching.** Players are matched by MLBAM ID to FanGraphs IDs.

## Common fallback

Any player who is not projected by every compared system gets the same fallback value in all of them, so the comparison turns only on players every system projected:

| Group | Rate stat | WAR rate |
|---|---|---|
| Hitters | league wOBA − .030 | 0 per 600 PA |
| Pitchers | league FIP + 0.75 | 0 per 180 IP |

The same rule applies to the baselines.

## Tests

### W: team wins (primary)

For each team-season, projected WAR is the sum of each player's projected WAR rate times his actual plate appearances (÷600) or innings (÷180). Three measures are reported:

1. The Pearson correlation between projected team WAR and actual wins.
2. The RMSE of wins after a linear fit, estimated with leave-one-season-out cross-validation.
3. The raw RMSE with projected wins set to 47.7 + projected WAR.

### R: runs scored

The team's projected wOBA, PA-weighted over the players who actually batted, is compared with actual runs per plate appearance. Reported as the correlation and the leave-one-season-out RMSE.

### A: runs allowed

The team's projected FIP, IP-weighted over the pitchers who actually pitched, is compared with actual runs allowed per 9 innings.

### P: pay

For free agents who signed a guaranteed MLB contract of at least $2M AAV before season T, regress log AAV on each system's projected WAR for T. Report the R² and the correlation. The test uses only players projected by every system.

## Seasons and comparisons

- **Primary pooled sample: 2024–26.** This is 90 team-seasons with all three systems.
- **2023:** ZiPS only for pitchers, so 2023 is reported separately for the tests that need pitchers.
- **Uncertainty:** each difference in correlation or RMSE gets a paired bootstrap 95% interval over team-seasons (players for test P), with 2,000 resamples and seed 20261027.

## Interpretation

A system "measures value at least as well" as another on a test if its point estimate is better and the interval of the difference does not exclude a loss. "Better" requires the interval to exclude zero. The write-up reports every test, including losses.
