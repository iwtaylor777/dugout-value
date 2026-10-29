# Development log (seasons 2023–2024 only)

Primary metrics: hitters PA-weighted RMSE of wOBA; pitchers IP-weighted RMSE of FIP. Every run is listed, including the ones that did worse.

| Run | Change | Hitter wOBA 2023 / 2024 | Pitcher FIP 2023 / 2024 |
|---|---|---|---|
| ZiPS | (comparison) | .0283 / .0317 | .814 / .801 |
| Steamer | (comparison) | .0285 / .0325 | — / .766 |
| marcel | Marcel baseline: 5/4/3 weights, regressed, anchored to T−1 league | .0302 / .0332 | .885 / .776 |
| v1 | LightGBM on 3-year FanGraphs and Statcast features, direct wOBA, anchored to T−1 league | .0298 / .0313 | — |
| v2a | v1 anchored to the 3-year league mean | .0288 / .0304 | — |
| v2b | v2a plus a 50/50 blend with ridge | .0279 / .0301 | — |
| v2c | v2b, ridge only | .0284 / .0307 | — |
| p1 | Pitchers: same approach, direct FIP, blend 0.5 | — | .767 / .722 |
| p1b | p1 with training back to 2013 (data from 2010) | — | .765 / .714 |
| b-2013 | Hitters trained from 2013 instead of 2016 (worse, reverted) | .0284 / .0303 | — |
| p2 | Pitchers: K, BB+HBP and HR per IP composed into FIP, averaged with direct FIP | — | .764 / .712 |
| v3 | Framework covering all metrics (hitters v2b, pitchers p2) | .0278 / .0305 | .765 / .711 |
| v4 | Hitters: multi-scale shrunk features (60/250/1000 PA) relative to each season's league | .0280 / .0299 | .765 / .711 |
| v5 | v4 plus minor-league features (AAA, AA, A levels; lags 1–2) | .0279 / .0299 | — |
| v6 | v5 with MLB lags 1–5 and minor-league lags 1–3 | .0278 / .0299 | — |
| v7 | Pitchers: minor-league features plus lag 4 (worse, reverted) | — | .772 / .710 |
| v8 | Pitchers: lag 4 without minors (no gain, reverted) | — | .766 / .714 |
| v9 | Final: hitters v6, pitchers v3 | .0278 / .0299 | .765 / .711 |

**Pooled on development, v9.** Hitter wOBA .0289, against ZiPS .0301 and Steamer .0306. Pitcher FIP on 2024, where both comparison systems exist, .711, against ZiPS .801 and Steamer .766. The protocol's win rule is met on development.

**Known weakness.** Hitter K% trails ZiPS on development: .0333 pooled, against .0321. Most of the gap is players whose longer history or minor-league record ZiPS weights more.

## 2026-10-29: hitter WAR-rate features v3 (site projections)
Problem: the v1 hitter WAR-rate model used only offensive features (wOBA, xwOBA, contact and discipline stats), with position dummies that miss 'OF'. It could not see fielding or baserunning, so glove-first players were projected too low. In the top quintile of prior-year fielding, mean error (predicted minus actual WAR/600) was -0.49 in 2025 and -0.46 in 2026.
Fix (feat_bat3.py): the v2 features plus per-600-PA FanGraphs Fielding, BaseRunning and Positional, per lag and as shrunk aggregates. This changes only the WAR-rate model used for site projections; wOBA projections are unchanged.

PA-weighted WAR per 600 PA RMSE, hitters with 200+ PA, common set:

| Season | Role | v1 | v3 | ZiPS | Steamer |
|---|---|---|---|---|---|
| 2023 | dev | 1.714 | 1.637 | 1.946 | 1.721 |
| 2024 | dev | 1.751 | 1.734 | 1.805 | 1.774 |
| 2025 | reused holdout | 1.587 | 1.540 | 1.664 | 1.633 |
| 2026 | reused holdout | 1.693 | 1.644 | 1.795 | 1.645 |

Top-fielding quintile bias: v3 +0.01 in both 2025 and 2026 (v1 about -0.47).
The 2025-26 rows reuse a holdout that v1 had already been scored on; v3 was chosen on the dev seasons.
