"""Public Statcast contact and season-specific venue inputs for Ballpark Fit."""

import json
import re
import argparse
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

# Baseball Savant uses these keys in its individual HR replay records.
CODES = dict(zip(
    [108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 133,
     134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 158],
    "laa ari bal bos chc cin cle col det hou kc lad wsh nym oak pit sd sea sf stl tb tex tor min phi atl cws mia nyy mil".split(),
))
SEASONS = range(2023, 2027)
REPLAY_SEASONS = (2026, 2025)
MODES = {"adjusted": "adj_xhr", "standard": "xhr"}
POINTS = ("lf_line", "lf_gap", "cf", "rf_gap", "rf_line")
FENCE_ANGLES = [-45, -22.5, 0, 22.5, 45]
HIT_TYPES = {"single": 1, "double": 2, "triple": 3, "home_run": 4}
SAC_FLIES = {"sac_fly", "sac_fly_double_play"}
BUNTS = {"sac_bunt", "sac_bunt_double_play"}
NON_AB = {"walk", "intent_walk", "hit_by_pitch", "catcher_interf"} | BUNTS | SAC_FLIES
OBP_EXCLUDE = {"catcher_interf"} | BUNTS
WOBA_EXCLUDE = OBP_EXCLUDE | {"intent_walk"}
WOBA_SCALE = 1.232
RUNS_PER_WIN = 9.774
WOBA_WEIGHTS = np.array([0, .882, 1.252, 1.584, 2.037])
RUN_WEIGHTS = WOBA_WEIGHTS / WOBA_SCALE
COLUMNS = ["game_type", "game_date", "game_pk", "at_bat_number", "pitch_number", "batter",
           "pitcher", "events", "type", "stand", "p_throws", "launch_speed", "launch_angle",
           "hc_x", "hc_y", "inning_topbot", "hit_distance_sc", "des"]


def schedule(analysis, year):
    project = "innings_eater" if year == 2026 else "starter_reliever_contrast"
    src = analysis / project / f"data/validation/schedule_{year}.json"
    days = json.loads(src.read_text())["dates"]
    games = {}
    for day in days:
        for game in day["games"]:
            if game["gameType"] != "R":
                continue
            home = game["teams"]["home"]["team"]["id"]
            venue = game["venue"]["id"]
            games[int(game["gamePk"])] = (home, venue)
    counts = Counter(games.values())
    primary = {}
    for home, venue in games.values():
        if home not in primary or counts[home, venue] > counts[home, primary[home]]:
            primary[home] = venue
    assert set(primary) == set(CODES)
    return games, primary


def dimensions(inputs, schedules):
    by_year = {}
    for year in SEASONS:
        path = inputs / f"dimensions-{year}.html"
        raw = json.loads(re.search(r"var data = (\[.*?\]);", path.read_text()).group(1))
        rows = {int(park["venue_id"]): park for park in raw}
        by_year[year] = {}
        for team, venue in schedules[year][1].items():
            park = rows[venue]
            by_year[year][venue] = {
                "id": CODES[team], "name": park["venue_name_short"], "venue": venue,
                "distances": [round(park[f"distance_{point}"], 1) for point in POINTS],
                "heights": [round(park[f"height_{point}"], 1) for point in POINTS],
                "changed": bool(park["is_diff_configuration"]),
            }
    # Preserve a regime through a skipped year if the measurements agree.
    latest = {}
    for year, parks in by_year.items():
        for venue, park in parks.items():
            previous = latest.get(venue)
            changed = previous is not None and (
                max(abs(a - b) for a, b in zip(park["distances"], previous["distances"])) >= 4
                or max(abs(a - b) for a, b in zip(park["heights"], previous["heights"])) >= 2
            )
            park["regime"] = f"{venue}:{year}" if previous is None or changed else previous["regime"]
            latest[venue] = park
    return by_year


def cache_sources(cache):
    sources = {}
    for path in cache.glob("get_statcast_data_from_csv_url*.cache_record.json"):
        record = json.loads(path.read_text())
        match = re.search(r"game_date_gt=(202[345]-\d\d-\d\d)&game_date_lt=\1", record["args"][0])
        if match:
            file = Path(record["dataframe"])
            if file.exists():
                sources[match[1]] = file
    return sources


def plate_appearances(data):
    contact = data.type.eq("X") & data.events.notna()
    pa = contact | data.events.isin(NON_AB | {"strikeout", "strikeout_double_play"})
    rows = data.loc[data.game_type.eq("R") & pa].copy()
    rows["contact"] = rows.type.eq("X")
    return rows


def load_year(analysis, files, year, games, primary, parks):
    if year == 2026:
        base = analysis / "attackability/data/processed/statcast_2026.parquet"
        late = analysis / "deception_residual/data/outcomes_2026/raw"
        parts = [plate_appearances(pd.read_parquet(base, columns=COLUMNS))]
        parts.extend(plate_appearances(pd.read_csv(f, usecols=COLUMNS, low_memory=False))
                     for f in sorted(late.glob("statcast_*.csv.gz")))
    else:
        parts = [plate_appearances(pd.read_parquet(f, columns=COLUMNS))
                 for day, f in sorted(files.items()) if day.startswith(str(year))]
    rows = pd.concat(parts, ignore_index=True)
    key = ["game_pk", "at_bat_number"]
    rows = rows.drop_duplicates(key + ["pitch_number"])
    assert not rows.duplicated(key).any()
    rows["date"] = pd.to_datetime(rows.game_date, format="mixed")
    rows["game_date"] = rows.date.dt.strftime("%Y-%m-%d")
    assert rows.date.dt.year.eq(year).all()
    assert rows.game_pk.isin(games).all(), (year, rows.loc[~rows.game_pk.isin(games), "game_pk"].unique()[:5])
    rows["venue"] = rows.game_pk.map({game: venue for game, (_, venue) in games.items()})
    rows["primary"] = rows.game_pk.map({game: primary[home] == venue for game, (home, venue) in games.items()})
    rows["regime"] = rows.venue.map({venue: park["regime"] for venue, park in parks.items()}).fillna("")
    rows["road"] = rows.inning_topbot.eq("Top")
    # Coordinates are chart positions, not launch vectors. Calibrate to field direction.
    rows["spray"] = .75 * np.degrees(np.arctan2(
        rows.hc_x.astype(float) - 125.42, 198.27 - rows.hc_y.astype(float)
    ))
    rows["righty"] = rows.stand.eq("R").astype(int)
    rows["pitcher_righty"] = rows.p_throws.eq("R").astype(int)
    rows["supported"] = (rows.contact & ~rows.events.isin(BUNTS) & rows.spray.abs().le(50)
                         & rows.launch_speed.notna() & rows.launch_angle.notna()
                         & rows.stand.isin(["L", "R"]) & rows.p_throws.isin(["L", "R"]))
    rows["year"] = year
    rows["y"] = rows.events.map(HIT_TYPES).fillna(0).astype(int)
    rows["zone"] = np.digitize(rows.spray, [-30, -15, 15, 30])
    rows["height"] = np.digitize(rows.launch_angle, [10, 25, 45])
    rows["hard"] = rows.launch_speed.ge(95).astype(int)
    rows["wall_text"] = rows.des.fillna("").str.contains(
        r"\boff (?:the )?(?:outfield wall|wall|green monster)\b", case=False, regex=True
    )
    distance = np.full(len(rows), np.nan)
    height = distance.copy()
    for venue, index in rows.groupby("venue").indices.items():
        if venue in parks:
            park = parks[venue]
            direction = rows.spray.iloc[index].to_numpy()
            distance[index] = np.interp(direction, FENCE_ANGLES, park["distances"])
            height[index] = np.interp(direction, FENCE_ANGLES, park["heights"])
    rows["fence_distance"] = distance
    rows["fence_height"] = height
    coverage = {"year": year, "games": int(rows.game_pk.nunique()), "pa": len(rows),
                "contact": int(rows.supported.sum()), "first": str(rows.date.min().date()),
                "last": str(rows.date.max().date())}
    print(coverage, flush=True)
    return rows, coverage


def stat_counts(rows):
    hits = np.bincount(rows.y, minlength=5)[1:]
    return dict(pa=len(rows), ab=int((~rows.events.isin(NON_AB)).sum()),
                obpDen=int((~rows.events.isin(OBP_EXCLUDE)).sum()),
                wobaDen=int((~rows.events.isin(WOBA_EXCLUDE)).sum()),
                walks=int(rows.events.eq("walk").sum()), hbp=int(rows.events.eq("hit_by_pitch").sum()),
                obpFree=int(rows.events.isin(["walk", "intent_walk", "hit_by_pitch"]).sum()),
                hits=hits)


def season_inputs(analysis, cache, inputs):
    schedules = {year: schedule(analysis, year) for year in SEASONS}
    parks = dimensions(inputs, schedules)
    sources = cache_sources(cache)
    data, coverage = zip(*(load_year(analysis, sources, year, *schedules[year], parks[year])
                           for year in SEASONS))
    return pd.concat(data, ignore_index=True), parks, schedules, coverage


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--analysis", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--inputs", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    data, _, _, _ = season_inputs(args.analysis, args.cache, args.inputs)
    data.to_parquet(args.out)
