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

## Depth chart swap (October 31)
In the depth chart, a player's projected defense at a position replaces the defense in his 2026 role. Moves to DH or down the defensive spectrum used to count the full loss. In backtests the drop was overpredicted, so losses now count at 55%. The share was fit on 2022–24 and checked on 2025–26, where the bias for downward moves fell from −0.48 to −0.22 WAR per 600 PA and RMSE from 1.755 to 1.709. Upward moves were unbiased at full weight and are unchanged (`code/swapcal.py`).

## 2027 detail projections
The projections page shows AVG/OBP/SLG, wRC+, ERA, FIP, K% and BB%. Each comes from a separate model with the same inputs, learners and training windows as the WAR model, predicting that rate relative to the league (`code/detail2027.py`, `code/export_detail.py`). These rate models have not been backtested separately.

## Data
- Inputs are the FanGraphs batting and fielding leaderboards for 2010–26.
- The raw data and per-player rows aren't redistributed.
