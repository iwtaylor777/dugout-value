# Free-agent contract predictions, 2026–27

Frozen predictions from Dugout Value trade model 2026-10-25.1 for the 30 most valuable MLB free agents expected to reach the market, plus Teruaki Sato. Article: https://dugoutvalue.com/analysis/what-this-winters-free-agents-should-cost

- `PROTOCOL-FA-2027.md`: what is predicted, the price and term rules, who reaches the market, and how the predictions will be scored.
- `predictions_frozen.json` / `.csv`: the 31 predictions, their flags, and the players excluded and why.
- `LOCK-FA-2027.json`: SHA-256 hashes of the protocol, the predictions and every input, with the UTC time of the freeze. Check any file with `sha256sum`.
- `predict.mjs`, `predict_lib.mjs`, `sato.json`: the prediction script, a version that prices with the site's defaults and nothing overridden (it reproduces every row), and Sato's translated projection.
- `calibration/`: summary results of the checks against 2020–26 free-agent contracts that set the model's $11 million per win, 20% star premium and 50% reliever premium, with the scripts that produced them.

Not redistributed: the MLB Trade Rumors free-agent list and the FanGraphs free-agent tracker data used as inputs. Their hashes are in the lock file. The player database and model code are in the site's public repository.
