# Projection benchmark, October 19, 2026

This is a retrospective evaluation of archived FanGraphs rate forecasts and
Depth Charts playing time. It does not evaluate a new Dugout Value projection.
See PROTOCOL.md for the design, excluded capture dates, and timing limitations.

## Reproduce the published scores

With Python 3.10+ and NumPy (the release used Python 3.13 and NumPy 2.3.5):

```sh
python3 replay.py
```

The replay verifies every file against manifest.json, then recomputes the
scores and all 5,000-resample intervals from inputs.json. It needs no network
or model fitting. Scores are compared exactly with results.json. A future
NumPy version that changes numerical results may require the release version.

## Files

- inputs.json: one row per resolved forecast player per checkpoint, including
  zero-work players; archived rates, outcomes, baseline estimates and identity
  evidence. Rates are null when undefined, never imputed to zero.
- results.json: all scores, source/target dates, denominators, coverage and
  unresolved identities. Its audits list every excluded prospect forecast.
- sources.json: source URLs, archive redirects, byte lengths and checksums.
- PROTOCOL.md: scoring rules and pre-scoring changes to the selected dates.
- scoring.py and replay.py: offline scoring code.
- fetch.py and run.py: original download, validation and normalization code.
- identities.json: provider ID links, restricted to the prospect IDs in these
  archives. They were collected later and are used only to establish identity.

Forecasts and outcome statistics are credited to FanGraphs; ZiPS is developed
by Dan Szymborski. Depth Charts combines projection rates with roster-based
playing-time estimates. Internet Archive preserves the historical pages. MLB's
schedule supplies the checks for game starts and suspended-game boundaries.
This is an independent evaluation, not a FanGraphs or MLB product.

## Rebuild from source

```sh
python3 fetch.py
python3 run.py --output rebuilt
```

This downloads the raw projection pages, outcome windows and schedules. The
original source checksums are in sources.json. Compare those hashes before
interpreting differences: current historical statistics can be corrected later.
The raw HTML and complete leaderboards are retained locally, not republished
in this bundle. The release's normalized inputs make the published calculation
reproducible even if an external page changes or becomes unavailable.

Actuals use exact FanGraphs numeric IDs or a publisher-supplied MLBAM crosswalk.
An unmatched ID is counted as zero only when it is verified and the complete
outcome table has been validated. Unresolved prospect identities are excluded
and disclosed; their absence is not treated as zero playing time. No names
alone are used for matching. All pitcher walks, including intentional walks,
enter this benchmark's K-BB%; this differs from the older ShapeCast event definition.

Two Depth Charts snapshots cannot establish accuracy in other seasons or
against other systems. The calendar-day pace baseline is intentionally simple;
the overseas openers and team schedules make it a weak comparator. The rate
baseline uses only the current season with a fixed 200-opportunity league prior;
it is not Marcel and does not use previous seasons. No new projection has been
promoted to the trade model as a result of this benchmark.
