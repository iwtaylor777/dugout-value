"""Package only this study's public research inputs and reproducible code."""
import hashlib
import json
import shutil
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
DEST = REPO / "public/research/projection-baselines-2026-10-20"
DEST.mkdir(parents=True, exist_ok=True)
for name in ["README.md", "PROTOCOL.md", "roster-validation.json", "baselines.py", "scoring.py", "replay.py"]:
    shutil.copy2(ROOT / name, DEST / name)
for name in ["inputs.json", "results.json", "sources.json"]:
    shutil.copy2(ROOT / "results" / name, DEST / name)
shutil.copy2(ROOT.parent / "projection_benchmark/results/sources.json", DEST / "original-sources.json")
(DEST / "source-code").mkdir(exist_ok=True)
for name in ["fetch.py", "run.py", "package_release.py", "test_baselines.py"]:
    shutil.copy2(ROOT / name, DEST / "source-code" / name)
files = {str(p.relative_to(DEST)): hashlib.sha256(p.read_bytes()).hexdigest()
         for p in sorted(DEST.rglob("*")) if p.is_file() and p.name != "manifest.json" and "__pycache__" not in p.parts}
(DEST / "manifest.json").write_text(json.dumps(dict(date="2026-10-20", files=files), indent=2) + "\n")
archive = DEST.with_suffix(".tar.gz")
with tarfile.open(archive, "w:gz") as out:
    for name in [*files, "manifest.json"]:
        out.add(DEST / name, arcname=f"{DEST.name}/{name}")
archive.with_suffix(archive.suffix + ".sha256").write_text(hashlib.sha256(archive.read_bytes()).hexdigest() + "  " + archive.name + "\n")
print(archive)
