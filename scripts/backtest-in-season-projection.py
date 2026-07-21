#!/usr/bin/env python3
"""Leakage-safe historical test of a ridge correction to RoS ZiPS.

The model is deliberately anchored on the archived RoS ZiPS WAR rate.  It may
only learn a correction from season-to-date sample size, age, and differences
between actual component performance and the ZiPS rest-of-season forecast.

Historical projection pages come from archived FanGraphs pages.  Realized
season-to-date and post-snapshot performance comes from FanGraphs' custom-date
leaderboard.  Downloads are cached outside the repository by default.
"""

from __future__ import annotations

import argparse
import gzip
import html
import json
import math
import random
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


USER_AGENT = "DugoutValueProjectionAudit/1.0 (historical model validation)"
RUNS_PER_WIN = 10.0
@dataclass(frozen=True)
class Snapshot:
    key: str
    season: int
    captured: date
    cutoff: date
    season_start: date
    season_end: date
    wayback_timestamp: str
    split: str


SNAPSHOTS = (
    Snapshot(
        "2023-07-27",
        2023,
        date(2023, 7, 27),
        date(2023, 7, 26),
        date(2023, 3, 30),
        date(2023, 10, 1),
        "20230727191429",
        "train",
    ),
    Snapshot(
        "2024-05-15",
        2024,
        date(2024, 5, 15),
        date(2024, 5, 14),
        date(2024, 3, 28),
        date(2024, 9, 29),
        "20240515164948",
        "train",
    ),
    Snapshot(
        "2024-08-25",
        2024,
        date(2024, 8, 25),
        date(2024, 8, 24),
        date(2024, 3, 28),
        date(2024, 9, 29),
        "20240825063515",
        "train",
    ),
    Snapshot(
        "2025-06-30",
        2025,
        date(2025, 6, 30),
        date(2025, 6, 29),
        date(2025, 3, 27),
        date(2025, 9, 28),
        "20250630175910",
        "test",
    ),
    Snapshot(
        "2025-07-31",
        2025,
        date(2025, 7, 31),
        date(2025, 7, 30),
        date(2025, 3, 27),
        date(2025, 9, 28),
        "20250731083705",
        "test",
    ),
)


@dataclass(frozen=True)
class FutureAudit:
    snapshot_key: str
    baseline_timestamp: str
    future_timestamp: str
    target_season: int
    target_start: date
    target_end: date
    split: str


FUTURE_AUDITS = (
    FutureAudit(
        "2023-07-27",
        "20230315012535",
        "20230315012535",
        2024,
        date(2024, 3, 28),
        date(2024, 9, 29),
        "train",
    ),
    FutureAudit(
        "2024-05-15",
        "20240515092135",
        "20240407055548",
        2025,
        date(2025, 3, 27),
        date(2025, 9, 28),
        "test",
    ),
    FutureAudit(
        "2024-08-25",
        "20240823152526",
        "20240824000220",
        2025,
        date(2025, 3, 27),
        date(2025, 9, 28),
        "test",
    ),
)


FUTURE_FEATURES = (
    "signal_rate",
    "age",
    "log_ytd_pa",
    "war_rate_gap",
    "xwoba_gap",
    "bb_rate_gap",
    "k_rate_gap",
    "iso_gap",
)


FEATURES = (
    "age",
    "log_ytd_pa",
    "war_rate_gap",
    "wrc_plus_gap",
    "bb_rate_gap",
    "k_rate_gap",
    "iso_gap",
    "babip_gap",
    "obp_gap",
    "slg_gap",
    "xwoba_gap",
    "barrel_rate",
    "hard_hit_rate",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=Path("/private/tmp/dugout-value-projection-backtest"),
    )
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--bootstrap", type=int, default=2000)
    return parser.parse_args()


def fetch_bytes(url: str, path: Path, refresh: bool) -> bytes:
    if path.exists() and not refresh:
        return path.read_bytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        payload = response.read()
    path.write_bytes(payload)
    return payload


def find_projection_rows(value: Any) -> list[dict[str, Any]]:
    candidates: list[list[dict[str, Any]]] = []

    def visit(node: Any) -> None:
        if isinstance(node, list):
            if node and all(isinstance(row, dict) for row in node):
                keys = set().union(*(row.keys() for row in node[:10]))
                has_id = "playerid" in keys or "playerids" in keys
                if has_id and {"PA", "WAR"}.issubset(keys):
                    candidates.append(node)
            for child in node:
                visit(child)
        elif isinstance(node, dict):
            for child in node.values():
                visit(child)

    visit(value)
    if not candidates:
        raise ValueError("Could not find projection rows in archived page")
    return max(candidates, key=len)


def load_archived_projection_type(
    *,
    cache_key: str,
    timestamp: str,
    projection_type: str,
    cache_dir: Path,
    refresh: bool,
) -> list[dict[str, Any]]:
    original = (
        "https://www.fangraphs.com/projections?pos=all&stats=bat"
        f"&type={projection_type}"
    )
    url = (
        f"https://web.archive.org/web/{timestamp}id_/"
        f"{original}"
    )
    raw = fetch_bytes(
        url, cache_dir / f"{cache_key}-{projection_type}.html", refresh
    )
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    page = raw.decode("utf-8", errors="replace")
    match = re.search(
        r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
        page,
        flags=re.DOTALL,
    )
    if not match:
        raise ValueError(f"No __NEXT_DATA__ found for {cache_key} {projection_type}")
    payload = json.loads(html.unescape(match.group(1)))
    return find_projection_rows(payload)


def load_archived_projection(
    snapshot: Snapshot, cache_dir: Path, refresh: bool
) -> list[dict[str, Any]]:
    return load_archived_projection_type(
        cache_key=snapshot.key,
        timestamp=snapshot.wayback_timestamp,
        projection_type="rzips",
        cache_dir=cache_dir,
        refresh=refresh,
    )


def leaderboard_url(snapshot: Snapshot, start: date, end: date) -> str:
    params = {
        "pos": "all",
        "stats": "bat",
        "lg": "all",
        "qual": "0",
        "type": "8",
        "season": str(snapshot.season),
        "season1": str(snapshot.season),
        "ind": "0",
        "team": "0",
        "rost": "0",
        "age": "0",
        "filter": "",
        "players": "0",
        "month": "1000",
        "startdate": start.isoformat(),
        "enddate": end.isoformat(),
        "pageitems": "2000",
        "pagenum": "1",
    }
    return (
        "https://www.fangraphs.com/api/leaders/major-league/data?"
        + urllib.parse.urlencode(params)
    )


def load_leaderboard(
    snapshot: Snapshot,
    label: str,
    start: date,
    end: date,
    cache_dir: Path,
    refresh: bool,
) -> list[dict[str, Any]]:
    raw = fetch_bytes(
        leaderboard_url(snapshot, start, end),
        cache_dir / f"{snapshot.key}-{label}.json",
        refresh,
    )
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    payload = json.loads(raw)
    if not isinstance(payload.get("data"), list):
        raise ValueError(f"FanGraphs leaderboard failed for {snapshot.key} {label}")
    return payload["data"]


def number(row: dict[str, Any], key: str) -> float:
    value = row.get(key)
    if value is None or value == "":
        return math.nan
    try:
        return float(value)
    except (TypeError, ValueError):
        return math.nan


def safe_rate(value: float, playing_time: float, scale: float = 1.0) -> float:
    if not np.isfinite(value) or not np.isfinite(playing_time) or playing_time <= 0:
        return math.nan
    return value / playing_time * scale


def player_id(row: dict[str, Any]) -> str:
    value = row.get("playerid") or row.get("playerids")
    if value is None:
        return ""
    try:
        return str(int(float(value)))
    except (TypeError, ValueError):
        return str(value)


def projection_name(row: dict[str, Any]) -> str:
    return str(row.get("PlayerName") or row.get("Name") or "Unknown")


def build_snapshot_frame(
    snapshot: Snapshot, cache_dir: Path, refresh: bool
) -> pd.DataFrame:
    projections = load_archived_projection(snapshot, cache_dir, refresh)
    ytd = load_leaderboard(
        snapshot,
        "ytd",
        snapshot.season_start,
        snapshot.cutoff,
        cache_dir,
        refresh,
    )
    future = load_leaderboard(
        snapshot,
        "future",
        snapshot.captured,
        snapshot.season_end,
        cache_dir,
        refresh,
    )
    ytd_by_id = {player_id(row): row for row in ytd if player_id(row)}
    future_by_id = {player_id(row): row for row in future if player_id(row)}

    records: list[dict[str, Any]] = []
    for projection in projections:
        pid = player_id(projection)
        actual = ytd_by_id.get(pid)
        realized = future_by_id.get(pid)
        if not actual or not realized:
            continue

        projected_pa = number(projection, "PA")
        ytd_pa = number(actual, "PA")
        future_pa = number(realized, "PA")
        if projected_pa < 50 or ytd_pa < 75 or future_pa < 50:
            continue

        zips_rate = safe_rate(number(projection, "WAR"), projected_pa, 600)
        ytd_rate = safe_rate(number(actual, "WAR"), ytd_pa, 600)
        future_rate = safe_rate(number(realized, "WAR"), future_pa, 600)
        if not all(np.isfinite(value) for value in (zips_rate, ytd_rate, future_rate)):
            continue

        record = {
            "snapshot": snapshot.key,
            "season": snapshot.season,
            "split": snapshot.split,
            "playerid": pid,
            "player": projection_name(projection),
            "position_db": str(
                projection.get("positionDB")
                or projection.get("position")
                or projection.get("Pos")
                or projection.get("minpos")
                or ""
            ),
            "projected_pa": projected_pa,
            "ytd_pa": ytd_pa,
            "future_pa": future_pa,
            "zips_rate": zips_rate,
            "zips_off_rate": safe_rate(
                number(projection, "Off"), projected_pa, 600
            ),
            "zips_def_rate": safe_rate(
                number(projection, "Def"), projected_pa, 600
            ),
            "ytd_rate": ytd_rate,
            "future_rate": future_rate,
            "target_correction": future_rate - zips_rate,
            "age": number(actual, "Age"),
            "log_ytd_pa": math.log1p(ytd_pa),
            "war_rate_gap": ytd_rate - zips_rate,
            "wrc_plus_gap": (
                number(actual, "wRC+") - number(projection, "wRC+")
            ),
            "bb_rate_gap": number(actual, "BB%") - number(projection, "BB%"),
            "k_rate_gap": number(actual, "K%") - number(projection, "K%"),
            "iso_gap": number(actual, "ISO") - number(projection, "ISO"),
            "babip_gap": number(actual, "BABIP") - number(projection, "BABIP"),
            "obp_gap": number(actual, "OBP") - number(projection, "OBP"),
            "slg_gap": number(actual, "SLG") - number(projection, "SLG"),
            "xwoba_gap": number(actual, "xwOBA") - number(projection, "wOBA"),
            "barrel_rate": number(actual, "Barrel%"),
            "hard_hit_rate": number(actual, "HardHit%"),
        }
        records.append(record)
    return pd.DataFrame.from_records(records)


def build_future_audit_frame(
    audit: FutureAudit,
    same_season: pd.DataFrame,
    cache_dir: Path,
    refresh: bool,
) -> pd.DataFrame:
    baseline_rows = load_archived_projection_type(
        cache_key=f"{audit.snapshot_key}-baseline",
        timestamp=audit.baseline_timestamp,
        projection_type="zips",
        cache_dir=cache_dir,
        refresh=refresh,
    )
    future_rows = load_archived_projection_type(
        cache_key=f"{audit.snapshot_key}-future",
        timestamp=audit.future_timestamp,
        projection_type="zipsp1",
        cache_dir=cache_dir,
        refresh=refresh,
    )
    target_snapshot = Snapshot(
        key=f"target-{audit.target_season}",
        season=audit.target_season,
        captured=audit.target_start,
        cutoff=audit.target_end,
        season_start=audit.target_start,
        season_end=audit.target_end,
        wayback_timestamp="",
        split=audit.split,
    )
    actual_rows = load_leaderboard(
        target_snapshot,
        "full-season",
        audit.target_start,
        audit.target_end,
        cache_dir,
        refresh,
    )
    baseline_by_id = {player_id(row): row for row in baseline_rows if player_id(row)}
    future_by_id = {player_id(row): row for row in future_rows if player_id(row)}
    actual_by_id = {player_id(row): row for row in actual_rows if player_id(row)}

    records = []
    for current in same_season.to_dict("records"):
        pid = current["playerid"]
        baseline = baseline_by_id.get(pid)
        future = future_by_id.get(pid)
        actual = actual_by_id.get(pid)
        if not baseline or not future or not actual:
            continue
        baseline_pa = number(baseline, "PA")
        future_pa = number(future, "PA")
        actual_pa = number(actual, "PA")
        if baseline_pa < 75 or future_pa < 75 or actual_pa < 100:
            continue
        baseline_rate = safe_rate(number(baseline, "WAR"), baseline_pa, 600)
        baseline_off_rate = safe_rate(
            number(baseline, "Off"), baseline_pa, 600
        )
        baseline_def_rate = safe_rate(
            number(baseline, "Def"), baseline_pa, 600
        )
        future_zips_rate = safe_rate(number(future, "WAR"), future_pa, 600)
        actual_rate = safe_rate(number(actual, "WAR"), actual_pa, 600)
        if not all(
            np.isfinite(value)
            for value in (baseline_rate, future_zips_rate, actual_rate)
        ):
            continue
        zips_signal_rate = current["zips_rate"] - baseline_rate
        offense_signal_rate = (
            current["zips_off_rate"] - baseline_off_rate
        ) / RUNS_PER_WIN
        record = dict(current)
        record.update(
            {
                "future_audit": audit.snapshot_key,
                "future_split": audit.split,
                "target_season": audit.target_season,
                "baseline_zips_rate": baseline_rate,
                "baseline_off_rate": baseline_off_rate,
                "baseline_def_rate": baseline_def_rate,
                "future_zips_rate": future_zips_rate,
                "next_actual_rate": actual_rate,
                "next_actual_pa": actual_pa,
                "zips_signal_rate": zips_signal_rate,
                "signal_rate": zips_signal_rate,
                "offense_signal_rate": offense_signal_rate,
                "nonoffense_signal_rate": (
                    zips_signal_rate - offense_signal_rate
                ),
                "future_anchor_signal_rate": (
                    current["zips_rate"] - future_zips_rate
                ),
                "ytd_baseline_signal_rate": (
                    current["ytd_rate"] - baseline_rate
                ),
                "next_target_correction": actual_rate - future_zips_rate,
            }
        )
        records.append(record)
    return pd.DataFrame.from_records(records)


def make_pipeline(alpha: float) -> Pipeline:
    return Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
            ("scale", StandardScaler()),
            ("ridge", Ridge(alpha=alpha)),
        ]
    )


def weighted_mse(y_true: np.ndarray, y_pred: np.ndarray, weights: np.ndarray) -> float:
    return float(np.average(np.square(y_true - y_pred), weights=weights))


def select_alpha(
    train: pd.DataFrame, features: Iterable[str] = FEATURES
) -> tuple[float, pd.DataFrame]:
    features = tuple(features)
    folds = (
        (("2023-07-27",), "2024-05-15"),
        (("2023-07-27", "2024-05-15"), "2024-08-25"),
    )
    rows = []
    for alpha in (0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000):
        fold_losses = []
        for fit_snapshots, validation_snapshot in folds:
            fit = train[train["snapshot"].isin(fit_snapshots)]
            validation = train[train["snapshot"] == validation_snapshot]
            model = make_pipeline(alpha)
            model.fit(
                fit.loc[:, features],
                fit["target_correction"],
                ridge__sample_weight=np.minimum(fit["future_pa"], 300),
            )
            predicted_rate = validation["zips_rate"].to_numpy() + model.predict(
                validation.loc[:, features]
            )
            fold_losses.append(
                weighted_mse(
                    validation["future_rate"].to_numpy(),
                    predicted_rate,
                    np.minimum(validation["future_pa"].to_numpy(), 300),
                )
            )
        rows.append(
            {
                "alpha": alpha,
                "cv_rmse": math.sqrt(float(np.mean(fold_losses))),
                "fold_1_rmse": math.sqrt(fold_losses[0]),
                "fold_2_rmse": math.sqrt(fold_losses[1]),
            }
        )
    results = pd.DataFrame(rows).sort_values(["cv_rmse", "alpha"])
    return float(results.iloc[0]["alpha"]), results


def select_future_alpha(train: pd.DataFrame) -> tuple[float, pd.DataFrame]:
    rows = []
    groups = train["playerid"].map(lambda value: int(value) % 5)
    for alpha in (0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000):
        losses = []
        for fold in range(5):
            fit = train[groups != fold]
            validation = train[groups == fold]
            model = make_pipeline(alpha)
            model.fit(
                fit.loc[:, FUTURE_FEATURES],
                fit["next_target_correction"],
                ridge__sample_weight=np.minimum(fit["next_actual_pa"], 600),
            )
            prediction = validation["future_zips_rate"].to_numpy() + model.predict(
                validation.loc[:, FUTURE_FEATURES]
            )
            losses.append(
                weighted_mse(
                    validation["next_actual_rate"].to_numpy(),
                    prediction,
                    np.minimum(validation["next_actual_pa"].to_numpy(), 600),
                )
            )
        rows.append({"alpha": alpha, "cv_rmse": math.sqrt(float(np.mean(losses)))})
    results = pd.DataFrame(rows).sort_values(["cv_rmse", "alpha"])
    return float(results.iloc[0]["alpha"]), results


def future_metric_row(frame: pd.DataFrame, label: str) -> dict[str, Any]:
    weights = np.minimum(frame["next_actual_pa"].to_numpy(), 600)
    actual = frame["next_actual_rate"].to_numpy()
    baseline = frame["future_zips_rate"].to_numpy()
    carry = frame["carry85_rate"].to_numpy()
    ridge = frame["future_ridge_rate"].to_numpy()

    def rmse(prediction: np.ndarray) -> float:
        return math.sqrt(float(np.average(np.square(actual - prediction), weights=weights)))

    def mae(prediction: np.ndarray) -> float:
        return float(np.average(np.abs(actual - prediction), weights=weights))

    baseline_rmse = rmse(baseline)
    carry_rmse = rmse(carry)
    ridge_rmse = rmse(ridge)
    baseline_mae = mae(baseline)
    carry_mae = mae(carry)
    ridge_mae = mae(ridge)
    return {
        "sample": label,
        "n": len(frame),
        "zips_rmse_rate": baseline_rmse,
        "carry85_rmse_rate": carry_rmse,
        "ridge_rmse_rate": ridge_rmse,
        "carry85_rmse_improvement_pct": 100
        * (baseline_rmse - carry_rmse)
        / baseline_rmse,
        "ridge_rmse_improvement_pct": 100
        * (baseline_rmse - ridge_rmse)
        / baseline_rmse,
        "zips_mae_rate": baseline_mae,
        "carry85_mae_improvement_pct": 100
        * (baseline_mae - carry_mae)
        / baseline_mae,
        "ridge_mae_improvement_pct": 100
        * (baseline_mae - ridge_mae)
        / baseline_mae,
    }


def carry_sensitivity(
    train: pd.DataFrame, test: pd.DataFrame
) -> tuple[float, pd.DataFrame]:
    weights = np.minimum(train["next_actual_pa"].to_numpy(), 600)
    signal = train["signal_rate"].to_numpy()
    target = train["next_target_correction"].to_numpy()
    learned = float(np.sum(weights * signal * target) / np.sum(weights * signal**2))
    rows = []
    actual = test["next_actual_rate"].to_numpy()
    baseline = test["future_zips_rate"].to_numpy()
    test_weights = np.minimum(test["next_actual_pa"].to_numpy(), 600)
    baseline_rmse = math.sqrt(
        float(np.average(np.square(actual - baseline), weights=test_weights))
    )
    baseline_mae = float(np.average(np.abs(actual - baseline), weights=test_weights))
    for label, carry in (
        ("published future ZiPS", 0.0),
        ("25% carry", 0.25),
        ("50% carry", 0.5),
        ("85% carry", 0.85),
        ("100% carry", 1.0),
        ("2023-trained carry", learned),
    ):
        prediction = baseline + carry * test["signal_rate"].to_numpy()
        rmse = math.sqrt(
            float(np.average(np.square(actual - prediction), weights=test_weights))
        )
        mae = float(np.average(np.abs(actual - prediction), weights=test_weights))
        rows.append(
            {
                "variant": label,
                "carry": carry,
                "rmse_rate": rmse,
                "rmse_improvement_pct": 100 * (baseline_rmse - rmse) / baseline_rmse,
                "mae_rate": mae,
                "mae_improvement_pct": 100 * (baseline_mae - mae) / baseline_mae,
            }
        )
    return learned, pd.DataFrame(rows)


def component_signal_sensitivity(
    train: pd.DataFrame, test: pd.DataFrame
) -> tuple[dict[str, float], pd.DataFrame]:
    signals = ("offense_signal_rate", "nonoffense_signal_rate")
    fit = train.dropna(subset=[*signals, "next_target_correction"]).copy()
    evaluated = test.dropna(
        subset=[
            *signals,
            "future_anchor_signal_rate",
            "ytd_baseline_signal_rate",
            "next_actual_rate",
        ]
    ).copy()
    fit_weights = np.minimum(fit["next_actual_pa"].to_numpy(), 600)
    design = fit.loc[:, signals].to_numpy()
    target = fit["next_target_correction"].to_numpy()
    root_weights = np.sqrt(fit_weights)[:, None]
    coefficients = np.linalg.lstsq(
        design * root_weights,
        target * root_weights[:, 0],
        rcond=None,
    )[0]
    learned = dict(zip(signals, coefficients, strict=True))

    actual = evaluated["next_actual_rate"].to_numpy()
    baseline = evaluated["future_zips_rate"].to_numpy()
    weights = np.minimum(evaluated["next_actual_pa"].to_numpy(), 600)
    offense = evaluated["offense_signal_rate"].to_numpy()
    nonoffense = evaluated["nonoffense_signal_rate"].to_numpy()
    future_anchor = evaluated["future_anchor_signal_rate"].to_numpy()
    ytd_signal = evaluated["ytd_baseline_signal_rate"].to_numpy()
    conflict_dominant = (offense * nonoffense < 0) & (
        np.abs(nonoffense) > np.abs(offense)
    )
    guarded_signal = offense + np.where(
        conflict_dominant, 0.5 * nonoffense, nonoffense
    )
    guarded_agreement_signal = np.where(
        guarded_signal * ytd_signal < 0,
        0,
        guarded_signal,
    )
    softened_agreement_signal = np.where(
        guarded_signal * ytd_signal < 0,
        0.5 * guarded_signal,
        guarded_signal,
    )
    variants = (
        ("published future ZiPS", baseline),
        ("50% total WAR signal", baseline + 0.5 * (offense + nonoffense)),
        ("50% offense only", baseline + 0.5 * offense),
        ("75% offense only", baseline + 0.75 * offense),
        ("100% offense only", baseline + offense),
        (
            "50% offense + 10% non-offense",
            baseline + 0.5 * offense + 0.1 * nonoffense,
        ),
        (
            "50% offense + 25% non-offense",
            baseline + 0.5 * offense + 0.25 * nonoffense,
        ),
        (
            "50% guarded total signal",
            baseline + 0.5 * guarded_signal,
        ),
        (
            "50% guarded + YTD direction",
            baseline + 0.5 * guarded_agreement_signal,
        ),
        (
            "50% guarded + soft YTD direction",
            baseline + 0.5 * softened_agreement_signal,
        ),
        ("50% current-vs-future anchor", baseline + 0.5 * future_anchor),
        (
            "2023-trained component carry",
            baseline
            + learned["offense_signal_rate"] * offense
            + learned["nonoffense_signal_rate"] * nonoffense,
        ),
    )
    baseline_rmse = math.sqrt(
        float(np.average(np.square(actual - baseline), weights=weights))
    )
    baseline_mae = float(np.average(np.abs(actual - baseline), weights=weights))
    rows = []
    for label, prediction in variants:
        rmse = math.sqrt(
            float(np.average(np.square(actual - prediction), weights=weights))
        )
        mae = float(np.average(np.abs(actual - prediction), weights=weights))
        rows.append(
            {
                "variant": label,
                "n": len(evaluated),
                "rmse_rate": rmse,
                "rmse_improvement_pct": 100
                * (baseline_rmse - rmse)
                / baseline_rmse,
                "mae_rate": mae,
                "mae_improvement_pct": 100
                * (baseline_mae - mae)
                / baseline_mae,
            }
        )
    return learned, pd.DataFrame(rows)


def component_signal_bootstrap(
    frame: pd.DataFrame, iterations: int, seed: int = 20260721
) -> dict[str, dict[str, float]]:
    clean = frame.dropna(
        subset=[
            "offense_signal_rate",
            "nonoffense_signal_rate",
            "future_zips_rate",
            "next_actual_rate",
        ]
    )
    rng = random.Random(seed)
    ids = sorted(clean["playerid"].unique())
    by_id = {pid: clean[clean["playerid"] == pid] for pid in ids}
    values = {"total50": [], "guarded50": [], "guarded_minus_total": []}
    for _ in range(iterations):
        sample = pd.concat([by_id[rng.choice(ids)] for _ in ids], ignore_index=True)
        actual = sample["next_actual_rate"].to_numpy()
        baseline = sample["future_zips_rate"].to_numpy()
        offense = sample["offense_signal_rate"].to_numpy()
        nonoffense = sample["nonoffense_signal_rate"].to_numpy()
        conflict_dominant = (offense * nonoffense < 0) & (
            np.abs(nonoffense) > np.abs(offense)
        )
        guarded = offense + np.where(
            conflict_dominant, 0.5 * nonoffense, nonoffense
        )
        weights = np.minimum(sample["next_actual_pa"].to_numpy(), 600)

        def rmse(prediction: np.ndarray) -> float:
            return math.sqrt(
                float(np.average(np.square(actual - prediction), weights=weights))
            )

        baseline_rmse = rmse(baseline)
        total_rmse = rmse(baseline + 0.5 * (offense + nonoffense))
        guarded_rmse = rmse(baseline + 0.5 * guarded)
        total_improvement = 100 * (baseline_rmse - total_rmse) / baseline_rmse
        guarded_improvement = (
            100 * (baseline_rmse - guarded_rmse) / baseline_rmse
        )
        values["total50"].append(total_improvement)
        values["guarded50"].append(guarded_improvement)
        values["guarded_minus_total"].append(
            guarded_improvement - total_improvement
        )
    result = {}
    for key, observations in values.items():
        array = np.asarray(observations)
        result[key] = {
            "low": float(np.percentile(array, 2.5)),
            "median": float(np.percentile(array, 50)),
            "high": float(np.percentile(array, 97.5)),
            "probability_positive": float(np.mean(array > 0)),
        }
    return result


def future_clustered_bootstrap(
    frame: pd.DataFrame, iterations: int, seed: int = 20260717
) -> dict[str, dict[str, float]]:
    rng = random.Random(seed)
    ids = sorted(frame["playerid"].unique())
    by_id = {pid: frame[frame["playerid"] == pid] for pid in ids}
    values = {"carry50": [], "carry85": [], "ridge": []}
    for _ in range(iterations):
        sample = pd.concat([by_id[rng.choice(ids)] for _ in ids], ignore_index=True)
        metric = future_metric_row(sample, "bootstrap")
        weights = np.minimum(sample["next_actual_pa"].to_numpy(), 600)
        actual = sample["next_actual_rate"].to_numpy()
        baseline = sample["future_zips_rate"].to_numpy()
        baseline_rmse = math.sqrt(
            float(np.average(np.square(actual - baseline), weights=weights))
        )
        carry50 = baseline + 0.5 * sample["signal_rate"].to_numpy()
        carry50_rmse = math.sqrt(
            float(np.average(np.square(actual - carry50), weights=weights))
        )
        values["carry50"].append(
            100 * (baseline_rmse - carry50_rmse) / baseline_rmse
        )
        values["carry85"].append(metric["carry85_rmse_improvement_pct"])
        values["ridge"].append(metric["ridge_rmse_improvement_pct"])
    result = {}
    for key, improvements in values.items():
        array = np.asarray(improvements)
        result[key] = {
            "low": float(np.percentile(array, 2.5)),
            "median": float(np.percentile(array, 50)),
            "high": float(np.percentile(array, 97.5)),
            "probability_positive": float(np.mean(array > 0)),
        }
    return result


def metric_row(frame: pd.DataFrame, label: str) -> dict[str, Any]:
    weights = np.minimum(frame["future_pa"].to_numpy(), 300)
    baseline_error = frame["future_rate"].to_numpy() - frame["zips_rate"].to_numpy()
    ridge_error = frame["future_rate"].to_numpy() - frame["ridge_rate"].to_numpy()
    baseline_rmse = math.sqrt(float(np.average(baseline_error**2, weights=weights)))
    ridge_rmse = math.sqrt(float(np.average(ridge_error**2, weights=weights)))
    baseline_mae = float(np.average(np.abs(baseline_error), weights=weights))
    ridge_mae = float(np.average(np.abs(ridge_error), weights=weights))
    baseline_total_error = baseline_error * frame["future_pa"].to_numpy() / 600
    ridge_total_error = ridge_error * frame["future_pa"].to_numpy() / 600
    return {
        "sample": label,
        "n": len(frame),
        "zips_rmse_rate": baseline_rmse,
        "ridge_rmse_rate": ridge_rmse,
        "rmse_improvement_pct": 100 * (baseline_rmse - ridge_rmse) / baseline_rmse,
        "zips_mae_rate": baseline_mae,
        "ridge_mae_rate": ridge_mae,
        "mae_improvement_pct": 100 * (baseline_mae - ridge_mae) / baseline_mae,
        "zips_rmse_war": math.sqrt(float(np.mean(baseline_total_error**2))),
        "ridge_rmse_war": math.sqrt(float(np.mean(ridge_total_error**2))),
    }


def clustered_bootstrap(
    frame: pd.DataFrame, iterations: int, seed: int = 20260716
) -> dict[str, float]:
    rng = random.Random(seed)
    ids = sorted(frame["playerid"].unique())
    by_id = {pid: frame[frame["playerid"] == pid] for pid in ids}
    improvements = []
    for _ in range(iterations):
        sample = pd.concat([by_id[rng.choice(ids)] for _ in ids], ignore_index=True)
        row = metric_row(sample, "bootstrap")
        improvements.append(row["rmse_improvement_pct"])
    return {
        "low": float(np.percentile(improvements, 2.5)),
        "median": float(np.percentile(improvements, 50)),
        "high": float(np.percentile(improvements, 97.5)),
        "probability_positive": float(np.mean(np.asarray(improvements) > 0)),
        "probability_over_2pct": float(np.mean(np.asarray(improvements) >= 2)),
    }


def evaluate_subsets(test: pd.DataFrame) -> pd.DataFrame:
    disagreement = test["war_rate_gap"].abs().quantile(0.75)
    subsets = {
        "all holdout": test,
        "2025-06-30": test[test["snapshot"] == "2025-06-30"],
        "2025-07-31": test[test["snapshot"] == "2025-07-31"],
        "age <= 25": test[test["age"] <= 25],
        "ZiPS >= 3 WAR/600": test[test["zips_rate"] >= 3],
        "largest YTD disagreement": test[test["war_rate_gap"].abs() >= disagreement],
    }
    return pd.DataFrame(
        metric_row(frame, label) for label, frame in subsets.items() if len(frame) >= 20
    )


def robustness_checks(train: pd.DataFrame, test: pd.DataFrame) -> pd.DataFrame:
    """Diagnostics fixed before viewing individual-player holdout misses.

    These variants are robustness checks, not candidates selected on the 2025
    holdout.  The production gate remains attached to the primary full model.
    """
    feature_sets = {
        "full": FEATURES,
        "simple WAR gap": ("age", "log_ytd_pa", "war_rate_gap"),
        "component only": (
            "age",
            "log_ytd_pa",
            "bb_rate_gap",
            "k_rate_gap",
            "iso_gap",
            "xwoba_gap",
            "barrel_rate",
            "hard_hit_rate",
        ),
        "compact mixed": (
            "age",
            "log_ytd_pa",
            "war_rate_gap",
            "xwoba_gap",
            "bb_rate_gap",
            "k_rate_gap",
        ),
    }
    rows = []
    for label, features in feature_sets.items():
        alpha, _ = select_alpha(train, features)
        model = make_pipeline(alpha)
        model.fit(
            train.loc[:, features],
            train["target_correction"],
            ridge__sample_weight=np.minimum(train["future_pa"], 300),
        )
        evaluated = test.copy()
        evaluated["ridge_correction"] = model.predict(evaluated.loc[:, features])
        evaluated["ridge_rate"] = (
            evaluated["zips_rate"] + evaluated["ridge_correction"]
        )
        primary = metric_row(evaluated, label)
        primary.update(
            {
                "variant": label,
                "alpha": alpha,
                "correction_p95": evaluated["ridge_correction"].abs().quantile(0.95),
                "correction_max": evaluated["ridge_correction"].abs().max(),
            }
        )
        rows.append(primary)

        if label == "full":
            for cap in (1.0, 1.5, 2.0, 3.0):
                capped = evaluated.copy()
                capped["ridge_correction"] = capped["ridge_correction"].clip(-cap, cap)
                capped["ridge_rate"] = capped["zips_rate"] + capped["ridge_correction"]
                capped_row = metric_row(capped, f"full, correction cap {cap:g}")
                capped_row.update(
                    {
                        "variant": f"full, correction cap {cap:g}",
                        "alpha": alpha,
                        "correction_p95": capped["ridge_correction"].abs().quantile(0.95),
                        "correction_max": capped["ridge_correction"].abs().max(),
                    }
                )
                rows.append(capped_row)
    return pd.DataFrame(rows)


def print_frame(frame: pd.DataFrame, digits: int = 3) -> None:
    with pd.option_context(
        "display.max_columns", None,
        "display.width", 180,
        "display.max_colwidth", 28,
    ):
        print(frame.round(digits).to_string(index=False))


def main() -> None:
    args = parse_args()
    frames = []
    frames_by_snapshot = {}
    for snapshot in SNAPSHOTS:
        frame = build_snapshot_frame(snapshot, args.cache_dir, args.refresh)
        frames.append(frame)
        frames_by_snapshot[snapshot.key] = frame
        print(f"Loaded {snapshot.key}: {len(frame)} matched hitters")
    data = pd.concat(frames, ignore_index=True)
    train = data[data["split"] == "train"].copy()
    test = data[data["split"] == "test"].copy()

    alpha, cv_results = select_alpha(train)
    print("\nAlpha selection (training snapshots only)")
    print_frame(cv_results)

    model = make_pipeline(alpha)
    model.fit(
        train.loc[:, FEATURES],
        train["target_correction"],
        ridge__sample_weight=np.minimum(train["future_pa"], 300),
    )
    test["ridge_correction"] = model.predict(test.loc[:, FEATURES])
    test["ridge_rate"] = test["zips_rate"] + test["ridge_correction"]

    print(f"\nSelected alpha: {alpha:g}")
    print("\nOut-of-time 2025 holdout")
    metrics = evaluate_subsets(test)
    print_frame(metrics)

    print("\nFeature and correction-size robustness checks")
    robustness = robustness_checks(train, test)
    print_frame(
        robustness[
            [
                "variant",
                "alpha",
                "rmse_improvement_pct",
                "mae_improvement_pct",
                "zips_rmse_war",
                "ridge_rmse_war",
                "correction_p95",
                "correction_max",
            ]
        ]
    )

    print("\nPrimary model under stricter playing-time thresholds")
    stricter = []
    for minimum_ytd, minimum_future in ((75, 75), (100, 75), (150, 75), (150, 100)):
        subset = test[
            (test["ytd_pa"] >= minimum_ytd)
            & (test["future_pa"] >= minimum_future)
        ]
        row = metric_row(
            subset, f"YTD >= {minimum_ytd}, future >= {minimum_future} PA"
        )
        stricter.append(row)
    print_frame(pd.DataFrame(stricter))

    interval = clustered_bootstrap(test, args.bootstrap)
    print("\nPlayer-clustered bootstrap, pooled 2025 RMSE-rate improvement")
    print(json.dumps(interval, indent=2))

    ridge = model.named_steps["ridge"]
    transformed_names = model.named_steps["imputer"].get_feature_names_out(FEATURES)
    coefficients = pd.DataFrame(
        {"feature": transformed_names, "standardized_coefficient": ridge.coef_}
    ).sort_values("standardized_coefficient", key=lambda s: s.abs(), ascending=False)
    print("\nFitted ridge correction coefficients")
    print_frame(coefficients)

    examples = test.assign(abs_correction=test["ridge_correction"].abs()).nlargest(
        15, "abs_correction"
    )[
        [
            "snapshot",
            "player",
            "age",
            "ytd_pa",
            "zips_rate",
            "ridge_rate",
            "future_rate",
            "ridge_correction",
        ]
    ]
    print("\nLargest holdout corrections")
    print_frame(examples)

    print("\nBuilding following-season audit")
    future_frames = []
    for audit in FUTURE_AUDITS:
        future_frame = build_future_audit_frame(
            audit,
            frames_by_snapshot[audit.snapshot_key],
            args.cache_dir,
            args.refresh,
        )
        future_frames.append(future_frame)
        print(
            f"Loaded {audit.snapshot_key} -> {audit.target_season}: "
            f"{len(future_frame)} matched hitters"
        )
    future_data = pd.concat(future_frames, ignore_index=True)
    future_train = future_data[future_data["future_split"] == "train"].copy()
    future_test = future_data[future_data["future_split"] == "test"].copy()
    future_alpha, future_cv = select_future_alpha(future_train)
    print("\nFollowing-season ridge alpha selection (2023 players only)")
    print_frame(future_cv)
    future_model = make_pipeline(future_alpha)
    future_model.fit(
        future_train.loc[:, FUTURE_FEATURES],
        future_train["next_target_correction"],
        ridge__sample_weight=np.minimum(future_train["next_actual_pa"], 600),
    )
    future_test["carry85_rate"] = (
        future_test["future_zips_rate"] + 0.85 * future_test["signal_rate"]
    )
    future_test["future_ridge_correction"] = future_model.predict(
        future_test.loc[:, FUTURE_FEATURES]
    )
    future_test["future_ridge_rate"] = (
        future_test["future_zips_rate"]
        + future_test["future_ridge_correction"].clip(-1.5, 1.5)
    )
    learned_carry, carry_grid = carry_sensitivity(future_train, future_test)
    print(
        "\nFollowing-season carry sensitivity "
        f"(2023-trained no-intercept coefficient: {learned_carry:.3f})"
    )
    print_frame(carry_grid)
    component_carry, component_grid = component_signal_sensitivity(
        future_train, future_test
    )
    print(
        "\nFollowing-season component-signal sensitivity "
        f"(2023-trained coefficients: {component_carry})"
    )
    print_frame(component_grid)
    checkpoint_rows = []
    for checkpoint in ("2024-05-15", "2024-08-25"):
        _, checkpoint_grid = component_signal_sensitivity(
            future_train,
            future_test[future_test["future_audit"] == checkpoint],
        )
        chosen = checkpoint_grid[
            checkpoint_grid["variant"].isin(
                (
                    "published future ZiPS",
                    "50% total WAR signal",
                    "50% guarded total signal",
                    "50% guarded + YTD direction",
                    "50% guarded + soft YTD direction",
                )
            )
        ].copy()
        chosen.insert(0, "checkpoint", checkpoint)
        checkpoint_rows.append(chosen)
    print("\nFollowing-season guarded signal by checkpoint")
    print_frame(pd.concat(checkpoint_rows, ignore_index=True))
    print("\nFollowing-season guarded-signal player-clustered bootstrap")
    print(
        json.dumps(
            component_signal_bootstrap(future_test, args.bootstrap),
            indent=2,
        )
    )
    conflict = (
        future_test["offense_signal_rate"]
        * future_test["nonoffense_signal_rate"]
        < 0
    )
    nonoffense_dominates = (
        future_test["nonoffense_signal_rate"].abs()
        > future_test["offense_signal_rate"].abs()
    )
    subgroup_rows = []
    for subgroup, frame in (
        ("catchers", future_test[future_test["position_db"].str.contains("C")]),
        ("signal conflict", future_test[conflict]),
        (
            "conflict + non-offense dominates",
            future_test[conflict & nonoffense_dominates],
        ),
        (
            "large non-offense change",
            future_test[
                future_test["nonoffense_signal_rate"].abs()
                >= future_test["nonoffense_signal_rate"].abs().quantile(0.75)
            ],
        ),
    ):
        if frame.empty:
            continue
        _, subgroup_grid = component_signal_sensitivity(future_train, frame)
        chosen = subgroup_grid[
            subgroup_grid["variant"].isin(
                (
                    "published future ZiPS",
                    "50% total WAR signal",
                    "50% offense only",
                    "50% offense + 10% non-offense",
                    "50% offense + 25% non-offense",
                    "50% guarded total signal",
                )
            )
        ].copy()
        chosen.insert(0, "subgroup", subgroup)
        subgroup_rows.append(chosen)
    print("\nFollowing-season component-signal subgroups")
    print_frame(pd.concat(subgroup_rows, ignore_index=True))
    future_metrics = pd.DataFrame(
        [
            future_metric_row(future_test, "all 2024 -> 2025 holdout"),
            *(
                future_metric_row(
                    future_test[future_test["future_audit"] == key], key
                )
                for key in ("2024-05-15", "2024-08-25")
            ),
        ]
    )
    print("\nFollowing-season 2025 holdout")
    print_frame(future_metrics)
    print("\nFollowing-season player-clustered bootstrap")
    future_interval = future_clustered_bootstrap(
        future_test, args.bootstrap, seed=20260718
    )
    print(json.dumps(future_interval, indent=2))
    future_examples = future_test.assign(
        abs_ridge_correction=future_test["future_ridge_correction"].abs()
    ).nlargest(12, "abs_ridge_correction")
    print("\nLargest following-season ridge corrections")
    print_frame(
        future_examples[
            [
                "future_audit",
                "player",
                "age",
                "signal_rate",
                "future_zips_rate",
                "carry85_rate",
                "future_ridge_rate",
                "next_actual_rate",
            ]
        ]
    )

    all_holdout = metrics[metrics["sample"] == "all holdout"].iloc[0]
    checkpoints = metrics[metrics["sample"].isin(("2025-06-30", "2025-07-31"))]
    robust_gate = bool(
        all_holdout["rmse_improvement_pct"] >= 2
        and all_holdout["mae_improvement_pct"] > 0
        and interval["low"] > 0
        and (checkpoints["rmse_improvement_pct"] > 0).all()
    )
    print("\nConservative production gate")
    print(
        json.dumps(
            {
                "same_season_gate_passed": robust_gate,
                "required": {
                    "pooled_rmse_improvement_pct": ">= 2",
                    "pooled_mae_improvement_pct": "> 0",
                    "clustered_bootstrap_95pct_low": "> 0",
                    "each_2025_checkpoint_rmse_improvement_pct": "> 0",
                },
                "future_year_gate_passed": bool(
                    (
                        future_metrics[
                            future_metrics["sample"].isin(
                                ("2024-05-15", "2024-08-25")
                            )
                        ]["ridge_rmse_improvement_pct"]
                        > 0
                    ).all()
                    and future_metrics.iloc[0]["ridge_rmse_improvement_pct"] >= 2
                    and future_interval["ridge"]["low"] > 0
                ),
                "future_year_reason": (
                    "The future-year gate uses 2023 player data for training and "
                    "holds out both 2024 checkpoints and the entire 2025 season. "
                    "It still represents only one independent target season."
                ),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
