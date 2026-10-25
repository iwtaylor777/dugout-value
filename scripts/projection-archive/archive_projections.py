#!/usr/bin/env python3
"""Point-in-time archive of public projections, rosters and transactions.

Every run writes one new, immutable dated capture:

    <archive>/captures/<YYYY-MM-DD>T<HHMMSS>Z/
        raw/<name>.gz            exact response bytes, gzip-compressed
        extracted/<name>.json.gz projection rows pulled from FanGraphs pages
        manifest.json            url, status, bytes, sha256 (of the uncompressed
                                 response), retrieval time, row counts, errors
    <archive>/index.jsonl        one line per capture, append-only

Nothing in an existing capture is rewritten. A failed request is recorded in the
manifest rather than silently skipped, so a missing projection system on a given
day is visible. The archive holds provider data for private research. Do not
publish raw captures; publish derived results and hashes instead.

Usage:
    python3 archive_projections.py capture   [--archive DIR] [--force] [--dry-run]
    python3 archive_projections.py verify    [--archive DIR]
    python3 archive_projections.py status    [--archive DIR]

`capture` decides on its own whether today is a capture day (daily from March 1
through October 31, Mondays otherwise) unless --force is given, so the scheduler
can run it every morning.
"""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable, Iterable

ARCHIVER_VERSION = "1.1.0"  # 1.1.0: records FanGraphs query params and data-version stamp
DEFAULT_ARCHIVE = Path(os.environ.get("DUGOUT_ARCHIVE", Path.home() / "DugoutValueArchive"))
USER_AGENT = "DugoutValueArchive/1.0 (private research snapshot; spaced requests)"
FANGRAPHS_SPACING_SECONDS = 4.0
STATSAPI_SPACING_SECONDS = 0.5

# Projection systems as FanGraphs names them in its projections URL. Preseason
# systems are kept all year; rest-of-season ("r") systems matter in season. A
# system that is unpublished on a given day is recorded as such, not an error.
PRESEASON_SYSTEMS = ["steamer", "zips", "fangraphsdc", "atc", "thebat", "thebatx", "oopsy"]
ROS_SYSTEMS = ["steamerr", "rzips", "rfangraphsdc", "ratcdc", "rthebat", "rthebatx", "roopsy"]
STAT_GROUPS = ["bat", "pit"]

FANGRAPHS_PAGES = {
    "fg-injury-report.html": "https://www.fangraphs.com/roster-resource/injury-report/dodgers",
}

NEXT_DATA = re.compile(r'<script id="__NEXT_DATA__" type="application/json">([\s\S]*?)</script>')


# ---------------------------------------------------------------- schedule

def is_capture_day(day: dt.date) -> bool:
    """Daily March through October; Mondays November through February."""
    if 3 <= day.month <= 10:
        return True
    return day.weekday() == 0


# ---------------------------------------------------------------- requests

def build_requests(day: dt.date) -> list[dict]:
    """The full, ordered list of requests for one capture."""
    season = day.year if day.month >= 3 else day.year - 1  # roster season label
    reqs: list[dict] = []
    for system in PRESEASON_SYSTEMS + ROS_SYSTEMS:
        for stats in STAT_GROUPS:
            reqs.append(dict(
                name=f"fg-projections-{system}-{stats}.html",
                url=f"https://www.fangraphs.com/projections?pos=all&stats={stats}&type={system}",
                source="fangraphs", kind="projection", system=system, stats=stats))
    for name, url in FANGRAPHS_PAGES.items():
        reqs.append(dict(name=name, url=url, source="fangraphs", kind="page"))
    reqs.append(dict(
        name="mlb-teams.json",
        url=f"https://statsapi.mlb.com/api/v1/teams?sportId=1&season={season}",
        source="statsapi", kind="teams"))
    # Transactions: yesterday and today, so IL moves, options, DFAs and signings
    # can be reconstructed by date even if a capture day is missed.
    start = (day - dt.timedelta(days=7 if not is_daily(day) else 1)).isoformat()
    reqs.append(dict(
        name="mlb-transactions.json",
        url=f"https://statsapi.mlb.com/api/v1/transactions?sportId=1&startDate={start}&endDate={day.isoformat()}",
        source="statsapi", kind="transactions"))
    return reqs


def is_daily(day: dt.date) -> bool:
    return 3 <= day.month <= 10


def roster_requests(team_ids: Iterable[int], day: dt.date) -> list[dict]:
    reqs = []
    for team in sorted(team_ids):
        for roster_type in ("40Man", "active", "fullRoster"):
            reqs.append(dict(
                name=f"mlb-roster-{team}-{roster_type}.json",
                url=(f"https://statsapi.mlb.com/api/v1/teams/{team}/roster"
                     f"?rosterType={roster_type}&date={day.isoformat()}&hydrate=person"),
                source="statsapi", kind="roster", team=team, roster_type=roster_type))
    return reqs


Fetcher = Callable[[str], tuple[int, bytes, str]]


def http_fetch(url: str) -> tuple[int, bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read(), resp.url
    except urllib.error.HTTPError as err:
        return err.code, err.read() or b"", url


# ---------------------------------------------------------------- extraction

def extract_projection_rows(html: bytes) -> list[dict] | None:
    """FanGraphs projection rows from the page's embedded Next.js state."""
    match = NEXT_DATA.search(html.decode("utf-8", errors="replace"))
    if not match:
        return None
    try:
        queries = json.loads(match.group(1))["props"]["pageProps"]["dehydratedState"]["queries"]
    except (KeyError, TypeError, json.JSONDecodeError):
        return None
    for query in queries:
        key = query.get("queryKey") or []
        if key and key[0] == "/projections":
            data = (query.get("state") or {}).get("data")
            return data if isinstance(data, list) else None
    return None


def projection_query_params(html: bytes) -> dict | None:
    """The page's /projections query parameters. FanGraphs' `z` is a Unix-time data-version stamp."""
    match = NEXT_DATA.search(html.decode("utf-8", errors="replace"))
    if not match:
        return None
    try:
        queries = json.loads(match.group(1))["props"]["pageProps"]["dehydratedState"]["queries"]
    except (KeyError, TypeError, json.JSONDecodeError):
        return None
    for query in queries:
        key = query.get("queryKey") or []
        if key and key[0] == "/projections" and len(key) > 1 and isinstance(key[1], dict):
            return key[1]
    return None


def team_ids_from(payload: bytes) -> list[int]:
    teams = json.loads(payload).get("teams", [])
    ids = [t["id"] for t in teams if (t.get("sport") or {}).get("id") == 1 and t.get("active", True)]
    if len(ids) != 30:
        raise ValueError(f"expected 30 MLB teams, got {len(ids)}")
    return ids


# ---------------------------------------------------------------- capture

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_gz(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # mtime=0 keeps the gzip bytes deterministic for identical content.
    with open(path, "wb") as fh, gzip.GzipFile(fileobj=fh, mode="wb", mtime=0) as gz:
        gz.write(data)


def capture(archive: Path, now: dt.datetime, fetch: Fetcher = http_fetch,
            sleep: Callable[[float], None] = time.sleep, dry_run: bool = False) -> dict:
    day = now.astimezone(dt.timezone.utc).date() if now.tzinfo else now.date()
    capture_id = now.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
    final_dir = archive / "captures" / capture_id
    if final_dir.exists():
        raise FileExistsError(f"capture already exists: {final_dir}")
    work_dir = archive / "captures" / f".incomplete-{capture_id}"
    requests = build_requests(day)
    if dry_run:
        return dict(capture_id=capture_id, requests=[r["url"] for r in requests], dry_run=True)

    work_dir.mkdir(parents=True, exist_ok=False)
    entries: list[dict] = []
    last_source = None

    def run(req: dict) -> bytes | None:
        nonlocal last_source
        spacing = FANGRAPHS_SPACING_SECONDS if req["source"] == "fangraphs" else STATSAPI_SPACING_SECONDS
        if last_source is not None:
            sleep(spacing)
        last_source = req["source"]
        started = dt.datetime.now(dt.timezone.utc).isoformat()
        entry = {k: v for k, v in req.items()}
        entry["requested_at"] = started
        try:
            status, body, resolved = fetch(req["url"])
        except Exception as exc:  # network failure: record and continue
            entry.update(status=None, error=f"{type(exc).__name__}: {exc}")
            entries.append(entry)
            return None
        entry.update(status=status, resolved_url=resolved, bytes=len(body), sha256=sha256(body),
                     retrieved_at=dt.datetime.now(dt.timezone.utc).isoformat(),
                     path=f"raw/{req['name']}.gz")
        write_gz(work_dir / "raw" / f"{req['name']}.gz", body)
        if req["kind"] == "projection" and status == 200:
            rows = extract_projection_rows(body)
            entry["rows"] = None if rows is None else len(rows)
            params = projection_query_params(body)
            if params is not None:
                entry["query_params"] = params
                if isinstance(params.get("z"), (int, float)):
                    entry["data_version_utc"] = dt.datetime.fromtimestamp(params["z"], dt.timezone.utc).isoformat()
            if rows:
                seasons = sorted({str(r.get("Season")) for r in rows if r.get("Season") is not None})
                entry["seasons_in_rows"] = seasons
                extracted = json.dumps(rows, sort_keys=True, separators=(",", ":")).encode()
                write_gz(work_dir / "extracted" / f"{req['name'][:-5]}.json.gz", extracted)
                entry["extracted_path"] = f"extracted/{req['name'][:-5]}.json.gz"
                entry["extracted_sha256"] = sha256(extracted)
            elif rows is None:
                entry["note"] = "no projection payload found in page"
        entries.append(entry)
        return body if status == 200 else None

    teams_body = None
    for req in requests:
        body = run(req)
        if req["kind"] == "teams":
            teams_body = body
    team_ids: list[int] = []
    if teams_body is not None:
        try:
            team_ids = team_ids_from(teams_body)
        except Exception as exc:
            entries.append(dict(name="mlb-teams.json", kind="teams-parse", error=str(exc)))
    for req in roster_requests(team_ids, day):
        run(req)

    ok = [e for e in entries if e.get("status") == 200]
    projections = [e for e in entries if e.get("kind") == "projection"]
    manifest = dict(
        archiver_version=ARCHIVER_VERSION,
        capture_id=capture_id,
        capture_date_utc=day.isoformat(),
        started_at=entries[0]["requested_at"] if entries else None,
        finished_at=dt.datetime.now(dt.timezone.utc).isoformat(),
        requests=len(entries),
        succeeded=len(ok),
        projection_systems_with_rows=sorted({e["system"] + "-" + e["stats"] for e in projections if e.get("rows")}),
        rosters_captured=len([e for e in entries if e.get("kind") == "roster" and e.get("status") == 200]),
        entries=entries,
    )
    (work_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    manifest_sha = sha256((work_dir / "manifest.json").read_bytes())
    work_dir.rename(final_dir)  # atomic publish of the finished capture
    for path in final_dir.rglob("*"):
        if path.is_file():
            path.chmod(0o444)
    index_line = dict(capture_id=capture_id, manifest_sha256=manifest_sha, requests=len(entries),
                      succeeded=len(ok), projection_files_with_rows=len(manifest["projection_systems_with_rows"]),
                      rosters_captured=manifest["rosters_captured"])
    with open(archive / "index.jsonl", "a") as fh:
        fh.write(json.dumps(index_line, sort_keys=True) + "\n")
    return manifest


# ---------------------------------------------------------------- verify / status

def verify(archive: Path) -> list[str]:
    """Re-hash every stored file against its manifest and the index."""
    problems: list[str] = []
    index_path = archive / "index.jsonl"
    index = {}
    if index_path.exists():
        for line in index_path.read_text().splitlines():
            row = json.loads(line)
            index[row["capture_id"]] = row
    captures = sorted(p for p in (archive / "captures").glob("*") if not p.name.startswith("."))
    for cap in captures:
        manifest_path = cap / "manifest.json"
        if not manifest_path.exists():
            problems.append(f"{cap.name}: missing manifest")
            continue
        if cap.name not in index:
            problems.append(f"{cap.name}: not in index")
        elif index[cap.name]["manifest_sha256"] != sha256(manifest_path.read_bytes()):
            problems.append(f"{cap.name}: manifest changed after capture")
        manifest = json.loads(manifest_path.read_text())
        for entry in manifest["entries"]:
            if "path" not in entry:
                continue
            raw = gzip.decompress((cap / entry["path"]).read_bytes())
            if sha256(raw) != entry["sha256"]:
                problems.append(f"{cap.name}/{entry['path']}: hash mismatch")
            if "extracted_path" in entry:
                ext = gzip.decompress((cap / entry["extracted_path"]).read_bytes())
                if sha256(ext) != entry["extracted_sha256"]:
                    problems.append(f"{cap.name}/{entry['extracted_path']}: hash mismatch")
    for leftover in (archive / "captures").glob(".incomplete-*"):
        problems.append(f"{leftover.name}: interrupted capture (kept for inspection, not used)")
    return problems


def status(archive: Path) -> str:
    index_path = archive / "index.jsonl"
    if not index_path.exists():
        return f"No captures yet in {archive}"
    rows = [json.loads(l) for l in index_path.read_text().splitlines()]
    last = rows[-1]
    return (f"{len(rows)} captures in {archive}. Latest {last['capture_id']}: "
            f"{last['succeeded']}/{last['requests']} requests OK, "
            f"{last['projection_files_with_rows']} projection files with rows, "
            f"{last['rosters_captured']} rosters.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["capture", "verify", "status"])
    parser.add_argument("--archive", type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument("--force", action="store_true", help="capture even if today is not a scheduled day")
    parser.add_argument("--dry-run", action="store_true", help="list requests without fetching")
    args = parser.parse_args(argv)
    archive = args.archive.expanduser()
    if args.command == "capture":
        now = dt.datetime.now(dt.timezone.utc)
        local_day = dt.datetime.now().date()
        if not (args.force or args.dry_run or is_capture_day(local_day)):
            print(f"{local_day}: not a scheduled capture day")
            return 0
        if not args.dry_run:
            archive.mkdir(parents=True, exist_ok=True)
        manifest = capture(archive, now, dry_run=args.dry_run)
        if args.dry_run:
            print("\n".join(manifest["requests"]))
            return 0
        print(status(archive))
        failures = [e for e in manifest["entries"] if e.get("status") != 200]
        for e in failures:
            print(f"  not captured: {e.get('name')} status={e.get('status')} {e.get('error', '')}")
        return 0 if manifest["succeeded"] else 1
    if args.command == "verify":
        problems = verify(archive)
        print("Archive verified." if not problems else "\n".join(problems))
        return 0 if not problems else 1
    print(status(archive))
    return 0


if __name__ == "__main__":
    sys.exit(main())
