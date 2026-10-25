#!/usr/bin/env python3
"""Build multi-season baselines on the original benchmark's fixed cohorts."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
from urllib.parse import parse_qs,urlparse

from fetch import ROOT,OLD,AUDITS,SEASONS,TEAMS
from scoring import score
from baselines import rate_baselines, workload_baselines


def load(path, manifest, meta=True):
    data=path.read_bytes();digest=hashlib.sha256(data).hexdigest()
    record=json.loads(path.with_suffix(path.suffix+".source.json").read_text()) if meta else {}
    if meta and record["sha256"]!=digest:
        raise ValueError("source checksum mismatch: "+str(path))
    manifest.append({**record,"path":path.name,"sha256":digest})
    return json.loads(data)


def index(rows):
    fg,mlb={},{}
    for row in rows:
        key=str(row["playerid"])
        if not key.isdigit() or key in fg:raise ValueError("invalid or duplicate FG ID")
        fg[key]=row
        if row.get("xMLBAMID"):
            mid=str(int(row["xMLBAMID"]))
            if mid in mlb:raise ValueError("duplicate MLBAM ID")
            mlb[mid]=row
    return fg,mlb


def match(player, indexes):
    fg,mlb=indexes
    left=fg.get(str(player.get("matched_fg_id")))
    right=mlb.get(str(player.get("matched_mlbam_id")))
    if left is not None and right is not None and left["playerid"]!=right["playerid"]:
        raise ValueError("conflicting historical identities")
    return right if right is not None else left


def counts(row, kind):
    if row is None:return 0.,0.,0.
    fields=[row["PA" if kind=="bat" else "TBF"],row["SO"],row["BB"]]
    if any(v is None for v in fields):raise ValueError("missing event counts")
    work,so,bb=map(float,fields)
    if not all(math.isfinite(v) for v in [work,so,bb]) or min(work,so,bb)<0 or so+bb>work:raise ValueError("invalid event counts")
    return work,so,bb


def games_elapsed(payload, cutoff, target_start, capture):
    buckets={}
    for day in payload["dates"]:
        for game in day["games"]:
            if game["gameType"]=="R":buckets.setdefault(game["gamePk"],[]).append(game)
    completed,gap=0,0
    capture_dt=datetime.strptime(capture,"%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    for games in buckets.values():
        # MLB's broad "Final" bucket also includes postponed games. F means
        # actually played (including games completed early); D does not.
        if not any(g["status"].get("codedGameState")=="F" for g in games):continue
        original=min(g["officialDate"] for g in games)
        # A completed suspended game can appear under both dates. Completion
        # must precede the feature cutoff, regardless of its official date.
        completion=max([g["officialDate"] for g in games]+[g["resumeDate"][:10] for g in games if g.get("resumeDate")])
        if completion<=cutoff:completed+=1
        elif cutoff<original<target_start:
            started=min(datetime.fromisoformat(g["gameDate"].replace("Z","+00:00")) for g in games)
            if started>=capture_dt:raise ValueError("gap game not started at capture")
            gap+=1
    g=2*completed/30
    remaining=162-g-2*gap/30
    if not 0<g<162 or remaining<=0:raise ValueError("invalid remaining schedule")
    return dict(completed_games=completed,gap_games_started=gap,elapsed_team_games=g,remaining_team_games=remaining)


def roster(key,audit,manifest):
    if audit["product"]!="rfangraphsdc":return None,{}
    active,details={},{}
    for team in TEAMS:
        path=ROOT/"raw"/f"{key}-roster-{team}.json"
        payload=load(path,manifest)
        params=parse_qs(urlparse(manifest[-1]["url"]).query)
        if params.get("date")!=[audit["source_end"]] or payload["teamId"]!=team or payload["rosterType"]!="active":
            raise ValueError("wrong roster request")
        if not 20<=len(payload["roster"])<=30:raise ValueError("implausible roster size")
        unique={}
        for row in payload["roster"]:
            mid=str(row["person"]["id"])
            if mid in unique and unique[mid]!=row:raise ValueError("conflicting duplicate roster row")
            unique[mid]=row
        details[str(team)]=dict(raw_rows=len(payload["roster"]),unique_players=len(unique),
                               identical_duplicates=len(payload["roster"])-len(unique))
        for row in unique.values():
            mid=str(row["person"]["id"])
            if mid in active:raise ValueError("player active on multiple teams")
            if row["status"]["code"]!="A":raise ValueError("nonactive row in active roster")
            active[mid]=team
    return active,details


def main():
    parser=argparse.ArgumentParser();parser.add_argument("--bootstrap",type=int,default=5000)
    args=parser.parse_args();manifest=[]
    original=load(OLD/"results/inputs.json",manifest,False)
    histories={}
    for year,(start,end) in SEASONS.items():
        for kind in ["bat","pit"]:
            p=load(ROOT/"raw"/f"history-{year}-{kind}.json",manifest)
            if p["totalCount"]!=len(p["data"]) or len(p["data"])<500 or p["dateRange"]!=f"{start} and {end}":
                raise ValueError("incomplete historical season")
            if any(int(row.get("season",row.get("Season",-1)))!=year for row in p["data"]):raise ValueError("wrong historical year")
            histories[year,kind]=index(p["data"])
    inputs,audits={},{ }
    for key,players in original.items():
        audit=AUDITS[key];kind=audit["kind"];year=int(audit["capture"][:4])
        source=load(OLD/"raw"/(key+"-source.json"),manifest)
        if len(source["data"])!=source["totalCount"] or source["dateRange"]!=audit["source_start"]+" and "+audit["source_end"]:
            raise ValueError("source window mismatch")
        source=index(source["data"])
        pace=games_elapsed(load(ROOT/"raw"/(key+"-past-schedule.json"),manifest),audit["source_end"],audit["target_start"],audit["capture"])
        active,sizes=roster(key,audit,manifest)
        rows=[]
        for player in players:
            current=counts(match(player,source),kind)
            if current[0]!=player["source_work"]:raise ValueError("original source workload changed")
            historic=[match(player,histories[year-offset,kind]) for offset in [1,2,3]]
            previous=[counts(row,kind) for row in historic]
            endpoints=["K%","BB%"] if kind=="bat" else ["K-BB%"]
            predicted=rate_baselines(current,previous,{e:audit["league_rates"][e] for e in endpoints})
            rates={}
            for endpoint in endpoints:
                rates[endpoint]=dict(actual=player["rates"][endpoint]["actual"],archived=player["rates"][endpoint]["archived"],
                    current_prior=player["rates"][endpoint]["prior"],
                    multiyear=predicted[endpoint])
            mid=player.get("matched_mlbam_id")
            mids={str(int(row["xMLBAMID"])) for row in historic if row is not None and row.get("xMLBAMID")}
            if mid:mids.add(mid)
            if len(mids)>1:raise ValueError("historical MLBAM identity conflict")
            mid=next(iter(mids),None)
            status="not_requested" if active is None else "unknown" if mid is None else "active" if mid in active else "not_on_active_roster"
            work=workload_baselines(current[0],[p[0] for p in previous],pace["elapsed_team_games"],pace["remaining_team_games"])
            rows.append(dict(player_id=player["player_id"],mlbam_id=mid,name=player["name"],actual_work=player["actual_work"],
                source_work=current[0],prior_season_work=[p[0] for p in previous],source_counts=current,prior_season_counts=previous,
                history_group="prior_mlb" if sum(p[0] for p in previous)>0 else "no_prior_mlb",
                current_group="current_mlb" if current[0]>0 else "no_current_mlb",roster_status=status,
                active_team=active.get(mid) if active else None,
                workload=dict(archived=player["forecast_work"],calendar=player["pace_work"],**work),rates=rates))
        inputs[key]=rows
        audits[key]=dict(**audit,**pace,roster_sizes=sizes,roster_date=audit["source_end"] if active else None,
            roster_unknown=sum(r["roster_status"]=="unknown" for r in rows))
        print(key,len(rows),"players",pace,flush=True)
    # All input validation and prediction construction precedes target scoring.
    results=dict(status="retrospective development comparison",date="2026-10-20",bootstrap_resamples=args.bootstrap,
        audits=audits,scores={key:score(rows,args.bootstrap) for key,rows in inputs.items()})
    dest=ROOT/"results";dest.mkdir(exist_ok=True)
    for name,obj in [("inputs.json",inputs),("results.json",results),("sources.json",manifest)]:
        (dest/name).write_text(json.dumps(obj,indent=2,allow_nan=False)+"\n")
    print(dest/"results.json")


if __name__=="__main__":main()
