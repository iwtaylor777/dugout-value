# 2026 forecast score bundle

This bundle lets you reproduce the published ShapeCast point scores, the 10,000-draw pitcher bootstrap interval, and the Miguel Vargas region counts without downloading the full pitch dataset.

Use Python 3.10 or newer with `numpy` and `pandas` installed. From this directory, run:

```sh
python3 replay_2026_bundle.py
```

The replay checks every bundled file against `manifest.json` before reading it. It then joins the frozen predictions to `outcome_pitcher_counts.csv` by MLBAM pitcher ID, applies the registered 75-batters-faced threshold, and computes BF-weighted RMSE, MAE, and bias. The bootstrap resamples eligible pitchers with seed `20261018` for 10,000 draws and checks its 95% interval against `forecast_scores.json`. The Vargas calculation applies the registered pitch family and high-outer region to `vargas_pitches.csv` and checks whether 75 later pitches qualify. It does not fit or revise a model.

`shapecast_pitcher_scores.csv` contains all 387 frozen pitchers with their observed target counts and scoring-eligibility flags. `forecast_scores.json` has the full result, including role splits and calibration deciles. `manifest.json` records the Baseball Savant query URLs, retrieval window, source CSV hashes, and hashes of every bundled file. The full source CSVs are separate from this compact release; `outcome_pitcher_counts.csv` is sufficient to replay the published ShapeCast metrics.
