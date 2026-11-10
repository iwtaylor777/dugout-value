"""Add free-agent or selected MLB hitter replays while preserving published results."""

import argparse
import hashlib
import json
import unicodedata
from pathlib import Path

import pandas as pd
from threadpoolctl import threadpool_limits

from build import DEFAULT_HITTER, ROOT, player_replay, prepare_contact, read_flags
from inputs import MODES, REPLAY_SEASONS, dimensions, schedule
from model import fit_models, typical_values

OFF_MARKET = {"signed", "re-signed", "extension", "qo-accepted", "option-exercised", "opted-in", "retired"}
ON_MARKET = {"option-declined", "opted-out"}


def name_key(name):
    return "".join(c for c in unicodedata.normalize("NFD", name.lower()) if c.isascii() and c.isalpha())


def free_agent_hitters(existing_ids):
    tracker = json.loads((ROOT / "app/data/free-agent-tracker.json").read_text())
    signings = json.loads((ROOT / "app/data/free-agent-signings.json").read_text())
    outcomes = {name_key(row["player"]): row["outcome"] for row in signings["entries"]}
    for player in tracker["players"]:
        if player["role"] != "position" or not player["id"].startswith("mlb-"):
            continue
        if player["id"][4:] in existing_ids:
            continue
        outcome = outcomes.get(name_key(player["name"]))
        if outcome in OFF_MARKET or (player["market"] in {"option", "stays"} and outcome not in ON_MARKET):
            continue
        yield player


def load_replay(inputs, rows, codes, year, player_id):
    if rows.supported.sum() < 100 or (rows.road & rows.primary).sum() < 60 or not (~rows.road & rows.primary).any():
        return None
    paths = {mode: inputs / mode / f"{year}-{player_id}.json" for mode in MODES}
    try:
        flags = {mode: read_flags(path, rows, codes, MODES[mode]) for mode, path in paths.items()}
        contact, missing_home_runs = prepare_contact(rows, flags, codes)
        recorded_home_runs = int(rows.y.eq(4).sum())
        if len(contact) < 100 or missing_home_runs > max(1, recorded_home_runs // 5):
            raise ValueError("insufficient matched contact or home-run coverage")
    except (AssertionError, OSError, ValueError) as err:
        print(f"Skipping {year}-{player_id}: {err}", flush=True)
        return None
    return rows, flags, paths


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--analysis", required=True, type=Path)
    parser.add_argument("--inputs", required=True, type=Path)
    parser.add_argument("--pa", required=True, type=Path)
    parser.add_argument("--players", nargs="+", metavar="MLB_ID",
                        help="Add these hitters instead of scanning the free-agent tracker.")
    args = parser.parse_args()

    index_path = ROOT / "app/data/park-fit.json"
    index = json.loads(index_path.read_text())
    existing = index["players"]
    existing_ids = {p["id"] for p in existing}
    if args.players:
        database = json.loads((ROOT / "app/data/player-database.json").read_text())
        by_id = {p["id"].removeprefix("mlb-"): p for p in database["players"]
                 if p["id"].startswith("mlb-")}
        selected_ids = list(dict.fromkeys(args.players))
        unknown = set(selected_ids) - by_id.keys() - existing_ids
        if unknown:
            parser.error(f"unknown MLB hitter IDs: {', '.join(sorted(unknown))}")
        candidates = [by_id[player_id] for player_id in selected_ids if player_id not in existing_ids]
    else:
        candidates = list(free_agent_hitters(existing_ids))
    if not candidates:
        print("No new hitters to add.")
        return
    history = pd.read_parquet(args.pa)
    venues = dimensions(args.inputs, {y: schedule(args.analysis, y) for y in range(2023, 2027)})
    parks = {year: sorted(venues[year].values(), key=lambda p: p["id"]) for year in REPLAY_SEASONS}
    replays = {year: {} for year in REPLAY_SEASONS}
    additions = []

    for player in candidates:
        player_id = player["id"][4:]
        rows = history.loc[history.batter.eq(int(player_id))]
        seasons = []
        for year in REPLAY_SEASONS:
            profile = load_replay(args.inputs, rows.loc[rows.year.eq(year)],
                                  [p["id"] for p in parks[year]], year, player_id)
            if profile is None:
                # Every new dropdown entry needs the current season.
                if not seasons:
                    break
                continue
            replays[year][player_id] = (player, *profile)
            seasons.append(year)
        if seasons:
            additions.append({"id": player_id, "name": player["name"], "seasons": seasons})
        elif args.players:
            parser.error(f"{player['name']} does not have a usable {REPLAY_SEASONS[0]} replay.")

    # Exclude every displayed hitter from the fit used for the new replays.
    # Previously published replays keep their original fit.
    omitted = [int(p["id"]) for p in existing + additions]
    contacts = history.loc[history.primary & history.supported & ~history.batter.isin(omitted)]
    output = ROOT / "public/data/park-fit"
    with threadpool_limits(limits=4):
        for year, profiles in replays.items():
            if not profiles:
                continue
            train = contacts.loc[contacts.year.le(year)]
            prior = index["study"]["prior"]
            model = fit_models(train, [prior], wall=index["study"]["wallPass"], visiting_defense=True)[prior]
            typical = typical_values(model, train, venues[year])
            for player_id, (player, rows, flags, paths) in profiles.items():
                profile = player_replay(rows, flags, player, parks[year], typical, model)
                key = f"{year}-{player_id}"
                (output / f"{key}.json").write_text(json.dumps(profile, separators=(",", ":")) + "\n")
                index["source"]["sha256"][key] = {
                    mode: hashlib.sha256(path.read_bytes()).hexdigest() for mode, path in paths.items()
                }
            print(year, len(profiles), "added replays", flush=True)

    index["players"] = sorted(existing + additions, key=lambda p: (p["id"] != DEFAULT_HITTER, p["name"]))
    index_path.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(len(index["players"]), "hitters in dropdown", flush=True)


if __name__ == "__main__":
    main()
