"""Build the public Ballpark Fit data from checked Statcast records and a completed audit."""

import argparse
import hashlib
import itertools
import json
from pathlib import Path

import numpy as np
import pandas as pd
from threadpoolctl import threadpool_limits

from inputs import (CODES, MODES, NON_AB, REPLAY_SEASONS, RUNS_PER_WIN, RUN_WEIGHTS,
                    SAC_FLIES, WOBA_SCALE, WOBA_WEIGHTS, dimensions, schedule, stat_counts)
from model import fit_models, non_hr, typical_values, with_park

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_HITTER = "673548"
HALF_PA = 300
SAVANT_SOURCE = ("https://baseballsavant.mlb.com/leaderboard/home-runs"
                 "?type=details&player_id={player_id}&year={year}&player_type=Batter&cat={cat}")
# Official game feeds supply the two same-game matches and one missing chart point.
PLAY_AT_BAT = {"ce2aa285-efc4-3528-a863-470968ea37c0": 19, "ed5413ee-adf5-39fd-881f-84b27c416c8f": 35}
LOCATION_PLAY = "dfef569d-7877-33ee-aac1-ad3373dc4975"


def read_flags(path, rows, codes, category):
    year, batter = map(int, path.stem.split("-"))
    games = set(rows.game_pk)
    plays = [p for p in json.loads(path.read_bytes()) if int(p["game_pk"]) in games]
    assert len({p["play_id"] for p in plays}) == len(plays)
    matched = {}
    for p in plays:
        assert int(p["batter_id"]) == batter and int(p["year"]) == year and p["cat"] == category
        assert all(p[c] in ("0", "1") for c in codes), (year, p["play_id"])
        close = rows.loc[
            rows.game_pk.eq(int(p["game_pk"])) & rows.pitcher.eq(int(p["pitcher_id"]))
            & rows.events.eq(p["result"])
            & rows.launch_speed.sub(float(p["exit_velocity"])).abs().le(.51)
            & rows.launch_angle.sub(float(p["launch_angle"])).abs().le(.51)
        ]
        if p["play_id"] in PLAY_AT_BAT:
            close = close.loc[close.at_bat_number.eq(PLAY_AT_BAT[p["play_id"]])]
        assert len(close) == 1, (p["play_id"], len(close))
        i = close.index[0]
        assert i not in matched
        matched[i] = p
    return matched


def batting_line(hits, ab, obp_den, obp_free, woba_den, walks, hbp):
    return {
        "slash": [round(float(hits.sum() / ab), 6), round(float((hits.sum() + obp_free) / obp_den), 6),
                  round(float(hits @ np.arange(1, 5) / ab), 6)],
        "woba": round(float((hits @ WOBA_WEIGHTS[1:] + .691 * walks + .722 * hbp) / woba_den), 6),
        "hits": hits.round(5).tolist(),
    }


def uncertainty(game_values, game_pa, codes):
    # Paired hitter-game bootstrap, conditional on the fitted in-play model.
    rng = np.random.default_rng(610)
    draws = rng.multinomial(len(game_pa), np.full(len(game_pa), 1 / len(game_pa)), size=2000)
    rates = (draws @ game_values) / (draws @ game_pa)[:, None] * HALF_PA
    pairs = list(itertools.combinations(range(len(codes)), 2))
    i, j = np.array(pairs).T
    ranges = np.quantile(rates[:, j] - rates[:, i], [.025, .975], axis=0).T
    return ranges.round(3).tolist()


def range_between(ranges, count, origin, destination):
    if origin == destination:
        return [0., 0.]
    i, j = sorted((origin, destination))
    lo, hi = ranges[i * (2 * count - i - 1) // 2 + j - i - 1]
    return [lo, hi] if origin < destination else [-hi, -lo]


def prepare_contact(rows, flags, codes):
    contact = rows.copy()
    available = set(flags["adjusted"]) & set(flags["standard"])
    # A home run with no record in either Savant mode stays fixed in both modes.
    excluded = rows.y.eq(4) & ~rows.index.isin(available)
    for i, p in flags["adjusted"].items():
        if p["play_id"] == LOCATION_PLAY:
            # Use the official play chart coordinates, from game 777401.
            spray = .75 * np.degrees(np.arctan2(1.0 - 125.42, 198.27 - 99.07))
            contact.loc[i, ["supported", "spray", "zone"]] = [True, spray, 0]
    for mode, plays in flags.items():
        for i, p in plays.items():
            if not contact.at[i, "supported"]:
                assert all((p[c] == "1") == (p["result"] == "home_run") for c in codes), (mode, p["play_id"])
    return contact.loc[contact.supported & ~excluded], int(excluded.sum())


def player_replay(rows, flags, player, parks, typical, model):
    codes = [p["id"] for p in parks]
    contact, untracked_hr = prepare_contact(rows, flags, codes)
    road = rows.loc[rows.road & rows.primary]
    home = rows.loc[~rows.road & rows.primary]
    home_counts = home.venue.value_counts()
    origin = next(p["id"] for p in parks if p["venue"] == home_counts.index[0])
    assert len(road) >= 60 and len(contact) >= 100, (player, len(road), len(contact))
    road_counts, full_counts = stat_counts(road), stat_counts(rows)
    home_scale, road_scale = HALF_PA / len(rows), HALF_PA / len(road)
    rates = {k: full_counts[k] * home_scale + road_counts[k] * road_scale
             for k in ["ab", "obpDen", "obpFree", "wobaDen", "walks", "hbp"]}
    fixed_hits = road_counts["hits"] * road_scale + stat_counts(rows.loc[~rows.index.isin(contact.index)])["hits"] * home_scale
    actual = batting_line(full_counts["hits"], full_counts["ab"], full_counts["obpDen"],
                          full_counts["obpFree"], full_counts["wobaDen"], full_counts["walks"], full_counts["hbp"])
    game_index, games = pd.factorize(rows.game_pk, sort=True)
    contact_games = pd.Index(games).get_indexer(contact.game_pk)
    game_pa = np.bincount(game_index, minlength=len(games))
    game_side = np.column_stack([np.bincount(contact_games, weights=contact.righty.eq(side),
                                            minlength=len(games)) for side in [0, 1]])
    generic_games = game_side @ np.array([typical[c] for c in codes]).T
    mode_values = {name: np.zeros((len(games), len(codes))) for name in MODES}
    mode_lines = {name: [] for name in MODES}
    in_play = {}
    base = model.base(contact)
    sf = contact.events.isin(SAC_FLIES).to_numpy()
    side = np.bincount(contact.righty, minlength=2) * home_scale
    for k, park in enumerate(parks):
        code = park["id"]
        dest = with_park(contact, park)
        p = non_hr(model.probability(dest, base))
        in_play[code] = pd.DataFrame(p, index=contact.index)
        for mode, plays in flags.items():
            hrs = pd.Series({i: v[code] == "1" for i, v in plays.items()}).reindex(contact.index, fill_value=False)
            hr = hrs.to_numpy(dtype=bool)
            hybrid = np.column_stack([p * (~hr[:, None]), hr])
            assert np.allclose(hybrid.sum(axis=1), 1)
            hits = fixed_hits + hybrid[:, 1:].sum(axis=0) * home_scale
            # A recorded sacrifice fly becomes an AB only when the replay credits a hit.
            ab = rates["ab"] + (1 - hybrid[sf, 0]).sum() * home_scale
            row = batting_line(hits, ab, rates["obpDen"], rates["obpFree"], rates["wobaDen"],
                               rates["walks"], rates["hbp"])
            per_ball = hybrid @ RUN_WEIGHTS
            mode_values[mode][:, k] = np.bincount(contact_games, weights=per_ball, minlength=len(games))
            row["runs"] = round(float(per_ball.sum() * home_scale), 6)
            row["hrFlags"] = int(hr.sum())
            mode_lines[mode].append(row)
    events = []
    for i in sorted(set(flags["adjusted"]) | set(flags["standard"]), key=lambda i: rows.at[i, "date"]):
        if i not in contact.index:
            continue
        play = flags["adjusted"].get(i) or flags["standard"][i]
        clears = {mode: [c for c in codes if flags[mode].get(i, {}).get(c) == "1"] for mode in MODES}
        if all(len(v) in (0, len(codes)) for v in clears.values()):
            continue
        measured = contact.loc[i]
        events.append({
            "id": play["play_id"], "date": play["game_date"], "result": play["result"],
            "ev": float(measured.launch_speed), "la": int(measured.launch_angle),
            "spray": round(float(measured.spray), 1),
            "distance": int(measured.hit_distance_sc) if pd.notna(measured.hit_distance_sc) else None,
            "clears": clears,
            "inPlay": {c: in_play[c].loc[i].round(4).tolist() for c in codes
                       if any(c not in v for v in clears.values())},
        })
    points = contact.loc[contact.hit_distance_sc.between(1, 500), ["spray", "hit_distance_sc"]].round(1)
    return {
        "id": player["id"].removeprefix("mlb-"), "name": player["name"], "year": int(rows.year.iloc[0]),
        "samplePa": len(rows), "measuredContact": len(contact), "roadPa": len(road),
        "home": origin, "homePa": int(home_counts.iloc[0]), "totalHomePa": len(home),
        "actual": actual, "wobaDen": round(rates["wobaDen"], 5), "fixedHomeRuns": untracked_hr,
        "generic": [round(float(np.asarray(typical[p["id"]]) @ side), 6) for p in parks],
        "modes": {mode: {"parks": mode_lines[mode], "ranges": uncertainty(mode_values[mode], game_pa, codes),
                         "extraRanges": uncertainty(mode_values[mode] - generic_games, game_pa, codes)}
                  for mode in MODES},
        "points": points.to_numpy().tolist(), "plays": events,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--analysis", required=True, type=Path)
    parser.add_argument("--inputs", required=True, type=Path)
    parser.add_argument("--pa", required=True, type=Path)
    parser.add_argument("--study", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=ROOT)
    args = parser.parse_args()
    tracker = json.loads((ROOT / "app/data/free-agent-tracker.json").read_text())
    hitters = [p for p in tracker["players"] if p.get("publishedForecast") and
               p["role"] == "position" and p["id"].startswith("mlb-")]
    hitters.sort(key=lambda p: (p["id"] != f"mlb-{DEFAULT_HITTER}", p["name"]))
    history = pd.read_parquet(args.pa)
    parks_by_year = dimensions(args.inputs, {y: schedule(args.analysis, y) for y in range(2023, 2027)})
    study = json.loads(args.study.read_text())
    provenance = {}
    examples = {}
    data_dir = args.out / "public/data/park-fit"
    data_dir.mkdir(parents=True, exist_ok=True)
    for year in REPLAY_SEASONS:
        parks = sorted(parks_by_year[year].values(), key=lambda p: p["id"])
        codes = [p["id"] for p in parks]
        # Use only visiting defense for the park calibration. Exclude the
        # displayed hitters from the fit, including from the shared model.
        omitted = [int(p["id"].removeprefix("mlb-")) for p in hitters]
        training = history.loc[history.year.le(year) & history.primary & history.supported
                               & ~history.batter.isin(omitted)]
        prior = study["prior"]
        with threadpool_limits(limits=4):
            model = fit_models(training, [prior], wall=study["wallPass"], visiting_defense=True)[prior]
            typical = typical_values(model, training, parks_by_year[year])
            for player in hitters:
                id = player["id"].removeprefix("mlb-")
                rows = history.loc[history.year.eq(year) & history.batter.eq(int(id))]
                paths = {mode: args.inputs / mode / f"{year}-{id}.json" for mode in MODES}
                flags = {mode: read_flags(path, rows, codes, MODES[mode]) for mode, path in paths.items()}
                result = player_replay(rows, flags, player, parks, typical, model)
                (data_dir / f"{year}-{id}.json").write_text(json.dumps(result, separators=(",", ":")) + "\n")
                provenance[f"{year}-{id}"] = {mode: hashlib.sha256(path.read_bytes()).hexdigest()
                                                for mode, path in paths.items()}
                if year == 2026:
                    adjusted = result["modes"]["adjusted"]
                    home, boston = codes.index(result["home"]), codes.index("bos")
                    examples[id] = {
                        "home": result["home"], "runs": [p["runs"] for p in adjusted["parks"]],
                        "fenwayRange": range_between(adjusted["ranges"], len(codes), home, boston),
                    }
                print(year, player["name"], result["home"], result["samplePa"], result["measuredContact"], flush=True)
    park_metadata = {year: sorted(parks_by_year[year].values(), key=lambda p: p["id"]) for year in REPLAY_SEASONS}
    index = {"seasons": list(REPLAY_SEASONS), "referencePa": 600,
             "wobaScale": WOBA_SCALE, "runsPerWin": RUNS_PER_WIN, "runWeights": RUN_WEIGHTS.tolist(),
             "parks": park_metadata,
             "players": [{"id": p["id"].removeprefix("mlb-"), "name": p["name"]} for p in hitters],
             "study": {k: v for k, v in study.items() if k != "calibration"},
             "examples": examples,
             "source": {"savant": SAVANT_SOURCE, "sha256": provenance,
                        "dimensions": "https://baseballsavant.mlb.com/leaderboard/statcast-park-factors?type=dimensions&year={year}"}}
    (args.out / "app/data/park-fit.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
