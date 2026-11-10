"""Evaluate conditional outcomes, movers and the stability of hitter-by-park effects."""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from threadpoolctl import threadpool_limits

from inputs import REPLAY_SEASONS, RUN_WEIGHTS, WOBA_SCALE, WOBA_WEIGHTS, WOBA_EXCLUDE, dimensions, schedule
from model import (PRIORS, bootstrap_error, calibrate_models, fit_models, log_loss, non_hr,
                   predict_carry, typical_values, with_park)

# Gates specified before running the expanded audit.
MIN_HOME_PA = 200
MIN_ROAD_PA = 120
PRIMARY_SHARE = .80
MOVER_MIN_RELATIVE_GAIN = .005
WALL_MIN_RELATIVE_GAIN = .005


def loss_summary(rows, forecasts, base_name):
    losses = {name: log_loss(rows.y, p) for name, p in forecasts.items()}
    return {"n": len(rows), "loss": {name: float(v.mean()) for name, v in losses.items()},
            "difference95": {name: bootstrap_error(rows, v - losses[base_name], "game_pk")
                             for name, v in losses.items() if name != base_name}}


def score_non_hr(rows, models):
    if rows.empty:
        return {"n": 0}
    return loss_summary(rows, {name: non_hr(p) for name, p in models.items()}, "hand")


def eligible_years(history, parks):
    summaries = {}
    for (year, batter), rows in history.loc[history.primary].groupby(["year", "batter"]):
        home = rows.loc[~rows.road]
        road = rows.loc[rows.road]
        if len(road) < MIN_ROAD_PA or len(home) < MIN_HOME_PA:
            continue
        counts = home.venue.value_counts()
        venue = int(counts.index[0])
        if counts.iloc[0] < len(home) * PRIMARY_SHARE or venue not in parks[year]:
            continue
        selected_home = home.loc[home.venue.eq(venue)]
        if len(selected_home) < MIN_HOME_PA:
            continue
        summaries[year, int(batter)] = (venue, selected_home, road)
    return summaries


def observed_woba(rows):
    return rows.woba_value_model.sum() / rows.woba_den.sum()


def mover_study(history, models, wall_models, contacts, parks):
    # The score uses the change in home-minus-road wOBA. Future road outcomes
    # form part of the target; they are never a feature.
    rows = history.copy()
    rows["woba_value_model"] = WOBA_WEIGHTS[rows.y] + .691 * rows.events.eq("walk") + .722 * rows.events.eq("hit_by_pitch")
    rows["woba_den"] = ~rows.events.isin(WOBA_EXCLUDE)
    eligible = eligible_years(rows, parks)
    results = []
    for year, model in models.items():
        next_parks = parks[year + 1]
        train = contacts.loc[contacts.year.le(year)]
        typical = typical_values(model, train, next_parks)
        for y, batter in eligible:
            if y != year or (year + 1, batter) not in eligible:
                continue
            origin, home_before, road_before = eligible[y, batter]
            destination, home_after, road_after = eligible[y + 1, batter]
            if origin == destination or origin not in next_parks:
                continue
            from_park, to_park = next_parks[origin], next_parks[destination]
            # New fence configurations and a franchise moving between parks
            # have no ordinary handed factor in the training window.
            known = set(model.main.index.get_level_values("regime"))
            if from_park["regime"] not in known or to_park["regime"] not in known:
                continue
            prior = rows.loc[rows.year.eq(year) & rows.batter.eq(batter)]
            two_years = rows.loc[rows.year.between(year - 1, year) & rows.batter.eq(batter)]
            three_years = rows.loc[rows.year.between(year - 2, year) & rows.batter.eq(batter)]
            observed = (observed_woba(home_after) - observed_woba(road_after)
                        - observed_woba(home_before) + observed_woba(road_before))
            estimate = {}
            for name, frame, candidate in [("single_year", prior, model), ("two_year", two_years, model),
                                           ("two_year_wall", two_years, wall_models[year]),
                                           ("three_year_wall", three_years, wall_models[year])]:
                weight = .5 ** (year - frame.year.to_numpy())
                denominator = weight @ frame.woba_den.to_numpy()
                contact = frame.loc[frame.supported]
                contact_weight = weight[frame.supported]
                p = candidate.base(contact) if candidate.carry is None else None
                origin_prob = candidate.probability(with_park(contact, from_park), p)
                dest_prob = candidate.probability(with_park(contact, to_park), p)
                delta = (dest_prob - origin_prob) @ WOBA_WEIGHTS
                estimate[name] = float(delta @ contact_weight / denominator)
            flags = prior.loc[prior.supported]
            side_counts = np.bincount(flags.righty, minlength=2)
            generic = np.subtract(typical[to_park["id"]], typical[from_park["id"]])
            handed = float(generic @ side_counts / prior.woba_den.sum() * WOBA_SCALE)
            results.append({"batter": batter, "year": year + 1, "actual": observed,
                            "hand": handed, "none": 0., **estimate})
    scored = pd.DataFrame(results)
    errors = {name: (scored[name] - scored.actual)**2
              for name in ["none", "hand", "single_year", "two_year", "two_year_wall", "three_year_wall"]}
    rmse = {name: float(np.sqrt(v.mean())) for name, v in errors.items()}
    diff = bootstrap_error(scored, errors["two_year"] - errors["hand"], "batter")
    wall_diff = bootstrap_error(scored, errors["two_year_wall"] - errors["hand"], "batter")
    three_year_diff = bootstrap_error(scored, errors["three_year_wall"] - errors["hand"], "batter")
    passed = rmse["two_year"] <= rmse["hand"] * (1 - MOVER_MIN_RELATIVE_GAIN) and diff[1] < 0
    wall_passed = rmse["two_year_wall"] <= rmse["hand"] * (1 - MOVER_MIN_RELATIVE_GAIN) and wall_diff[1] < 0
    return {"n": len(scored), "bySeason": {int(k): int(v) for k, v in scored.year.value_counts().items()},
            "rmse": rmse, "mseDifference95": diff, "twoYearPass": passed,
            "wallMseDifference95": wall_diff, "wallPass": wall_passed,
            "threeYearMseDifference95": three_year_diff,
            "threeYearPass": rmse["three_year_wall"] <= rmse["hand"] * (1 - MOVER_MIN_RELATIVE_GAIN)
            and three_year_diff[1] < 0,
            "minimumHomePa": MIN_HOME_PA, "minimumRoadPa": MIN_ROAD_PA}


def stability(history, model, parks, contacts):
    # Hold both the destination geometry and the fitted model fixed.
    recent = history.loc[history.year.isin(REPLAY_SEASONS)]
    counts = recent.groupby(["batter", "year"]).size().unstack().fillna(0)
    hitters = counts.index[(counts >= 300).all(axis=1)]
    rows = recent.loc[recent.batter.isin(hitters)]
    measured = rows.loc[rows.supported]
    base = model.base(measured)
    typical = typical_values(model, contacts.loc[contacts.year.lt(2025)], parks)
    weight = measured.groupby(["batter", "year", "righty"]).size().unstack().fillna(0)
    den = rows.groupby(["batter", "year"]).size().reindex(weight.index)
    contrasts = {}
    for park in parks.values():
        p = model.probability(with_park(measured, park), base)
        value = pd.Series(p @ RUN_WEIGHTS, index=measured.index)
        total = value.groupby([measured.batter, measured.year]).sum()
        generic = weight @ np.asarray(typical[park["id"]])
        contrasts[park["id"]] = ((total - generic) / den * 300).unstack()
    reference = contrasts["chc"]
    park_contrasts = {code: value - reference for code, value in contrasts.items() if code != "chc"}
    pairs = pd.concat(list(park_contrasts.values()))
    correlation = pairs[2025].corr(pairs[2026])
    previous = measured.loc[measured.year.eq(2025)]
    templates = {
        "nyy_left_pull_air": ("nyy", previous.righty.eq(0) & previous.spray.ge(15) & previous.launch_angle.between(20, 49)),
        "bos_right_pull_air": ("bos", previous.righty.eq(1) & previous.spray.le(-15) & previous.launch_angle.between(20, 49)),
        "bos_right_opposite_air": ("bos", previous.righty.eq(1) & previous.spray.ge(15) & previous.launch_angle.between(20, 49)),
        "sf_gap_liners": ("sf", previous.spray.abs().between(12, 30) & previous.launch_angle.between(10, 24)),
    }
    profiles = {}
    for label, (code, mask) in templates.items():
        shares = mask.groupby(previous.batter).mean()
        profiles[label] = float(shares.corr(park_contrasts[code][2026]))
    return {"hitters": len(hitters), "parkPairs": len(pairs), "correlation": float(correlation),
            "sd2025": float(pairs[2025].std()), "sd2026": float(pairs[2026].std()),
            "changeSd": float((pairs[2026] - pairs[2025]).std()),
            "byPark": {code: {"correlation": float(delta[2025].corr(delta[2026])),
                              "sd2025": float(delta[2025].std()), "sd2026": float(delta[2026].std())}
                       for code, delta in park_contrasts.items()},
            "priorProfileVsNextYearModelCorrelation": profiles}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--analysis", required=True, type=Path)
    p.add_argument("--inputs", required=True, type=Path)
    p.add_argument("--pa", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    args = p.parse_args()
    history = pd.read_parquet(args.pa)
    parks = dimensions(args.inputs, {year: schedule(args.analysis, year) for year in range(2023, 2027)})
    contacts = history.loc[history.supported & history.primary]
    train = contacts.loc[contacts.year.le(2024)]
    tune = contacts.loc[contacts.year.eq(2025) & contacts.y.lt(4)]
    test = contacts.loc[contacts.year.eq(2026) & contacts.y.lt(4)]
    with threadpool_limits(limits=4):
        candidates = fit_models(train, PRIORS)
        tuning = {prior: float(log_loss(tune.y, non_hr(model.probability(tune))).mean())
                  for prior, model in candidates.items()}
        prior = min(tuning, key=tuning.get)
        print("tuning", tuning, prior, flush=True)
        historical = contacts.loc[contacts.year.lt(2026)]
        base_model = fit_models(historical, [prior])[prior]
        wall_model = fit_models(historical, [prior], wall=True)[prior]
        visitor_model = calibrate_models(historical, base_model.surface, [prior], visiting_defense=True)[prior]
        wall_visitor = calibrate_models(historical, wall_model.surface, [prior], wall_model.carry,
                                        visiting_defense=True)[prior]
        all_prob = {"no_park": base_model.base(test), "hand": base_model.probability(test, detailed=False),
                    "spray": base_model.probability(test), "wall": wall_model.probability(test),
                    "visiting_defense": visitor_model.probability(test), "wall_visitor": wall_visitor.probability(test)}
        overall = score_non_hr(test, all_prob)
        carry = predict_carry(wall_model.carry, test)
        candidate = test.hard.eq(1) & test.launch_angle.between(8, 50)
        near = candidate & np.abs(carry - test.fence_distance).le(25)
        # Recorded distance defines a second evaluation slice. It never enters
        # the feature matrix and proximity cannot identify actual wall impacts.
        measured = candidate & (test.hit_distance_sc - test.fence_distance).abs().le(10)
        masks = {"projectedNearFence": near, "recordedWithin10ft": measured,
                 "fenwayLeftNearFence": near & test.venue.eq(3) & test.spray.lt(-15)}
        wall_scores = {name: score_non_hr(test.loc[mask], {k: v[mask] for k, v in all_prob.items()})
                       for name, mask in masks.items()}
        delta = log_loss(test.loc[near].y, non_hr(all_prob["wall_visitor"][near])) - log_loss(
            test.loc[near].y, non_hr(all_prob["visiting_defense"][near]))
        wall_ci = bootstrap_error(test.loc[near], delta, "game_pk")
        losses = wall_scores["projectedNearFence"]["loss"]
        wall_pass = (losses["wall_visitor"] <= losses["visiting_defense"] * (1 - WALL_MIN_RELATIVE_GAIN)
                     and wall_ci[1] < 0 and overall["loss"]["wall_visitor"] <= overall["loss"]["visiting_defense"])
        calibration = test[["venue", "righty", "zone", "y"]].copy()
        for i, label in enumerate(["out", "single", "double", "triple"]):
            calibration[f"observed_{label}"] = (test.y == i).astype(float)
            for key in ["hand", "spray", "wall_visitor"]:
                calibration[f"{key}_{label}"] = non_hr(all_prob[key])[:, i]
        detail = calibration.groupby(["venue", "righty", "zone"]).agg(
            n=("y", "size"), **{c: (c, "mean") for c in calibration.columns[4:]}
        ).reset_index()
        print("wall", overall, wall_scores, wall_ci, wall_pass, flush=True)
        models = {2023: fit_models(contacts.loc[contacts.year.eq(2023)], [250])[250],
                  2024: candidates[250], 2025: base_model}
        wall_models = {y: fit_models(contacts.loc[contacts.year.le(y)], [250], wall=True,
                                     visiting_defense=True)[250] for y in [2023, 2024]}
        wall_models[2025] = wall_visitor
        mover = mover_study(history, models, wall_models, contacts, parks)
        print("movers", mover, flush=True)
        repeatability = stability(history, candidates[prior], parks[2026], contacts)
        print("stability", repeatability, flush=True)
    result = {"prior": prior, "tuning": tuning, "nonHr": overall, "wall": wall_scores,
              "wallVsSprayDifference95": wall_ci, "wallPass": bool(wall_pass),
              "wallTextLabels": int(history.wall_text.sum()),
              "gates": {"minimumRelativeMoverGain": MOVER_MIN_RELATIVE_GAIN,
                        "minimumRelativeNearFenceGain": WALL_MIN_RELATIVE_GAIN,
                        "pairedIntervalMustExcludeZero": True},
              "movers": mover, "stability": repeatability,
              "calibration": detail.round(5).to_dict("records")}
    args.out.write_text(json.dumps(result, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
