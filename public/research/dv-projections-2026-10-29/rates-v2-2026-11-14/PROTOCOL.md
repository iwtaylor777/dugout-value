# Hitter K% and BB% blend: 2027 test protocol

Written November 14, 2026, before the 2027 season. `PROTOCOL.sha256` holds the hash of this file and the time it was written. `LOCK-2027.json` holds the hashes of the frozen 2027 projections. Any later change is a dated amendment. The frozen files are not edited.

## What is being tested

The candidate v2 rate for a hitter's K% and BB% averages two projections, half each:

1. **The locked DV v1 rate model.** This is `dvp.project('bat', 2027)`: LightGBM and ridge on the v2 hitter features, with each rate measured relative to the league.
2. **A beta-binomial projection** (`code/eb_rates.py`). It starts from k plate appearances at the league rate and adds the hitter's own record from the last five seasons, with each season weighted by δ for every year back.
   - k and δ are fit separately for K% and for BB%.
   - They are fit on target seasons 2011–26, excluding 2020, by PA-weighted squared error of next-season rates.
   - K% is strikeouts per PA. BB% is walks per PA, including intentional walks, as in the main protocol.

The 0.5 weight is fixed. It was not tuned.

## What was known when this was written

`results.json` holds a walk-forward backtest on the production recipe. It covers target seasons 2018–19 and 2021–26, and each season is fit only on earlier seasons. The beta-binomial parameters were fit on 2011–17.

| Rate | DV v1 | Beta-binomial | Blend | Seasons the blend was better |
|---|---|---|---|---|
| K% | .0337 | .0335 | .0329 (−2.5%) | 8 of 8 |
| BB% | .0203 | .0203 | .0199 (−2.3%) | 7 of 8 |

These are PA-weighted RMSEs on 2,510 hitter-seasons. The bootstrap intervals for the change exclude zero for both rates.

The same test covered two more rates:
- **Home runs per ball in play:** the blend improved 2018–22 by 2.6% but was 0.3% worse in 2023–26, so this rate is not part of the candidate.
- **BABIP:** the blend improved 1.6% and was better in 7 of 8 seasons. It is not part of this test, because the DV model does not output BABIP.

Including BB% and setting these pass criteria came after the backtest was seen. The 2027 season is the first test that no Dugout Value decision has touched.

## The 2027 test

**Frozen projections.** `predictions_2027.json` holds the DV v1, beta-binomial and blended K% and BB% for every hitter the v1 model projects. `params_2027.json` holds the refit k, δ and league anchors. Both are hashed in `LOCK-2027.json`.

**Scored players.** These follow the main protocol:
- at least 100 MLB plate appearances across 2024–26
- at least 200 plate appearances in 2027
- in comparisons with ZiPS and Steamer, only players all compared systems projected, using the preseason 2027 captures.

**Metric.** The PA-weighted RMSE of 2027 K% and BB%, from FanGraphs end-of-season totals. Each comparison gets a paired player bootstrap with 2,000 resamples and seed 20261027.

**Decision rule.** For each rate separately, the blend replaces the v1 rate in Dugout Value v2 if its 2027 RMSE is lower than v1's. The results will be published either way. They will cover v1, the beta-binomial alone, the blend, ZiPS and Steamer, with intervals.

**Scoring date.** After the 2027 regular season ends, using data pulled no earlier than October 1, 2027.
