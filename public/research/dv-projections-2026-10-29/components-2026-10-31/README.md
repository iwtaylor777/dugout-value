# Component projections for hitters (October 30–31, 2026)

Dugout Value projections v1.5 adds component projections for hitters: batting runs, baserunning runs, fielding runs at every position, and positional value. It also uses them in the WAR totals.

- `PROTOCOL.md` fixed the method, the holdout seasons and the decision rule before any result was computed. `PROTOCOL.sha256` holds its hash and timestamp.
- `results.json` holds the holdout results by season and pooled (aggregates only).
- `fielding_params.json` holds the fitted fielding parameters (fit on target seasons 2017–21).
- `code/` contains the fielding model, the backtest, the 2027 build and the site builder (`build_dv_site_v15.py`).

## Results
Error is PA-weighted RMSE of WAR per 600 PA for hitters with 200+ PA in the target season and 100+ PA the season before, on 1,506 hitter-seasons from 2022–26:

| Model | Pooled RMSE | Seasons better than direct |
|---|---|---|
| Direct WAR model | 1.640 | — |
| WAR composed from components | 1.646 | 1 of 5 |
| 50/50 blend | 1.637 | 4 of 5 |

- The composed WAR did not meet the decision rule. The blend did, by about 0.2%.
- In v1.5, each hitter's 2027 rate moves halfway toward his composed rate. The same shift carries through 2031, but the shift was tested only one season ahead.

Fielding projections beat a Marcel-style baseline in every holdout season, and baserunning did too. Batting beat Marcel in four of five seasons.

## Data
- Inputs are the FanGraphs batting and fielding leaderboards for 2010–26.
- The raw data and per-player rows aren't redistributed.
