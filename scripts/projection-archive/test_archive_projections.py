"""Offline tests for the projection archiver. Run: python3 -m pytest -q (or python3 test_archive_projections.py)."""
import datetime as dt
import gzip
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import archive_projections as ap  # noqa: E402

TEAMS = {"teams": [{"id": 100 + i, "sport": {"id": 1}, "active": True} for i in range(30)]}


def page(rows):
    state = {"props": {"pageProps": {"dehydratedState": {"queries": [
        {"queryKey": ["/projections", {"type": "zips", "z": 1792565830}], "state": {"data": rows}}]}}}}
    return f'<html><script id="__NEXT_DATA__" type="application/json">{json.dumps(state)}</script></html>'.encode()


def fake_fetch(url):
    if "projections" in url and "type=zips&" in url + "&":
        return 200, page([{"PlayerName": "A", "Season": 2027, "WAR": 3.1}]), url
    if "projections" in url and "type=oopsy" in url:
        return 404, b"", url
    if "projections" in url:
        return 200, page([]), url  # page exists, system not yet published
    if "/teams?" in url:
        return 200, json.dumps(TEAMS).encode(), url
    if "transactions" in url:
        return 200, b'{"transactions": []}', url
    if "/roster?" in url:
        return 200, b'{"roster": []}', url
    return 200, b"<html>injury report</html>", url


def run_capture(archive, when=dt.datetime(2026, 11, 2, 11, 0, tzinfo=dt.timezone.utc)):
    return ap.capture(archive, when, fetch=fake_fetch, sleep=lambda s: None)


def test_schedule():
    assert ap.is_capture_day(dt.date(2027, 3, 1))
    assert ap.is_capture_day(dt.date(2026, 10, 31))
    assert ap.is_capture_day(dt.date(2026, 11, 2))      # Monday
    assert not ap.is_capture_day(dt.date(2026, 11, 3))  # Tuesday


def test_capture_writes_immutable_verified_archive():
    with tempfile.TemporaryDirectory() as tmp:
        archive = Path(tmp)
        manifest = run_capture(archive)
        assert manifest["rosters_captured"] == 90
        assert manifest["projection_systems_with_rows"] == ["zips-bat", "zips-pit"]
        cap = archive / "captures" / manifest["capture_id"]
        zips = next(e for e in manifest["entries"] if e["name"] == "fg-projections-zips-bat.html")
        assert zips["rows"] == 1 and zips["seasons_in_rows"] == ["2027"]
        assert zips["data_version_utc"].startswith("2026-10-")
        rows = json.loads(gzip.decompress((cap / zips["extracted_path"]).read_bytes()))
        assert rows[0]["WAR"] == 3.1
        missing = next(e for e in manifest["entries"] if e["name"] == "fg-projections-oopsy-bat.html")
        assert missing["status"] == 404  # recorded, not dropped
        assert ap.verify(archive) == []
        # A second capture at the same second is refused rather than overwriting.
        try:
            run_capture(archive)
            raise AssertionError("expected FileExistsError")
        except FileExistsError:
            pass


def test_verify_detects_tampering():
    with tempfile.TemporaryDirectory() as tmp:
        archive = Path(tmp)
        manifest = run_capture(archive)
        target = archive / "captures" / manifest["capture_id"] / "raw" / "mlb-transactions.json.gz"
        target.chmod(0o644)
        ap.write_gz(target, b'{"transactions": ["edited"]}')
        assert any("hash mismatch" in p for p in ap.verify(archive))


def test_network_failure_is_recorded():
    def flaky(url):
        if "transactions" in url:
            raise TimeoutError("timed out")
        return fake_fetch(url)
    with tempfile.TemporaryDirectory() as tmp:
        manifest = ap.capture(Path(tmp), dt.datetime(2026, 11, 2, 11, tzinfo=dt.timezone.utc),
                              fetch=flaky, sleep=lambda s: None)
        entry = next(e for e in manifest["entries"] if e["name"] == "mlb-transactions.json")
        assert entry["status"] is None and "TimeoutError" in entry["error"]
        assert ap.verify(Path(tmp)) == []


def test_offseason_transactions_cover_the_week():
    reqs = ap.build_requests(dt.date(2026, 11, 2))
    tx = next(r for r in reqs if r["kind"] == "transactions")
    assert "startDate=2026-10-26" in tx["url"] and "endDate=2026-11-02" in tx["url"]


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
