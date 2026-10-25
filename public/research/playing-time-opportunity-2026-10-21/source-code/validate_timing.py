"""Capture compact official final-play evidence for May 31 cutoff games."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import hashlib
import json


ROOT = Path(__file__).resolve().parent
RAW = ROOT / "timing-evidence" / "raw"
FIELDS = "gameData,datetime,officialDate,dateTime,status,abstractGameState,codedGameState,detailedState,statusCode,liveData,plays,allPlays,about,atBatIndex,startTime,endTime,isComplete"
DECISION = {2024: "2024-06-01T12:00:00Z", 2025: "2025-06-01T11:32:24Z"}
FORECAST_LOAD = "2025-06-01T05:15:51Z"


def timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def fetch(item):
    year, sport, game = item
    game_pk = game["gamePk"]
    url = f"https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live?{urlencode({'fields': FIELDS})}"
    with urlopen(Request(url, headers={"User-Agent": "DugoutValueResearch/1.0"}), timeout=45) as response:
        body = response.read()
        final_url = response.url
    payload = json.loads(body)
    chronology = payload["gameData"]["datetime"]
    if chronology["officialDate"] != f"{year}-05-31" or chronology["dateTime"] != game["gameDate"]:
        raise ValueError(f"schedule/feed date mismatch: {game_pk}")
    if payload["gameData"]["status"]["codedGameState"] != "F":
        raise ValueError(f"feed game is not final: {game_pk}")
    plays = payload["liveData"]["plays"]["allPlays"]
    stamped = [p for p in plays if p["about"].get("endTime")]
    if not stamped:
        raise ValueError(f"no timestamped final play: {game_pk}")
    last = max(stamped, key=lambda p: timestamp(p["about"]["endTime"]))
    end = last["about"]["endTime"]
    if timestamp(end) < timestamp(chronology["dateTime"]):
        raise ValueError(f"final play predates start: {game_pk}")
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / f"{year}-{sport}-{game_pk}.json"
    path.write_bytes(body)
    return {"year": year, "sport_id": sport, "game_pk": game_pk,
            "official_date": chronology["officialDate"], "start_utc": chronology["dateTime"],
            "last_play_end_utc": end, "last_play_at_bat_index": last["about"]["atBatIndex"],
            "last_play_is_complete": last["about"].get("isComplete"),
            "game_detailed_state": payload["gameData"]["status"]["detailedState"],
            "plays": len(plays), "source": {"url": url, "resolved_url": final_url,
            "path": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(body).hexdigest(),
            "bytes": len(body), "retrieved_at_utc": datetime.now(timezone.utc).isoformat()}}


def late_game_overlap(game, cohort_ids):
    game_pk = game["game_pk"]
    url = (f"https://statsapi.mlb.com/api/v1/game/{game_pk}/boxscore?"
           f"{urlencode({'fields': 'teams,home,away,players,person,id,stats,batting,plateAppearances'})}")
    with urlopen(Request(url, headers={"User-Agent": "DugoutValueResearch/1.0"}), timeout=45) as response:
        body = response.read()
        final_url = response.url
    payload = json.loads(body)
    players = {str(player["person"]["id"]): player for side in ("home", "away")
               for player in payload["teams"][side]["players"].values()}
    overlap = [{"mlbam_id": mid, "game_pa": player["stats"]["batting"].get("plateAppearances", 0)}
               for mid, player in players.items() if mid in cohort_ids]
    path = RAW / f"2025-late-{game_pk}-boxscore.json"
    path.write_bytes(body)
    return {"game_pk": game_pk, "cohort_players": sorted(overlap, key=lambda p: p["mlbam_id"]),
            "source": {"url": url, "resolved_url": final_url, "path": str(path.relative_to(ROOT)),
                       "sha256": hashlib.sha256(body).hexdigest(), "bytes": len(body),
                       "retrieved_at_utc": datetime.now(timezone.utc).isoformat()}}


def main():
    items = []
    for year in (2024, 2025):
        for sport in (1, 11, 12):
            schedule = json.loads((ROOT / "raw" / f"{year}-{sport}-schedule.json").read_text())
            games = {g["gamePk"]: g for day in schedule["dates"] for g in day["games"]
                     if g.get("officialDate") == f"{year}-05-31"}
            for game in games.values():
                if game["gameType"] != "R" or game["status"]["codedGameState"] != "F":
                    raise ValueError(f"May 31 game not regular/final: {game['gamePk']}")
                items.append((year, sport, game))
    with ThreadPoolExecutor(max_workers=8) as pool:
        games = sorted(pool.map(fetch, items), key=lambda g: (g["year"], g["sport_id"], g["game_pk"]))
    summaries = {}
    for year in (2024, 2025):
        subset = [g for g in games if g["year"] == year]
        latest = max(subset, key=lambda g: timestamp(g["last_play_end_utc"]))
        decision_gap = (timestamp(DECISION[year]) - timestamp(latest["last_play_end_utc"])).total_seconds()
        if decision_gap < 0:
            raise ValueError(f"a May 31 game ended after the {year} decision time")
        summaries[str(year)] = {"games_checked": len(subset), "decision_utc": DECISION[year],
                                "latest_final_play": {k: latest[k] for k in
                                                      ("sport_id", "game_pk", "last_play_end_utc")},
                                "seconds_before_decision": decision_gap}
        if year == 2025:
            load_gap = (timestamp(FORECAST_LOAD) - timestamp(latest["last_play_end_utc"])).total_seconds()
            summaries[str(year)]["archived_depth_charts_load_utc"] = FORECAST_LOAD
            summaries[str(year)]["seconds_before_forecast_load"] = load_gap
    cohort_ids = {row["mlbam_id"] for row in json.loads((ROOT / "results" / "inputs.json").read_text())["evaluation"]}
    late = [g for g in games if g["year"] == 2025 and timestamp(g["last_play_end_utc"]) > timestamp(FORECAST_LOAD)]
    late_overlap = [late_game_overlap(g, cohort_ids) for g in late]
    result = {"method": "Official MLB StatsAPI compact live feed, latest recorded play endTime in final-status games; all May 31 regular-season MLB, Triple-A and Double-A schedule games checked.",
              "qualification": "A recorded play endTime establishes the latest logged on-field event, not the exact time a final game or updated statistical leaderboard was published. Completed Early feeds may have an incomplete final advisory play.",
              "summaries": summaries, "late_games_after_archived_forecast_load": late_overlap, "games": games}
    (ROOT / "timing-evidence" / "timing-validation.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(summaries, indent=2))


if __name__ == "__main__":
    main()
