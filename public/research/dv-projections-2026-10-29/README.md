# Dugout Value projections: original benchmark and corrected retrospective tests

Published October 29, 2026. Goes with “Introducing DV Projections: how they compare with ZiPS and Steamer.”

## What changed

Read `AMENDMENT-TIMING.md` first. The original multi-year training loop used outcomes unavailable at the forecast origin. Historical contract paths also used a 2026 workload map for earlier signings. Corrected tests cap **all training outcomes at target minus horizon** and use season-specific archived workload maps. They are reused retrospective evaluations, not a new holdout. No feature recipes, hyperparameters or blend weights were retuned.

The original hash-locked `model-v1/`, protocols, locks, `eval_holdout-v1.json` and `HOLDOUT-RUNS.json` remain unchanged. Files under `superseded/` preserve the earlier horizon results, price results and affected site scripts; they must not be cited as current evidence. The original one-year benchmark does not have this horizon timing error. Later hitter WAR features are a reused comparison, not part of that original lock.

## Current evidence

- `eval_holdout-v1.json`: original one-year benchmark and paired intervals, with counts of player-seasons.
- `validation/`: original team, run-value and salary checks. These apply rates to known workloads or measure market agreement; they are not validations of trade value.
- `site/horizon_backtest_summary.json`: corrected 17 rate comparisons, including horizon-only forecasts, the unchanged 70/30 blend, and paired bootstrap difference intervals. The horizon model wins 16 comparisons by point estimate; the blend wins 17, with intervals excluding zero in 12. Final smoothing, survival and workload assumptions are not scored by this test.
- `site/calibration_dv_results.json`: corrected descriptive 2023–26 contract-price refit. Only non-relievers with at least one projected first-year WAR enter the pooled price fit. Matching archived preseason workloads are unavailable for 2021–22, so those seasons are excluded. Do not compare the new pooled estimate with the old pooled estimate as if only one variable changed. Forecast snapshots may postdate signings.
- `site/current_build_verification.json`: rebuilding the current projection JSON from the existing forecast inputs reproduced all 1,245 player records and metadata. Current forecast numbers and the $11M/20% pricing settings are unchanged.
- `input-manifest.json`: input checksums for the corrected replay. Inputs were acquired retrospectively and may include provider revisions.
- `site/replay_metadata.json`: modeling software versions and the scoring-script composite hash. `provenance/replay-first-run.py` is the exact aggregate-run source. The current replay omits the private player diagnostic; aggregate scoring is unchanged.
- `DEVLOG.md`: original development history, including the fielding/baserunning/position WAR-rate fix.

## Reproduce the corrected tests

Use Python 3.13 and `pip install -r requirements.txt` in a fresh environment. On macOS LightGBM also needs an OpenMP runtime; use a compatible local libomp installation. The recorded run uses two model/BLAS threads. On other platforms small floating-point differences are possible.

Supply these local input directories (not distributed):

1. `DV_RAW_DIR`: full FanGraphs season-leaderboard JSON responses named `fg_bat_YEAR.json` and `fg_pit_YEAR.json` for 2010–26, with the data in a `data` array. Requests use `/api/leaders/major-league/data?pos=all&stats=bat&lg=all&qual=0&type=8&season=YEAR&season1=YEAR&ind=1&pageitems=10000&pagenum=1` (replace bat with pit for pitchers). All columns, including advanced and WAR components, are needed.
2. `DV_MILB_DIR`: MLB Stats API season hitting splits, as arrays, named `YEAR-SPORT-hitting.json`, 2013–26 and sports 11, 12, 13, 14. Request `/api/v1/stats?stats=season&group=hitting&season=YEAR&sportIds=SPORT&limit=10000&playerPool=ALL` and save `stats[0].splits`, or `[]` if there are no statistics. Check `totalSplits` to reject truncation.
3. `DV_ARCHIVE_DIR`: the original archived preseason projection arrays named `YEAR-zips-bat.json`, `YEAR-zips-pit.json`, etc. The original local archive manifest records snapshot timestamps and URLs. The corrected contract refit uses ZiPS 2023–26; the original v1 comparison also needs Steamer. Do not substitute current projections for archived ones.
4. The FanGraphs free-agent tracker JSON (`tracker_season`, contract, player, position and projection fields) used by the original study. Its required shape is visible in `site/replay.py`. `site/retention.json` supplies the site's fixed workload policy.

Export the three input-directory variables, then run from the unpacked package:

```sh
python site/test_timing.py
python site/replay.py --output /path/to/private-replay --contracts /path/to/fg_fa_tracker_2020_2027.json --retention site/retention.json --only all
node site/calibrate_dv.mjs /path/to/dugout-value-repository /path/to/private-replay/cal_deals_corrected.json
```

The price script writes `calibration_dv_results.json` to the working directory. The Python replay writes player-level fits only to the requested private directory. Its cache checks source hashes; use a fresh output directory when input files or dependencies change. The original frozen v1 code keeps its original machine paths; `site/runtime.py` supplies portable locations without altering its locked bytes. No recorded result requires changing the locked model files.

## Rebuild the current site output

The published builder has been restored to the multi-year implementation that generated the current site JSON; the previous download incorrectly included an older builder.

```sh
python site/project_current.py --output /path/to/private-current
python site/site_multiyear.py --input /path/to/private-current/dvp_2027_2031_v3.json --output /path/to/private-current/dvp_multiyear.json
python site/build_dv_site.py /path/to/dugout-value-repository/app/data/player-database.json /path/to/private-current/dvp_2027_2031_v3.json /path/to/private-current/dvp_multiyear.json site/pt_quantile_map_2026.json /path/to/private-current/established_2024_26.json /path/to/private-current/workloads_2024_26.json site/retention.json /path/to/private-current/dv-projections.json
```

The 2026 percentile map is an intentional current-site normalization policy. It is included as aggregate quantiles. Corrected historical price tests rebuild their own mappings by season instead of using this current map. Full-season workload is the greater of the mapped prediction and the recent healthy workload. Rates blend horizon and age-curve estimates 70/30, then are smoothed to a line anchored at the first year; workload retention is applied separately. Beyond 2031 the site's existing aging shape continues from the new 2031 level. Missing-history players retain ZiPS.

The reproduction check used the existing current forecast inputs, not newly refitted rates. New data revisions or software differences can change a fresh fit; do not replace a production forecast merely because a new replay finished.

## Files and integrity

`release-manifest.json` lists SHA-256 checksums for the package files (excluding itself). `package_release.py` checks the original v1 lock and rebuilds the download and checksum. The earlier original locks are in `LOCK-PROTOCOL.json`, `LOCK-MODEL-v1.json`, `LOCK-VALIDATION.json` and `LOCK-VALIDATION-AMENDMENT-1.json`. The correction is documented separately, preserving their meaning.

FanGraphs data, archived projections and player-level results derived from them are not redistributed in this package. Source files and predictions in `app/data/` belong to the separately versioned site snapshot.
