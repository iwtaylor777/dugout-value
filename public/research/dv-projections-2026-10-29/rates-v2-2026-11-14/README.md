# Hitter K% and BB%: beta-binomial blend (November 14, 2026)

This is a candidate for Dugout Value projections v2. Each hitter's projected K% and BB% averages two things, half each:
- the locked v1 rate model
- a beta-binomial projection, which starts every hitter from a fitted number of league-average plate appearances and adds his last five seasons, discounting each older season by a fitted factor.

The 2027 projections are frozen, and the test is registered in advance.

## Files
- **`PROTOCOL.md`** registers the 2027 test: what is compared, which players are scored, the metric and the decision rule. `PROTOCOL.sha256` holds its hash and the time it was written.
- **`predictions_2027.json`** holds the frozen 2027 K% and BB% for 905 hitters, under v1, the beta-binomial and the blend. `params_2027.json` holds the fitted parameters.
- **`LOCK-2027.json`** holds the hashes of those files, the protocol, the backtest results and the code, plus the hashes of every raw input file.
- **`results.json`** holds the walk-forward backtest (aggregates only).
- **`code/`**:
  - `eb_rates.py` is the model.
  - `backtest_rates.py` is the backtest.
  - `project_2027.py` builds the 2027 projections.
  - `test_rates.py` holds the unit tests and checks the hashes.

## The model
For a rate with successes s and trials n, the projection entering season t is the league rate plus:

    Σ δ^(lag−1) · (s − n · league rate) / (Σ δ^(lag−1) · n + k),   lags 1–5

k is the number of league-average trials each estimate starts from, and δ is the weight lost per season back. Both are fit separately for each rate by PA-weighted squared error of the next-season rate. In a Peter Fader-style model, k is the concentration of a Beta prior on true talent.

| Rate | k (PA) | δ | Single-season beta-binomial k |
|---|---|---|---|
| K% | 65 | 0.49 | 38 |
| BB% (including IBB) | 179 | 0.62 | 97 |
| HR per ball in play | 101 | 0.68 | 72 |
| BABIP | 603 | 0.81 | 392 |

These parameters were fit on target seasons 2011–17. The 2027 projections refit them on 2011–26, which gives K% k = 69, δ = 0.50 and BB% k = 173, δ = 0.65.

## Backtest
- **Setup.** Target seasons 2018–19 and 2021–26, each fit only on earlier seasons.
- **Production recipe.** LightGBM and ridge on the v2 hitter features, with each rate measured relative to the league.
- **Scored.** Hitters with 100+ PA in the prior three seasons and 200+ PA in the target season: 2,510 hitter-seasons.
- **Metric.** PA-weighted RMSE.

| Rate | DV v1 | Beta-binomial alone | Blend | Change | 95% interval | Seasons better | 2018–22 | 2023–26 |
|---|---|---|---|---|---|---|---|---|
| K% | .0337 | .0335 | .0329 | −2.5% | [−.0011, −.0006] | 8/8 | −3.4% | −1.6% |
| BB% | .0203 | .0203 | .0199 | −2.3% | [−.0006, −.0003] | 7/8 | −3.7% | −0.6% |
| HR per ball in play | .0185 | .0189 | .0183 | −1.4% | [−.0004, −.0001] | 5/8 | −2.6% | +0.3% |
| BABIP | .0305 | .0310 | .0300 | −1.6% | [−.0007, −.0002] | 7/8 | −1.4% | −1.7% |

The two-parameter model alone matches the 400-input model for K% and BB%. Averaging the two beats either one. Adding the beta-binomial estimates to the 400-input model as extra inputs did not help (−0.1% for K%, as an earlier test showed).

- **HR per ball in play** got worse in 2023–26, so it is not part of the candidate.
- **BABIP** passed, but the DV model has no BABIP output. It becomes relevant if hitter projections are later built from components.

## Effect on the 2027 projections
Across 905 hitters, the blend moves K% by −0.13 points on average (standard deviation 0.88) and BB% by +0.15 (standard deviation 0.44). These rates are not inputs to the WAR projections, so values on the site do not change.

## Data
The inputs are FanGraphs batting and pitching leaderboards for 2010–26 and MLB Stats API minor-league hitting for 2013–26, downloaded November 13, 2026. Their hashes are in `LOCK-2027.json`. The raw data is not redistributed.
