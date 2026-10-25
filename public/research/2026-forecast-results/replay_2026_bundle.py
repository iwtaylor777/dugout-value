#!/usr/bin/env python3
"""Replay the public 2026 score bundle without Statcast raw files."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd


def metric(actual, predicted, weight):
    error = predicted - actual
    return {"rmse": float(np.sqrt(np.average(error**2, weights=weight))),
            "mae": float(np.average(np.abs(error), weights=weight)),
            "bias": float(np.average(error, weights=weight))}


def verify_files(root: Path) -> None:
    manifest = json.loads((root / "manifest.json").read_text())
    for name, expected in manifest["files_sha256"].items():
        path = root / name
        if not path.is_file():
            raise ValueError(f"missing bundle file: {name}")
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError(f"bundle checksum mismatch: {name}")


def bootstrap_interval(actual, baseline, shape, weight, iterations=10000):
    rng = np.random.default_rng(20261018)
    gains = np.empty(iterations)
    for i in range(iterations):
        take = rng.integers(0, len(actual), len(actual))
        b = np.sqrt(np.average((baseline[take] - actual[take])**2, weights=weight[take]))
        s = np.sqrt(np.average((shape[take] - actual[take])**2, weights=weight[take]))
        gains[i] = 100 * (b - s) / b
    return [float(np.quantile(gains, 0.025)), float(np.quantile(gains, 0.975))]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", nargs="?", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    root = args.bundle
    verify_files(root)
    predictions = pd.read_csv(root / "frozen_shapecast_predictions.csv")
    observed = pd.read_csv(root / "outcome_pitcher_counts.csv")
    joined = predictions.merge(observed, on="pitcher", how="left", validate="one_to_one").fillna(
        {"target_bf": 0, "strikeouts": 0, "walks": 0})
    eligible = joined[joined["target_bf"].ge(75)].copy()
    eligible["actual"] = (eligible["strikeouts"] - eligible["walks"]) / eligible["target_bf"]
    actual, weight = eligible["actual"].to_numpy(float), eligible["target_bf"].to_numpy(float)
    base_predictions = eligible["baseline_projected_kbb"].to_numpy(float)
    shape_predictions = eligible["shapecast_projected_kbb"].to_numpy(float)
    baseline = metric(actual, base_predictions, weight)
    shape = metric(actual, shape_predictions, weight)
    interval = bootstrap_interval(actual, base_predictions, shape_predictions, weight)
    saved = json.loads((root / "forecast_scores.json").read_text())
    expected_interval = saved["shape"]["pitcher_bootstrap"]["rmse_improvement_pct_interval_95"]
    if not np.allclose(interval, expected_interval, rtol=0, atol=1e-12):
        raise ValueError("replayed pitcher-bootstrap interval differs from the published score")

    vargas = pd.read_csv(root / "vargas_pitches.csv")
    registration = json.loads((root / "frozen_vargas_prediction.json").read_text())["registered_primary_attack"]
    x, z = vargas["inside_x"], vargas["z_norm"]
    third = (17 / 24) / 3
    horizontal = {"outer": x.lt(-third), "middle": x.between(-third, third), "inner": x.gt(third)}[registration["horizontal"]]
    vertical = {"low": z.lt(1/3), "middle": z.between(1/3, 2/3), "high": z.gt(2/3)}[registration["vertical"]]
    vargas["target"] = (vargas["pitch_family"].eq(registration["pitch_family"])
                        & vargas["valid_location"].fillna(False) & x.abs().le(17/24)
                        & z.between(0, 1) & horizontal & vertical).fillna(False)
    periods = {}
    for period, part in vargas.groupby("period"):
        periods[period] = {"pitches": len(part), "target_pitches": int(part["target"].sum()),
                           "target_share": float(part["target"].mean())}
    result = {"eligible_pitchers": len(eligible), "target_bf": int(weight.sum()),
              "baseline": baseline, "shapecast": shape,
              "rmse_improvement_pct": 100 * (baseline["rmse"] - shape["rmse"]) / baseline["rmse"],
              "rmse_improvement_pct_interval_95": interval,
              "vargas": periods,
              "vargas_registered_test_eligible": periods["post"]["target_pitches"] >=
                  registration["minimum_future_pitches_for_evaluation"]}
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
