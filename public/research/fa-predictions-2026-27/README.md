# Free-agent contract predictions, 2026–27

These are frozen contract predictions for the 30 most valuable MLB free agents expected to reach the market, plus Teruaki Sato. They come from Dugout Value trade model 2026-10-25.1: $11 million per WAR, a 20% star premium, and a 50% reliever premium above 0.8 WAR. The projections are updated for the 2026 season.

Article: https://dugoutvalue.com/analysis/what-this-winters-free-agents-should-cost

## The scored predictions

- `predictions_frozen.json` / `.csv`: the 31 predictions (Amendment 4) that will be scored, with their flags and the players excluded and why.
- `PROTOCOL-FA-2027.md`: the original protocol, covering what is predicted, the price and term rules, who reaches the market, and the scoring.
- `AMENDMENT-3.md`: the changes made on October 26, before free agency opened.
  - Projections updated for the 2026 season.
  - Pitcher roles taken from 2026 usage.
  - A corrected opt-out rule.
  - An NPB translation fit on past signings.
  - Half credit for fielding runs, removed by Amendment 4.
- `AMENDMENT-4.md`: removes Amendment 3's fielding credit, which double-counted a discount projections already make (see https://dugoutvalue.com/analysis/teams-pay-less-for-defense).
- `LOCK-AMENDMENT-4.json`: SHA-256 hashes of the scored files, the inputs and every earlier lock, with the UTC time of the freeze (2026-10-26T19:35:41Z). Check any file with `sha256sum`.
- `amendment-4/freeze_a4.py`: writes the Amendment 4 predictions files.
- `amendment-3/`: Amendment 3's predictions and lock inputs (its lock, `LOCK-AMENDMENT-3.json`, is at the top of this folder), with the scripts behind it and `outputs.txt`, the printed calibration results. The calibrations cover:
  - the projection update (`marcel.py`, `update2.py`, `krate.py`, `krookie.py`, `season_update.py`);
  - fielding (`defense.mjs`, `defense2.mjs`, `fa_fielding.py`);
  - the NPB translation (`npb_fit.mjs`);
  - the predictions themselves (`predict_v3.mjs`, `select_v3.py`, `freeze_a3.py`, `sato_k017.json`).

## Earlier versions

All earlier versions were frozen before free agency opened, and each keeps its own lock:

- `first-freeze/`: the first freeze, from October 25 at 22:08 UTC, with its lock, predictions and scripts. The protocol at the top of this folder is the one it locked.
- `amendment-1-withdrawn/`: the October 25 re-freeze at $10.5 million per WAR and a 10% star premium. It was withdrawn by Amendment 2.
- `AMENDMENTS.md` and `LOCK-AMENDMENTS.json`: Amendments 1 and 2.
- `calibration/`: the checks against 2020–26 contracts that set the model's prices. `amendment-2/` holds the check by signing year that led to Amendment 2.

## Not redistributed

These inputs are not included here. Their hashes are in the locks.

- The MLB Trade Rumors free-agent list.
- The FanGraphs free-agent tracker.
- FanGraphs leaderboards for 2015–26, including NPB stats.
- FanGraphs' 2026 preseason ZiPS.

The site's player database, including the 2026 season update, is in the public repository at `app/data/player-database.json`.
