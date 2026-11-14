"""Puts the package's site/ and model-v1/ code on the path. Set DV_RAW_DIR and DV_MILB_DIR to the raw FanGraphs and
MLB Stats API files described in ../../input-manifest.json."""
import sys
from pathlib import Path
PACKAGE = Path(__file__).resolve().parents[2]
sys.argv = sys.argv[:1]
sys.path.insert(0, str(PACKAGE / 'site'))
import runtime  # noqa: E402
runtime.configure(normalize_ip=True)
HERE = Path(__file__).resolve().parents[1]
