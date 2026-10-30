# DV WAR contact adjustment with full fielding credit

This release supplies the hitter leaderboard and the current article at
`/analysis/a-statcast-war`. DV WAR = published fWAR plus half of expected minus
actual contact runs, centered per PA over the full season and converted to wins.
Fielding, framing, baserunning, positional and replacement components retain full
published credit. Pitcher WAR is unchanged. The table includes 300+ PA hitters
in 2024–26: 286, 277 and 267 players.

## Validation and scope

The current formula lowered next-season team run-differential error by 2.9%
versus fWAR in retrospective 2022–26 tests, with actual later playing time held
fixed. The roster-turnover comparison was inconclusive. These previously examined
seasons support a useful batting signal, not proof of superior individual past
WAR. `results.json` reports every fixed candidate and uncertainty. The separate
forecasting diagnostic is in `calibration_results.json`; its fitted calibration
is not the leaderboard formula. `REPORT.md` preserves the detailed audit as it
stood before adopting this candidate.

The original locked study is a different specification. Its files and the
existing 2027 registration have not been changed by adopting this leaderboard.
Its salary, stability and original primary-test results must not be attributed
to this exact formula.

## Reproduce

`reference/src` contains unmodified original attribution and event code;
`reference/LOCK-DVWAR-v1.json` preserves its lock. `runtime.py` redirects paths.
The private pitch and component inputs are those described in `AUDIT-README.md`.
Set `DV_WAR_AUDIT_INPUT` to the private cache and `DV_WAR_SOURCE_ROOT` to the
checkout containing raw inputs (or `DV_WAR_FG_DIR` to the FanGraphs JSON folder).
Install `requirements.txt` in an isolated environment; LightGBM on macOS requires
OpenMP. The original source inputs are not redistributed.

Run `prepare.py`, `components.py`, `prior_speed.py`, `evaluate.py`,
`calibration_check.py`, `descriptive_checks.py`, `report.py` and
`verify_measurements.py` as described in `AUDIT-README.md`. All evaluations use
the same original model settings. Different model recipes need separate caches.

Once the validated full-season components are available, run:

```bash
python build-dv-war-leaderboard.py --output /path/to/dv-war-hitters.json
```

The repository copy is `scripts/build-dv-war-leaderboard.py`. It checks that the
full league batting adjustment sums to zero before applying the 300-PA table
cutoff. `leaderboard_build.json` records source, component and output hashes.
`app/data/dv-war-hitters.json` is the table input; the article draft also reads its
player examples from that file.

`package_release.py verify` validates this package; running it without arguments
regenerates the manifest, archive and SHA-256 file. The original audit manifest
is preserved as `audit_release_manifest.json`. No raw player-level research
observations or provider source leaderboards are included.
