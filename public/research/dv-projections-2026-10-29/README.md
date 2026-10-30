# DV Projections: methods and validation

Current site model: v1.4 (October 30), data through 2026. v1.4 changes only the aging rule inside the multi-year blend; see `MODEL-20261030-v14.md`. The article is “Introducing DV Projections.” This package includes the original benchmark, independent replay, current model comparisons and supplementary validation. These are retrospective studies using previously examined seasons; the prospective test is 2027.

## Results and measurement

- `validation/current_primary_results.json`: current 2025–26 primary rate comparisons. Hitter wOBA RMSE .028675 versus ZiPS .028758 and Steamer .028818; pitcher FIP .728200 versus .762862 and .731173. Paired intervals resample players, keeping their years together. The FIP improvement over ZiPS is 4.5%; the other primary differences are inconclusive.
- `validation/independent_primary_replay.json`: a fresh fit of the original hash-locked recipe and independent score calculations from raw outcome and preseason arrays. Every original sample count matches; primary RMSE discrepancies are below 4e-14. The original scoring functions are not called.
- `FULL-SEASON-VALIDATION.md` and `validation/full_season_war_results.json`: additional complete-season WAR tests including zero-workload established players, with no target-year workload filter. Expected-workload and full-season valuation forecasts are scored separately. The data and modeling choices were fixed before this endpoint was calculated; these remain reused historical seasons.
- `site/horizon_backtest_summary.json`: current normalized multi-year rate tests. Direct horizon models have lower error in 16/17 comparisons and the unchanged 70/30 blend in 17/17. These are overlapping forecast comparisons on a small number of seasons, not 17 independent evaluation years. Final smoothing and workload assumptions are not scored by this chart.
- `site/current_build_verification.json`: current artifact checksums, role-level changes and the unchanged Rafaela path.
- `MODEL-20261030-v14.md`: the v1.4 aging-rule change, its timing-corrected test and its effect.
- `MODEL-20261029.md`: input/workload conventions (v1.3), unchanged in v1.4.

The additional season-WAR test gives DV expected-workload RMSE 1.1355 for hitters and .8027 for pitchers, versus ZiPS 1.3999/.8767 and Steamer 1.1574/.8041. DV differences from Steamer are inconclusive. The full-season valuation policy gives 1.2325/.8696 and overpredicts realized totals. It should not be described as an injury-adjusted expected season.

## Reproduce

Install `requirements.txt` in Python 3.13. LightGBM on macOS needs a compatible OpenMP runtime. The recorded runs use two model/BLAS threads. Supply local inputs, which are not redistributed:

- `DV_RAW_DIR`: complete FanGraphs leaderboard responses `fg_bat_YEAR.json` / `fg_pit_YEAR.json`, 2010–26, with rows in `data`. Include all advanced and WAR-component columns. The season-leaderboard endpoint is `/api/leaders/major-league/data?pos=all&stats=bat&lg=all&qual=0&type=8&season=YEAR&season1=YEAR&ind=1&pageitems=10000&pagenum=1` (or `stats=pit`). Historical actual IP are baseball notation. `site/runtime.py` converts them to decimal innings for the current model. Projected IP are continuous expectations and are left unchanged.
- `DV_MILB_DIR`: MLB Stats API season hitting splits named `YEAR-SPORT-hitting.json`, years 2013–26, sports 11/12/13/14. Request `/api/v1/stats?stats=season&group=hitting&season=YEAR&sportIds=SPORT&limit=10000&playerPool=ALL`; save `stats[0].splits`, or an empty array. Reject truncated responses.
- `DV_ARCHIVE_DIR`: dated preseason projection arrays `YEAR-zips-bat.json`, `YEAR-zips-pit.json` and Steamer equivalents. Use the archive timestamps recorded in the original study, not current endpoints. Steamer pitchers for 2023 are unavailable.
- The local FanGraphs free-agent tracker is needed only for historical price checks. Current free-agent estimates are a separate package.

Run from the unpacked package:

```sh
python site/test_timing.py
python validation/full_season_war.py --output /path/to/private-validation
python site/replay.py --output /path/to/private-horizon --only benchmark
python site/project_current.py --output /path/to/private-current
python site/site_multiyear_v14.py --input /path/to/private-current/dvp_2027_2031_v3.json --policy site/fixed_age_policy.json --output /path/to/private-current/dvp_multiyear.json
python site/build_dv_site.py /path/to/repository/app/data/player-database.json /path/to/private-current/dvp_2027_2031_v3.json /path/to/private-current/dvp_multiyear.json site/pt_quantile_map_2026_roles.json /path/to/private-current/established_2024_26.json /path/to/private-current/workloads_2024_26.json site/retention.json /path/to/private-current/dv-projections.json
```

Each output directory above contains private player-level fits and must not be copied wholesale into a public release. Use a fresh directory after input or dependency changes. The full-season validation script first reproduces the original, unnormalized recipe, then applies the current innings loader. The role maps shipped here are aggregate quantiles built from 2026 model workloads and archived preseason ZiPS. Rebuild date-specific maps for historical evaluations as the validation script does; do not apply 2026 maps to earlier forecasts.

Chart scripts are `site/chart_primary.py` and `site/chart_corrected.py` (the latter's filename is retained for compatibility). They accept JSON inputs and an output PNG path. Actual season outcomes and model-fitting uncertainty require interpretation beyond a plotted point estimate.

## Original evidence and integrity

`model-v1/`, `LOCK-MODEL-v1.json`, `eval_holdout-v1.json`, the original protocols and `HOLDOUT-RUNS.json` retain their original bytes. `validation/validation_v1*.json` holds earlier team/run-value/pay checks. The descriptive price fit in `site/calibration_dv_results.json` belongs to the earlier model paths and is not relabeled as a current-model refit.

`provenance/pr3-release-20261029.tar.gz` preserves the previous complete release. `provenance/replay-first-run.py`, `provenance/dvp_site-first-run.py` and `provenance/runtime-first-run.py` reproduce the generator composite hash in `site/replay_metadata.json`; these are historical source copies. `superseded/` and the dated amendments retain the audit history. These files explain provenance, not current site behavior.

`input-manifest.json` records raw input hashes. Current additional-validation source hashes are in `validation/measurement_metadata.json`. `release-manifest.json` hashes the package files; `package_release.py` verifies the original model lock and rebuilds the download and checksum. Historical inputs were downloaded retrospectively and may contain provider revisions. No current result is a claim of an untouched historical season.
