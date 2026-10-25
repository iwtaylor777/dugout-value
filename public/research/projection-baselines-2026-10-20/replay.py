"""Rebuild fixed baselines and scores from the released normalized counts."""
import hashlib
import json
from pathlib import Path
import numpy as np
from baselines import rate_baselines, workload_baselines
from scoring import score

ROOT = Path(__file__).resolve().parent


def same(actual, expected, path="results"):
    if isinstance(expected, dict):
        if actual.keys() != expected.keys():
            raise ValueError(f"keys differ at {path}")
        for key in expected:
            same(actual[key], expected[key], f"{path}.{key}")
    elif isinstance(expected, list):
        if len(actual) != len(expected):
            raise ValueError(f"length differs at {path}")
        for i, (a, e) in enumerate(zip(actual, expected)):
            same(a, e, f"{path}[{i}]")
    elif isinstance(expected, (int, float)):
        if not np.isclose(actual, expected, rtol=1e-12, atol=1e-12):
            raise ValueError(f"number differs at {path}: {actual} != {expected}")
    elif actual != expected:
        raise ValueError(f"value differs at {path}")


def main():
    manifest = json.loads((ROOT / "manifest.json").read_text())
    for name, digest in manifest["files"].items():
        if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != digest:
            raise ValueError(f"checksum failed: {name}")
    inputs = json.loads((ROOT / "inputs.json").read_text())
    expected = json.loads((ROOT / "results.json").read_text())
    for key, rows in inputs.items():
        audit = expected["audits"][key]
        elapsed = 2 * audit["completed_games"] / 30
        remaining = 162 - elapsed - 2 * audit["gap_games_started"] / 30
        same(elapsed, audit["elapsed_team_games"])
        same(remaining, audit["remaining_team_games"])
        for row in rows:
            current, prior = row["source_counts"], row["prior_season_counts"]
            league = {e: audit["league_rates"][e] for e in row["rates"]}
            forecasts = rate_baselines(current, prior, league)
            for endpoint, forecast in forecasts.items():
                same(forecast, row["rates"][endpoint]["multiyear"])
                row["rates"][endpoint]["multiyear"] = forecast
            work = workload_baselines(current[0], [p[0] for p in prior], elapsed, remaining)
            for name, forecast in work.items():
                same(forecast, row["workload"][name])
                row["workload"][name] = forecast
        same(score(rows, expected["bootstrap_resamples"]), expected["scores"][key], key)
        print(f"Verified {key}: {len(rows)} players", flush=True)
    print("All checksums, new baseline forecasts, scores and intervals reproduced.")


if __name__ == "__main__":
    main()
