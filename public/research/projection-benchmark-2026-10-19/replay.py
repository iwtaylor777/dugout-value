#!/usr/bin/env python3
"""Verify the release files and reproduce every published aggregate score."""
import hashlib
import json
from pathlib import Path

from scoring import evaluate

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / "manifest.json").read_text())
for name, expected in manifest["files"].items():
    if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != expected:
        raise ValueError(f"checksum mismatch: {name}")
inputs = json.loads((ROOT / "inputs.json").read_text())
expected = json.loads((ROOT / "results.json").read_text())
for key, rows in inputs.items():
    actual = evaluate(rows, expected["bootstrap_resamples"])
    if actual != expected["scores"][key]:
        raise ValueError(f"score mismatch: {key}")
    print(key, "reproduced", len(rows), "players")
print("All published scores reproduced; no model was refitted.")
