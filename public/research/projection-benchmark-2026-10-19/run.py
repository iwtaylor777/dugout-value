#!/usr/bin/env python3
"""Validate the full archived lists, build matched inputs, and score each checkpoint."""
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import html
import json
import math
from pathlib import Path
import re

from fetch import CHECKPOINTS, ROOT, dates
from scoring import evaluate


def number(value):
    if value is None or value == "":
        return None
    x = float(value)
    return x if math.isfinite(x) else None


def identifier(row):
    value = str(row.get("playerid", ""))
    if not value.isdigit() or int(value) <= 0:
        raise ValueError(f"invalid FanGraphs ID: {value}")
    return str(int(value))


def by_id(rows):
    result = {}
    for row in rows:
        key = identifier(row)
        if key in result:
            raise ValueError(f"duplicate player ID: {key}")
        result[key] = row
    return result


def read_input(name, manifest):
    path = ROOT / "raw" / name
    data = path.read_bytes()
    meta = json.loads(path.with_suffix(path.suffix + ".source.json").read_text())
    digest = hashlib.sha256(data).hexdigest()
    if meta["sha256"] != digest:
        raise ValueError(f"checksum mismatch: {name}")
    manifest.append({**meta, "path": name})
    return data, meta


def projections(c, manifest):
    data, meta = read_input(c["key"] + ".html", manifest)
    token = "/web/" + c["capture"] + "id_/"
    if token not in meta["resolved_url"]:
        raise ValueError("archive redirect changed timestamp")
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    match = re.search(r'<script[^>]+id=["\x27]__NEXT_DATA__["\x27][^>]*>(.*?)</script>', data.decode(), re.S)
    if not match:
        raise ValueError("no complete embedded JSON")
    props = json.loads(html.unescape(match[1]))["props"]["pageProps"]
    if props["qsContext"]["type"] != c["product"] or props["qsContext"]["stats"] != c["kind"]:
        raise ValueError("wrong projection product")
    candidates = [q["state"]["data"] for q in props["dehydratedState"]["queries"]
                  if isinstance(q.get("state", {}).get("data"), list)
                  and q["state"]["data"] and isinstance(q["state"]["data"][0], dict)
                  and "playerid" in q["state"]["data"][0]]
    expected_rows = {"2024-pit": 633, "2025-pit": 659, "2024-may-bat": 499,
                     "2025-bat": 611, "2024-apr-dc-bat": 600, "2025-dc-bat": 612}
    if len(candidates) != 1 or len(candidates[0]) != expected_rows[c["key"]]:
        raise ValueError("missing or ambiguous full projection list")
    load = datetime.fromtimestamp(float(props["loaddate"]), timezone.utc)
    capture = datetime.strptime(c["capture"], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    if load.year != capture.year or not 0 <= (capture - load).total_seconds() <= 3 * 86400:
        raise ValueError("projection load date is stale or from the future")
    rows = candidates[0]
    raw_ids = [str(r.get("playerid", "")) for r in rows]
    if len(set(raw_ids)) != len(raw_ids):
        raise ValueError("duplicate raw projection ID")
    return dict(zip(raw_ids, rows)), load.isoformat()


def actuals(c, interval, manifest):
    data, _ = read_input(c["key"] + f"-{interval}.json", manifest)
    payload = json.loads(data)
    start, cutoff, future, end = dates(c)
    a, b = (start, cutoff) if interval == "source" else (future, end)
    if payload["dateRange"] != f"{a.isoformat()} and {b.isoformat()}":
        raise ValueError("incorrect outcome window")
    rows = payload["data"]
    if payload["totalCount"] != len(rows) or len(rows) < 500:
        raise ValueError("incomplete outcome leaderboard")
    return by_id(rows)


def check_schedule(c, manifest):
    data, _ = read_input(c["key"] + "-schedule.json", manifest)
    games = [g for day in json.loads(data)["dates"] for g in day["games"] if g["gameType"] == "R"]
    capture = datetime.strptime(c["capture"], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    first = min(datetime.fromisoformat(g["gameDate"].replace("Z", "+00:00")) for g in games)
    if capture >= first:
        raise ValueError("capture is after target games began")
    for game in games:
        original = game.get("resumedFrom")
        if original and datetime.fromisoformat(original.replace("Z", "+00:00")) < capture:
            raise ValueError("suspended game crosses the forecast boundary")
    return first.isoformat()


def endpoint_rate(row, endpoint, kind, archived=False):
    work = number(row.get("PA" if kind == "bat" else "TBF"))
    if archived:
        return number(row.get(endpoint))
    if not work or work <= 0:
        return None
    if endpoint in ["K%", "BB%", "K-BB%"]:
        so, bb = number(row.get("SO")), number(row.get("BB"))
        if so is None or bb is None or min(so, bb) < 0 or so + bb > work:
            raise ValueError("missing event counts")
        return {"K%": so / work, "BB%": bb / work, "K-BB%": (so - bb) / work}[endpoint]
    if endpoint == "FIP" and (number(row.get("IP")) or 0) <= 0:
        return None
    return number(row.get(endpoint))


def build(c, manifest):
    forecast, load = projections(c, manifest)
    first_game = check_schedule(c, manifest)
    source, target = actuals(c, "source", manifest), actuals(c, "target", manifest)
    kind = c["kind"]
    work_field = "PA" if kind == "bat" else "TBF"
    endpoints = ["K%", "BB%", "wOBA"] if kind == "bat" else ["K-BB%", "FIP"]
    def work(row):
        value = number(row.get(work_field))
        if value is None or value < 0:
            raise ValueError("invalid workload")
        return value
    league = {}
    for endpoint in endpoints:
        valid = [(work(r), endpoint_rate(r, endpoint, kind)) for r in source.values() if work(r) > 0]
        valid = [(w, x) for w, x in valid if x is not None]
        league[endpoint] = sum(w * x for w, x in valid) / sum(w for w, x in valid)
    start, cutoff, future, end = dates(c)
    pace_factor = ((end - future).days + 1) / ((cutoff - start).days + 1)
    identities = json.loads((ROOT / "identities.json").read_text())["links"]
    def mlbam_index(actual):
        result = {}
        for key, row in actual.items():
            mlbam = row.get("xMLBAMID")
            if mlbam is not None:
                mid = str(int(mlbam))
                if mid in result:
                    raise ValueError("duplicate MLBAM ID in actuals")
                result[mid] = key
        return result
    source_mlb, target_mlb = mlbam_index(source), mlbam_index(target)
    rows, excluded, used_target, used_ids, used_mlb = [], [], set(), set(), set()
    for player_id, proj in forecast.items():
        link = identities.get(player_id, {})
        direct_mlb = proj.get("xMLBAMID")
        mlbam = str(int(direct_mlb)) if direct_mlb else link.get("mlbam_id")
        fg_id = player_id if player_id.isdigit() else link.get("fg_id")
        if not fg_id and not mlbam:
            excluded.append(dict(player_id=player_id, name=proj["PlayerName"], forecast_work=work(proj),
                                 reason="no verified numeric FanGraphs or MLBAM crosswalk"))
            continue
        sid, tid = fg_id, fg_id
        if mlbam:
            sid, tid = source_mlb.get(mlbam, sid), target_mlb.get(mlbam, tid)
        src, tgt = source.get(sid), target.get(tid)
        observed_mlb = (tgt or src or {}).get("xMLBAMID")
        if observed_mlb:
            observed_mlb = str(int(observed_mlb))
            if mlbam and observed_mlb != mlbam:
                raise ValueError("provider crosswalk conflicts with observed identity")
            mlbam = observed_mlb
        stable_id = "fg:" + fg_id if fg_id else "mlbam:" + mlbam
        if stable_id in used_ids or (tgt and tid in used_target) or (mlbam and mlbam in used_mlb):
            raise ValueError("forecast roster contains two aliases for one player")
        used_ids.add(stable_id)
        if mlbam:
            used_mlb.add(mlbam)
        if tgt:
            used_target.add(tid)
        sw, tw = work(src) if src else 0.0, work(tgt) if tgt else 0.0
        rates = {}
        for endpoint in endpoints:
            rate = endpoint_rate(src, endpoint, kind) if src else None
            # Missing a secondary source rate is not the same as zero source work.
            prior = ((sw * rate + 200 * league[endpoint]) / (sw + 200)
                     if rate is not None else league[endpoint] if sw == 0 else None)
            rates[endpoint] = dict(archived=endpoint_rate(proj, endpoint, kind, True),
                                   actual=endpoint_rate(tgt, endpoint, kind) if tgt else None,
                                   prior=prior, ytd=rate)
        rows.append(dict(player_id=player_id, matched_fg_id=tid, matched_mlbam_id=mlbam,
                         identity_source="archive" if player_id.isdigit() or direct_mlb else link.get("source"),
                         name=proj["PlayerName"], kind=kind,
                         forecast_work=work(proj), source_work=sw, actual_work=tw,
                         target_present=tgt is not None, pace_work=sw * pace_factor, rates=rates))
    missing = [r for key, r in target.items() if key not in used_target and work(r) > 0]
    total = sum(work(r) for r in target.values())
    audit = dict(**c, forecast_rows=len(rows), raw_forecast_rows=len(forecast),
                 source_rows=len(source), target_rows=len(target), excluded_forecasts=excluded,
                 invalid_ids=len(excluded), duplicate_ids=0, projection_load_utc=load, first_target_game_utc=first_game,
                 excluded_forecast_work=sum(r["forecast_work"] for r in excluded),
                 source_start=str(start), source_end=str(cutoff), target_start=str(future), target_end=str(end),
                 league_rates=league, pace_factor=pace_factor,
                 target_ids_absent=sum(not r["target_present"] for r in rows),
                 zero_source=sum(r["source_work"] == 0 for r in rows),
                 unforecast_players=len(missing), unforecast_work=sum(work(r) for r in missing),
                 target_total_work=total, forecast_roster_work_coverage=sum(r["actual_work"] for r in rows) / total,
                 workload_interpretation="roster forecast" if c["product"] == "rfangraphsdc" else "basic ZiPS workload diagnostic")
    return rows, audit


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "results")
    parser.add_argument("--bootstrap", type=int, default=5000)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    manifest, inputs, audits, scores = [], {}, {}, {}
    # Validate all inputs before writing any scores.
    for c in CHECKPOINTS:
        rows, audit = build(c, manifest)
        inputs[c["key"]], audits[c["key"]] = rows, audit
        print(c["key"], audit["forecast_rows"], "forecast players", flush=True)
    for key, rows in inputs.items():
        scores[key] = evaluate(rows, args.bootstrap)
    result = dict(status="retrospective development benchmark", generated_date="2026-10-19",
                  bootstrap_resamples=args.bootstrap, audits=audits, scores=scores)
    for name, obj in [("inputs.json", inputs), ("results.json", result), ("sources.json", manifest)]:
        (args.output / name).write_text(json.dumps(obj, indent=2, allow_nan=False) + "\n")
    print(args.output / "results.json", flush=True)


if __name__ == "__main__":
    main()
