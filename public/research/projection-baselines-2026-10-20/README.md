# Multi-season projection baselines

Scored October 20, 2026; published October 21, 2026. These comparisons reuse the five player lists and
target windows in the October 19 projection benchmark. They are retrospective
development results, not an untouched test of a new projection system.

## Reproduce the release

Unpack `projection-baselines-2026-10-20.tar.gz`, enter its directory, and run:

```sh
python3 -m pip install numpy==2.3.5
python3 replay.py
```

Python 3.13 and NumPy 2.3.5 were used for the release. The replay checks every
listed file's SHA-256, rebuilds the new rate and workload forecasts from the
normalized event counts and schedule totals, then recomputes all scores and
5,000-draw paired bootstrap intervals. It makes no network requests and fits
no model. Floating-point comparisons allow a tolerance of 1e-12.

`inputs.json` contains each scored player's archived forecast, outcome,
current-season counts, three prior seasons of counts, baseline forecasts and
roster group. Counts are ordered [PA or BF, SO, BB]; prior seasons run newest
to oldest. `results.json` includes forecast timestamps, scoring windows,
coverage exclusions, schedule totals and group scores. Bias is forecast minus
actual. Positive RMSE reduction means the first named method was better.

Rate scores weight players by actual later PA or BF. Workload scores weight
each player equally and retain zero outcomes. Only the two Depth Charts hitter
workload comparisons are primary playing-time tests. The basic ZiPS workload
scores are diagnostic. A player with no prior MLB work here has no work in the
three previous seasons, not necessarily no MLB career experience.

## Sources and limits

`sources.json` records requests and hashes for the historical FanGraphs counts,
MLB schedules and dated roster responses, plus the original normalized inputs.
`original-sources.json` preserves the first benchmark's source manifest for the
archived forecasts and outcomes. The earlier release remains available at
https://www.dugoutvalue.com/research/projection-benchmark-2026-10-19.tar.gz.

The replay verifies arithmetic from normalized inputs; it does not independently
revalidate provider data, identity matches or historical roster membership.
Raw provider responses are not bundled. The `source-code/` folder preserves
the fetch and normalization scripts for inspection. Running that full pipeline
also requires the earlier study's raw files and its directory layout; it is
not the offline replay entry point.

MLB's dated rosters were retrieved in October 2026, not saved on the original
forecast dates. `roster-validation.json` records bounded checks against official
records. Absence from an active roster does not identify injury, minor-league
assignment or another reason. Roster membership describes the error groups;
it does not adjust the forecasts. Historical season totals may contain later
scoring corrections. The protocol states the remaining timing limitations.

## Maintain the local study

In the repository, `fetch.py` retrieves the missing raw inputs, `run.py` validates
and normalizes them before scoring, and `package_release.py` creates the public
bundle. Preserve released bundles; publish any later changes under a new date
or version. The trade model is unchanged by this study.
