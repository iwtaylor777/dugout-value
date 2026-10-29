# Dugout Value WAR v1: validation files (October 29, 2026)

These files go with the article "A Statcast-built WAR measures hitters better, but pitchers are harder".

## Order of events

| Time (UTC) | Event | File |
|---|---|---|
| 14:19 | Protocol locked, before anything was built | `PROTOCOL-VALUE-WAR.md`, `LOCK-PROTOCOL-VALUE-WAR.json` |
| 14:32 | Amendment 1 adds the roster-change test (T7) as co-primary, after a development look at T1 and before any holdout computation | `AMENDMENT-1-VALUE-WAR.md`, `LOCK-AMENDMENT-1-VALUE-WAR.json` |
| 18:40 | Weights and code locked after tuning on 2016–21 | `LOCK-DVWAR-v1.json` (file hashes and parameters), `tune_dev.json` |

- **Holdout (2022–26) results:** `holdout_results_v1.json`. Every test is included.
- **Development log:** `DEVLOG-WAR.md`. Every development decision is listed, along with two corrections to the season-level code made after the lock. Neither affects T1 or T7.
- **Code:** `src/`. The Statcast download (`fetch_statcast.py`), run values and event tables (`events.py`), event models and credit (`attrib.py`), the split-season tests (`split.py`, `evalsplit.py`), the season-level tests (`season.py`, `eval_season.py`, `dvwar.py`, `fg.py`), tuning (`tune.py`) and the holdout runner (`run_holdout.py`).

Statcast pitch data (Baseball Savant), FanGraphs leaderboards and the FanGraphs free-agent tracker are not redistributed. Rebuilding the results requires downloading them again.
