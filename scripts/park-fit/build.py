"""Build the 2026 park-fit snapshot from locally cached Statcast and schedule data."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from threadpoolctl import threadpool_limits

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PARKS = {17: "Wrigley Field", 3: "Fenway Park", 3313: "Yankee Stadium",
         2602: "Great American Ball Park", 2395: "Oracle Park"}
SAVANT_CODES = {17: "chc", 3: "bos", 3313: "nyy", 2602: "cin", 2395: "sf"}
CURRENT_HITTER = 673548
OUTCOMES = ["nonhit", "single", "double", "triple", "home_run"]
HIT_TYPES = dict(zip(OUTCOMES[1:], range(1, 5)))
FEATURES = ["launch_speed", "launch_angle", "spray", "righty", "pitcher_righty"]
SOURCE = ["game_type", "game_date", "game_pk", "at_bat_number", "pitch_number",
          "batter", "pitcher", "events", "type", "stand", "p_throws", "launch_speed",
          "launch_angle", "hc_x", "hc_y"]
RUN_WEIGHTS = np.array([0, .882, 1.252, 1.584, 2.037]) / 1.232
NON_AB = {"walk", "intent_walk", "hit_by_pitch", "sac_bunt", "sac_fly",
          "catcher_interf", "sac_fly_double_play", "sac_bunt_double_play"}
SAVANT_SOURCE = ("https://baseballsavant.mlb.com/leaderboard/home-runs"
                 "?type=details&player_id=673548&year=2026&player_type=Batter&cat=")


def schedule(analysis, year):
    study = "innings_eater" if year == 2026 else "starter_reliever_contrast"
    src = analysis / study / f"data/validation/schedule_{year}.json"
    days = json.loads(src.read_text())["dates"]
    return {int(g["gamePk"]): int(g["venue"]["id"]) for d in days for g in d["games"]
            if g["gameType"] == "R"}


def load_year(analysis, year):
    path = analysis / f"attackability/data/processed/statcast_{year}.parquet"
    columns = SOURCE + (["inning_topbot", "hit_distance_sc"] if year == 2026 else [])
    pitches = [pd.read_parquet(path, columns=columns)]
    if year == 2026:
        late = analysis / "deception_residual/data/outcomes_2026/raw"
        pitches.extend(pd.read_csv(f, usecols=columns, low_memory=False)
                       for f in sorted(late.glob("statcast_*.csv.gz")))
    data = pd.concat(pitches, ignore_index=True)
    data = data.loc[data.game_type.eq("R")].copy()
    key = ["game_pk", "at_bat_number"]
    data = data.drop_duplicates(key + ["pitch_number"])
    data["date"] = pd.to_datetime(data.game_date, format="mixed")
    data["venue"] = data.game_pk.map(schedule(analysis, year))
    assert data.venue.notna().all()
    assert data.date.dt.year.eq(year).all()

    # Completed plate appearances. Exclude runner-only events that can end an inning.
    contact = data.type.eq("X") & data.events.notna()
    pa = contact | data.events.isin(NON_AB | {"strikeout", "strikeout_double_play"})
    appearances = data.loc[pa].copy()
    assert not appearances.duplicated(key).any()
    appearances["contact"] = contact.loc[pa].astype(bool)
    appearances["spray"] = .75 * np.degrees(np.arctan2(
        appearances.hc_x.astype(float) - 125.42, 198.27 - appearances.hc_y.astype(float)
    ))
    appearances["righty"] = appearances.stand.eq("R").astype(int)
    appearances["pitcher_righty"] = appearances.p_throws.eq("R").astype(int)
    appearances["supported"] = (
        appearances.contact & appearances.spray.abs().le(50)
        & appearances.launch_speed.notna() & appearances.launch_angle.notna()
        & appearances.stand.isin(["L", "R"]) & appearances.p_throws.isin(["L", "R"])
    )
    appearances["year"] = year
    appearances["y"] = appearances.events.map(HIT_TYPES).fillna(0).astype(int)
    # Negative spray angles are physical left field, regardless of batting side.
    appearances["zone"] = np.digitize(appearances.spray, [-30, -15, 15, 30])
    appearances["height"] = np.digitize(appearances.launch_angle, [10, 25, 45])
    appearances["hard"] = appearances.launch_speed.ge(95).astype(int)
    coverage = dict(year=year, games=int(data.game_pk.nunique()),
                    first=str(data.date.min().date()), last=str(data.date.max().date()),
                    pa=len(appearances), measured=int(appearances.supported.sum()),
                    contacts=int(appearances.contact.sum()))
    print(coverage, flush=True)
    return appearances, coverage


def scale_probabilities(probabilities, tilt):
    scaled = probabilities * tilt
    return scaled / scaled.sum(axis=1, keepdims=True)


def fit_surface(contacts):
    model = HistGradientBoostingClassifier(
        max_iter=100, max_leaf_nodes=24, min_samples_leaf=80,
        learning_rate=.1, l2_regularization=2, early_stopping=False, random_state=0,
    )
    return model.fit(contacts[FEATURES], contacts.y)


def aggregate_tilts(rows, probability, keys, prior_n, class_rate):
    cols = list(range(len(OUTCOMES)))
    expected = pd.DataFrame(probability, index=rows.index)
    observed = pd.DataFrame(np.eye(len(cols))[rows.y], index=rows.index)
    groups = [rows[key] for key in keys]
    obs = observed.groupby(groups).sum()
    exp = expected.groupby(groups).sum()
    size = observed.groupby(groups).size().to_numpy()[:, None]
    prior = prior_n * np.maximum(exp.to_numpy() / size, .25 * class_rate)
    return (obs + prior) / (exp + prior)


def add_tilts(rows, probability, factors):
    if isinstance(factors.index, pd.MultiIndex):
        index = pd.MultiIndex.from_frame(rows[factors.index.names])
    else:
        index = rows[factors.index.name]
    tilt = factors.reindex(index).fillna(1).to_numpy()
    return scale_probabilities(probability, tilt)


def fit_factors(contacts, model, strengths):
    fit = contacts.loc[contacts.venue.isin(PARKS)].copy()
    p = model.predict_proba(fit[FEATURES])
    class_rate = np.bincount(contacts.y, minlength=len(OUTCOMES)) / len(contacts)
    main = aggregate_tilts(fit, p, ["venue", "righty"], 250, class_rate)
    p_main = add_tilts(fit, p, main)
    cell = ["venue", "righty", "zone", "height", "hard"]
    profile = {n: aggregate_tilts(fit, p_main, cell, n, class_rate) for n in strengths}
    return main, profile


def losses(rows, probabilities):
    y = rows.y.to_numpy()
    return -np.log(np.maximum(probabilities[np.arange(len(y)), y], 1e-12))


def score(rows, probabilities):
    truth = np.eye(len(OUTCOMES))[rows.y]
    return dict(log_loss=float(losses(rows, probabilities).mean()),
                brier=dict(zip(OUTCOMES, np.mean((truth - probabilities)**2, axis=0))))


def non_hr_probability(probabilities):
    other = probabilities[:, :-1]
    return other / other.sum(axis=1, keepdims=True)


def match_savant(plays, rows):
    matched = []
    for play in plays:
        candidates = rows.loc[
            rows.game_pk.eq(int(play["game_pk"])) & rows.pitcher.eq(int(play["pitcher_id"]))
            & rows.events.eq(play["result"])
            & rows.launch_speed.sub(float(play["exit_velocity"])).abs().le(.51)
            & rows.launch_angle.sub(float(play["launch_angle"])).abs().le(.51)
        ]
        if len(candidates) != 1:
            raise ValueError(f"Expected one Statcast match for {play['play_id']}; got {len(candidates)}")
        matched.append(candidates.index[0])
    assert len(set(matched)) == len(matched)
    return pd.DataFrame(plays, index=matched)


def game_bootstrap(rows, delta):
    group = pd.DataFrame({"game": rows.game_pk.to_numpy(), "delta": delta}).groupby("game")
    totals = group.delta.sum().to_numpy()
    counts = group.size().to_numpy()
    rng = np.random.default_rng(610)
    draws = rng.integers(0, len(totals), size=(2000, len(totals)))
    return np.quantile(totals[draws].sum(1) / counts[draws].sum(1), [.025, .975]).tolist()


def hitter_plays(path, games, rows):
    payload = json.loads(path.read_bytes())
    plays = [p for p in payload if int(p["game_pk"]) in games]
    assert len({p["play_id"] for p in plays}) == len(plays)
    assert all(p["batter_id"] == path.stem and p["cat"] == "adj_xhr" for p in plays)
    assert all(p[code] in {"0", "1"} for p in plays for code in SAVANT_CODES.values())
    assert sum(p["result"] == "home_run" for p in plays) == int(rows.y.eq(4).sum()), path.stem
    return plays


def plate_appearance_rates(rows):
    return np.array([
        (~rows.events.isin(NON_AB)).mean(),
        (~rows.events.isin(NON_AB - {"walk", "intent_walk", "hit_by_pitch", "sac_fly",
                                   "sac_fly_double_play"})).mean(),
        rows.events.isin(["walk", "intent_walk", "hit_by_pitch"]).mean(),
    ])


def expected_line(hits, denominators):
    ab, obp_denominator, walks_hbp = denominators
    return {
        "avg": round(float(hits.sum() / ab), 6),
        "obp": round(float((hits.sum() + walks_hbp) / obp_denominator), 6),
        "slg": round(float(hits @ np.arange(1, 5) / ab), 6),
        "hits": hits.round(5).tolist(),
        "contactValue": round(float(hits @ RUN_WEIGHTS[1:]), 5),
    }


def player_replay(rows, flags, player, model, main, profile):
    contact = rows.loc[rows.supported]
    # Every away game is the top half of the inning, including after a trade.
    road = rows.loc[rows.inning_topbot.eq("Top")]
    assert len(road) >= 100 and len(contact) >= 150, player["name"]
    half = 300
    denominators = (plate_appearance_rates(rows) + plate_appearance_rates(road)) * half
    road_hits = np.bincount(road.y, minlength=5)[1:] * half / len(road)
    unchanged = np.bincount(rows.loc[~rows.supported].y, minlength=5)[1:]
    p = model.predict_proba(contact[FEATURES])
    park_lines = {}
    chances = {}
    for venue, code in SAVANT_CODES.items():
        dest = contact.assign(venue=venue)
        probability = add_tilts(dest, add_tilts(dest, p, main), profile)
        hr = flags[code].reindex(contact.index).eq("1").to_numpy()
        other = non_hr_probability(probability)
        hybrid = np.column_stack([other * (~hr[:, None]), hr])
        assert np.allclose(hybrid.sum(axis=1), 1)
        assert int(hybrid[:, -1].sum()) == int(flags[code].eq("1").sum())
        hits = road_hits + (hybrid.sum(axis=0)[1:] + unchanged) * half / len(rows)
        park_lines[code] = expected_line(hits, denominators)
        chances[code] = pd.DataFrame(other, index=contact.index)

    events = []
    for i, ball in flags.iterrows():
        clears = [code for code in SAVANT_CODES.values() if ball[code] == "1"]
        if len(clears) in (0, len(PARKS)):
            continue
        measured = contact.loc[i]
        events.append({
            "id": ball.play_id, "date": ball.game_date, "result": ball.result,
            "ev": float(measured.launch_speed), "la": int(measured.launch_angle),
            "spray": round(float(measured.spray), 1),
            "distance": int(measured.hit_distance_sc) if pd.notna(measured.hit_distance_sc) else None,
            "clears": clears,
            "inPlay": {code: chances[code].loc[i].round(4).tolist()
                       for code in SAVANT_CODES.values() if code not in clears},
        })
    return {
        "id": str(player["id"]).removeprefix("mlb-"), "name": player["name"],
        "samplePa": len(rows), "measuredContact": len(contact), "roadPa": len(road),
        "parks": park_lines, "plays": events,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--analysis", type=Path, required=True,
                        help="directory containing the historical Statcast and schedule caches")
    parser.add_argument("--savant", type=Path, required=True,
                        help="directory with one adjusted Savant details JSON per MLBAM player ID")
    parser.add_argument("--out", type=Path, default=ROOT / "app/data/park-fit.json")
    args = parser.parse_args()
    tracker = json.loads((ROOT / "app/data/free-agent-tracker.json").read_text())
    hitters = [p for p in tracker["players"] if p.get("publishedForecast") and
               p["role"] == "position" and p["id"].startswith("mlb-")]
    hitters.sort(key=lambda p: (p["id"] != f"mlb-{CURRENT_HITTER}", p["name"]))

    data, coverage = zip(*(load_year(args.analysis, year) for year in range(2023, 2027)))
    history = pd.concat(data, ignore_index=True)
    games = schedule(args.analysis, 2026)
    profiles = []
    source_hashes = {}
    for player in hitters:
        player_id = player["id"].removeprefix("mlb-")
        rows = history.loc[history.year.eq(2026) & history.batter.eq(int(player_id))]
        path = args.savant / f"{player_id}.json"
        plays = hitter_plays(path, games, rows)
        flags = match_savant(plays, rows)
        unmeasured = flags.loc[~rows.loc[flags.index, "supported"]]
        # This unlocated contact still has Savant's HR result. The actual
        # outcome can carry forward only if all five parks agree with it.
        for _, play in unmeasured.iterrows():
            assert all((play[code] == "1") == (play.result == "home_run")
                       for code in SAVANT_CODES.values()), play.play_id
        flags = flags.drop(unmeasured.index)
        profiles.append((player, rows, flags))
        source_hashes[player_id] = hashlib.sha256(path.read_bytes()).hexdigest()
        print(player["name"], len(rows), len(flags), flush=True)

    contacts = history.loc[history.supported]
    fit = contacts.loc[contacts.year.le(2024)]
    tune = contacts.loc[contacts.year.eq(2025) & contacts.venue.isin(PARKS)]
    test = contacts.loc[contacts.year.eq(2026) & contacts.venue.isin(PARKS)]
    strengths = [100, 300, 900]
    with threadpool_limits(limits=4):
        surface = fit_surface(fit)
        main_factors, candidates = fit_factors(fit, surface, strengths)
        tune_p = add_tilts(tune, surface.predict_proba(tune[FEATURES]), main_factors)
        tuning = {n: score(tune, add_tilts(tune, tune_p, candidates[n])) for n in strengths}
        strength = min(tuning, key=lambda n: tuning[n]["log_loss"])
        fit = contacts.loc[contacts.year.le(2025)]
        surface = fit_surface(fit)
        main_factors, profile = fit_factors(fit, surface, [strength])
        base = surface.predict_proba(test[FEATURES])
        generic = add_tilts(test, base, main_factors)
        full = add_tilts(test, generic, profile[strength])
        players = [player_replay(rows, flags, p, surface, main_factors, profile[strength])
                   for p, rows, flags in profiles]
    result = {
        "season": 2026,
        "referencePa": 600,
        "parks": [{"id": SAVANT_CODES[i], "name": name} for i, name in PARKS.items()],
        "players": players,
        "validation": {
            "testContact": len(test), "testGames": int(test.game_pk.nunique()),
            "genericLogLoss": score(test, generic)["log_loss"],
            "sprayLogLoss": score(test, full)["log_loss"],
            "logLossDifference95": game_bootstrap(test, losses(test, full) - losses(test, generic)),
            "tuning": tuning, "selectedPrior": strength, "coverage": coverage,
        },
        "source": {"savant": SAVANT_SOURCE.replace(str(CURRENT_HITTER), "{player_id}") + "adj_xhr",
                   "sha256ByPlayer": source_hashes},
    }
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
