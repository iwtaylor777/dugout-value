# Component projections for hitters: protocol (fixed before results, 2026-10-30)

## Question
Does building hitter WAR from separate projections of batting, baserunning, fielding at each position and positional value forecast next-season WAR better than Dugout Value's direct WAR model (v3 features, h = 1)? Whatever the answer, the components become the offense and defense projections used by the depth chart.

## Components (per 600 PA unless noted)
1. **Batting runs**: FanGraphs Batting / PA x 600, projected with the same v3 features, learners (LightGBM + ridge blend), training windows and league anchoring as the direct model. Only the target changes.
2. **Baserunning**: FanGraphs BaseRunning / PA x 600, same machinery.
3. **Fielding by position**: fielding runs per 1,281 innings (600 PA of a full-time player) at position p.
   Row fielding = FanGraphs Defense - positional adjustment x innings / 1,458 (reproduces FanGraphs' Fielding; FRP-based, 2016+).
   Projection = weighted own-position history plus translated history from other positions, shrunk to zero:
   - year weights 5/4/3 for T-1..T-3, innings-weighted;
   - other positions translated as rate_q + alpha x (ADJ_q - ADJ_p), i.e. a share alpha of the positional adjustment carries over;
   - catchers use only catcher history and are never translated in or out;
   - parameters (own regression innings k1, other-position regression k2, alpha, age slope per year beyond 27) fit by weighted least squares on target seasons 2017-2021 only, then frozen.
4. **Positional value**: not a skill projection. For the backtest, the player's T-1 Positional / PA x 600 (his prior role). In the depth chart, the slot he is placed at.
5. **Fielding exposure**: the T-1 mix of innings by position and fielding innings per PA; projected fielding per 600 PA = sum over positions of share x projected rate x (innings per PA x 600 / 1,281).
6. League adjustment and replacement: 3-year league means per 600 PA before T; runs per win: 3-year mean before T.

## Evaluation
- Holdout target seasons 2022, 2023, 2024, 2025, 2026 (2020 never a target). Each forecast uses only data through T-1.
- Population: hitters with >= 200 PA in T and >= 100 PA in T-1 (so a prior role exists), who have both forecasts.
- Primary metric: PA-weighted RMSE of WAR per 600 PA, composed vs direct, pooled across holdouts, plus per-season.
- Also reported: a 50/50 blend of the two; component RMSEs (batting, baserunning, fielding per 600 PA vs a Marcel-style 5/4/3 weighted history regressed with 600 PA / 1,281 innings of league average); an oracle version with the actual T positional value (diagnostic only).

## Decision rule
- Composed WAR replaces the direct total only if its pooled RMSE is lower and it is lower in at least 3 of the 5 seasons.
- If the 50/50 blend meets the same test against the direct model while the composed model alone does not, the blend is adopted.
- Otherwise totals stay on the direct model and the components are published as offense and defense projections (labelled as components, not reconciled to the total).
- The depth chart uses component fielding at the slot plus that slot's positional adjustment in all cases; how that is combined with the total depends on the decision above.
