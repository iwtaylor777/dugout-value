# Free-agent contract predictions, 2026–27

These are the frozen predictions from Dugout Value trade model 2026-10-25.1 ($11 million per WAR, a 20% star premium, and a 50% reliever premium above 0.8 WAR). They cover the 30 most valuable MLB free agents expected to reach the market, plus Teruaki Sato. Article: https://dugoutvalue.com/analysis/what-this-winters-free-agents-should-cost

- `PROTOCOL-FA-2027.md`: what is predicted, the price and term rules, who reaches the market, and how the predictions will be scored.
- `predictions_frozen.json` / `.csv`: the 31 predictions with their flags, plus the players excluded and why. These are the predictions that will be scored.
- `LOCK-FA-2027.json`: SHA-256 hashes of the protocol, the predictions and every input, with the UTC time of the freeze (2026-10-25T22:08:19Z). Check any file with `sha256sum`.
- `AMENDMENTS.md` and `LOCK-AMENDMENTS.json`: the two changes made before free agency opened. Amendment 1 re-froze the predictions at $10.5 million per WAR and a 10% star premium. Amendment 2 withdrew it and restored this freeze. The lock records the hash and time of each file.
- `amendment-1-withdrawn/`: the withdrawn re-freeze, with its own protocol, predictions and lock.
- `predict.mjs`, `predict_lib.mjs`, `select.py`, `sato.json`: the scripts and inputs behind the predictions.
  - `predict.mjs` is the prediction script.
  - `predict_lib.mjs` prices every season with the site's defaults and nothing overridden, and it reproduces every row of `predict.mjs`.
  - `select.py` applies the rules for who reaches the market and which players make the list.
  - `sato.json` is Sato's projection, translated from his NPB record.
- `calibration/`: summary results of the checks against 2020–26 free-agent contracts, with the scripts that produced them.
  - The main checks set the model's price per WAR, its star premium and its reliever premium.
  - `mega.mjs` and `grid.json` are the check against the largest contracts that led to Amendment 1.
  - `amendment-2/` holds the check by signing year and on recent contracts that led to Amendment 2.

Not redistributed: the MLB Trade Rumors free-agent list and the FanGraphs free-agent tracker data used as inputs. Their hashes are in the lock file.
