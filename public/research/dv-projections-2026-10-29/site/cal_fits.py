"""Historical entry point; use the corrected replay with forecast-date workload maps."""
import runpy, sys
from pathlib import Path
if "--only" not in sys.argv: sys.argv += ["--only", "calibration"]
runpy.run_path(str(Path(__file__).with_name("replay.py")), run_name="__main__")
