#!/usr/bin/env python3
"""Fetch dated archives and exact-window outcomes, retaining raw bytes."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent
CHECKPOINTS = [
    dict(key="2024-pit", kind="pit", product="rzips", capture="20240621173841", extra="&team=0&lg=all&players=0"),
    dict(key="2025-pit", kind="pit", product="rzips", capture="20250624042535", extra="&team=0&lg=all&players=0", baseline_end="2025-06-22"),
    dict(key="2025-bat", kind="bat", product="rzips", capture="20250731083705", extra=""),
    dict(key="2024-apr-dc-bat", kind="bat", product="rfangraphsdc", capture="20240410082920", extra=""),
    dict(key="2025-dc-bat", kind="bat", product="rfangraphsdc", capture="20250601113224", extra=""),
]


def dates(c):
    year = int(c["capture"][:4])
    target_start = datetime.strptime(c["capture"][:8], "%Y%m%d").date()
    cutoff = date.fromisoformat(c["baseline_end"]) if "baseline_end" in c else target_start - timedelta(days=1)
    return (date(year, 3, 20 if year == 2024 else 18), cutoff,
            target_start, date(year, 9, 30 if year == 2024 else 28))


def requests():
    for c in CHECKPOINTS:
        key, kind, ts = c["key"], c["kind"], c["capture"]
        yield key + ".html", f"https://web.archive.org/web/{ts}id_/https://www.fangraphs.com/projections?pos=all&stats={kind}&type={c['product']}{c['extra']}"
        start, cutoff, future, end = dates(c)
        for interval, a, b in [("source", start, cutoff), ("target", future, end)]:
            params = dict(pos="all", stats=kind, lg="all", qual="0", type="8", season=str(start.year),
                          season1=str(start.year), ind="0", team="0", rost="0", age="0", filter="",
                          players="0", month="1000", startdate=a.isoformat(), enddate=b.isoformat(),
                          pageitems="2000", pagenum="1")
            yield key + f"-{interval}.json", "https://www.fangraphs.com/api/leaders/major-league/data?" + urllib.parse.urlencode(params)
        # Capture must precede the first target game's scheduled start.
        params = dict(sportId=1, startDate=future.isoformat(), endDate=end.isoformat())
        yield key + "-schedule.json", "https://statsapi.mlb.com/api/v1/schedule?" + urllib.parse.urlencode(params)


def fetch(item):
    name, url = item
    path = ROOT / "raw" / name
    meta = path.with_suffix(path.suffix + ".source.json")
    # Initial investigation used .source.json for HTML; normalize that sidecar.
    old_meta = path.with_suffix(".source.json")
    if path.exists() and not meta.exists() and old_meta.exists():
        meta.write_bytes(old_meta.read_bytes())
    if path.exists() and meta.exists():
        record = json.loads(meta.read_text())
        if record["url"] != url or record["sha256"] != hashlib.sha256(path.read_bytes()).hexdigest():
            raise ValueError(f"cached input mismatch: {path}")
        return
    req = urllib.request.Request(url, headers={"User-Agent": "DugoutValueResearch/1.0"})
    with urllib.request.urlopen(req, timeout=55) as response:
        data, resolved = response.read(), response.url
    if "/web/" in url and resolved.split("/web/")[1].split("/")[0] != url.split("/web/")[1].split("/")[0]:
        raise ValueError(f"capture redirected: {url} -> {resolved}")
    path.write_bytes(data)
    meta.write_text(json.dumps(dict(path=name, url=url, resolved_url=resolved, bytes=len(data),
                                   retrieved_at=datetime.now(timezone.utc).isoformat(),
                                   sha256=hashlib.sha256(data).hexdigest()), indent=2) + "\n")
    print(name, len(data), flush=True)


if __name__ == "__main__":
    (ROOT / "raw").mkdir(exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(fetch, requests()))
