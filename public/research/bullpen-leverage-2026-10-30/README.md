# Bullpen leverage, 2021–26

Article: https://dugoutvalue.com/analysis/bullpen-management-is-harder-than-you-think

- `PROTOCOL.md`: the plan, written before any result was computed. It covers the leverage index, talent, the hindsight estimates, team efficiency and the luck test.
- Added after the first results (exploratory): the real-time fireman rule (`fireman.py`, sixth to eighth innings in `fireman2.py`), the next-day rest cost (`restcost.py`), repeatability and closer-role decomposition (`flex.py`, `splithalf.py`) and the ninth-inning and extra-inning comparisons (`ties.py`).
- `results.json`: every aggregate number in the article.
- `team_metrics.csv`: team-season efficiency, leverage-talent correlation and reshuffle value, 2021–26. `inning_chart.csv`: data for the first chart.
- Core code: `li.py` (plate-appearance tables and leverage index), `rel.py` (relief appearances with projections), `metrics.py`, `where.py`, `chase.py`, `charts.py`.

The code expects local Statcast pitch files and FanGraphs leaderboards, which are not redistributed, and Dugout Value preseason projections from the projection package (`/research/dv-projections-2026-10-29`). Player-level rows are not included. Paths in the scripts point to the author's working directories.
