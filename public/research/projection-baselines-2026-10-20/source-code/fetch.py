#!/usr/bin/env python3
"""Download prior full seasons, pre-cutoff schedules and dated active rosters."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent
OLD = ROOT.parent / "projection_benchmark"
AUDITS = json.loads((OLD / "results/results.json").read_text())["audits"]
SEASONS = {2021: ("2021-04-01", "2021-10-03"), 2022: ("2022-04-07", "2022-10-05"),
           2023: ("2023-03-30", "2023-10-01"), 2024: ("2024-03-20", "2024-09-30")}
TEAMS = [108,109,110,111,112,113,114,115,116,117,118,119,120,121,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,158]


def fetch(item):
    name, url = item
    path = ROOT / "raw" / name
    meta = path.with_suffix(path.suffix + ".source.json")
    if path.exists() and meta.exists():
        record = json.loads(meta.read_text())
        if record["url"] != url or record["sha256"] != hashlib.sha256(path.read_bytes()).hexdigest():
            raise ValueError("cached source mismatch")
        return
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "DugoutValueResearch/1.0"}), timeout=55) as r:
        data, resolved = r.read(), r.url
    path.write_bytes(data)
    meta.write_text(json.dumps(dict(path=name, url=url, resolved_url=resolved,
        sha256=hashlib.sha256(data).hexdigest(), bytes=len(data), retrieved_at=datetime.now(timezone.utc).isoformat()), indent=2)+"\n")
    print(name, len(data), flush=True)


def requests():
    for year, (start, end) in SEASONS.items():
        for kind in ["bat", "pit"]:
            params = dict(pos="all", stats=kind, lg="all", qual="0", type="8", season=year, season1=year,
                ind="0", team="0", rost="0", age="0", filter="", players="0", month="1000",
                startdate=start, enddate=end, pageitems=2000, pagenum=1)
            yield f"history-{year}-{kind}.json", "https://www.fangraphs.com/api/leaders/major-league/data?" + urllib.parse.urlencode(params)
    for key, a in AUDITS.items():
        # Include the gap day for the June 2025 checkpoint, but never its stats
        # in the rate baseline; its scheduled opportunities are not in the target.
        end = datetime.strptime(a["capture"][:8], "%Y%m%d").date()
        from datetime import timedelta
        end -= timedelta(days=1)
        params = dict(sportId=1, startDate=a["source_start"], endDate=str(end))
        yield key + "-past-schedule.json", "https://statsapi.mlb.com/api/v1/schedule?" + urllib.parse.urlencode(params)
        if a["product"] == "rfangraphsdc":
            for team in TEAMS:
                params = dict(rosterType="active", date=a["source_end"])
                yield f"{key}-roster-{team}.json", f"https://statsapi.mlb.com/api/v1/teams/{team}/roster?" + urllib.parse.urlencode(params)


if __name__ == "__main__":
    (ROOT / "raw").mkdir(exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(fetch, requests()))
