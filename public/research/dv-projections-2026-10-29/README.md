# Dugout Value projections: validation files (October 29, 2026)

These files go with the article "Our own projections match ZiPS, so the tools now use them".

## Locks

| File | What it locks | Time (UTC) |
|---|---|---|
| `PROTOCOL-PROJECTIONS.md`, `LOCK-PROTOCOL.json` | Benchmark protocol | Oct 27, 23:50 |
| `LOCK-MODEL-v1.json` | Model v1 code (`model-v1/`) | Oct 28, 00:08 |
| `PROTOCOL-VALIDATION.md`, `LOCK-VALIDATION.json` | Validation protocol | Oct 28, 00:18 |
| `VALIDATION-AMENDMENT-1.md`, `LOCK-VALIDATION-AMENDMENT-1.json` | Validation Amendment 1 | Oct 28, 00:25 |

## Results

- `eval_holdout-v1.json`: holdout results.
- `HOLDOUT-RUNS.json`: the log of every holdout run.
- `validation/`:
  - `validation_v1.json`: team tests W, R and A.
  - `validation_v1_amend1.json`: tests E, W2 and P.
  - The scripts that produced them.
- `DEVLOG.md`: the development log, including the v1.1 fix to the hitter WAR-rate model, with fielding, baserunning and positional inputs.

## Site projections (`site/`)

- **Multi-year model and backtests:**
  - `dvp_site.py` and `feat_bat3.py`: WAR rate and playing time for each horizon.
  - `bt_horizon.py`, with `horizon_backtest_summary.json`: horizon models against a one-year projection plus a standard aging curve.
  - `site_multiyear.py`: the 70/30 blend.
  - `build_dv_site.py`: full-season playing time, smoothing, and the JSON the site reads.
- **Price check:**
  - `cal_fits.py` and `cal_paths.py`: projection paths as of each signing.
  - `calibrate_dv.mjs`, with `calibration_dv_results.json`: the $/WAR refit on 2021–26 free-agent contracts.

FanGraphs data, the archived ZiPS and Steamer projections, and per-player results built from them are not redistributed.
