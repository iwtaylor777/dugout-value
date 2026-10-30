# Bullpen leverage, 2021–26

Article: https://dugoutvalue.com/analysis/teams-save-their-best-relievers-for-the-wrong-inning

- `PROTOCOL.md`: the plan, written before any result was computed.
- `results.json`: every aggregate number in the article (leverage check, inning shares, team efficiency by season and for 2026, the swap estimate, the ZiPS check and the luck test with 95% intervals).
- `team_metrics.csv`: team-season efficiency, leverage-talent correlation and reshuffle value, 2021–26.
- `inning_chart.csv`: the data behind the first chart.
- Code: `li.py` (plate-appearance tables and the leverage index), `rel.py` (relief appearances with projections), `metrics.py` (team metrics), `where.py` (shares by inning and tier), `chase.py` (the luck test), `charts.py`.

Exploratory and descriptive. The code expects local Statcast pitch files and FanGraphs leaderboards, which are not redistributed, and Dugout Value preseason projections from the projection package (`/research/dv-projections-2026-10-29`). Player-level rows are not included. Paths in the scripts point to the author's working directories.
