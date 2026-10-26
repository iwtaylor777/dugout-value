# Amendments to the 2026–27 free-agent predictions

The scored predictions are the first freeze: `PROTOCOL-FA-2027.md`, `predictions_frozen.json` / `.csv` and `LOCK-FA-2027.json` in this folder. They were locked at 2026-10-25T22:08:19Z under trade model 2026-10-25.1 ($11M per WAR, a 20% star premium, and a 50% reliever premium above 0.8 WAR). Skubal is priced at 10 years and $533.6M. This file records the two changes made after that, both before free agency opened. Its own hash and timestamp are in `LOCK-AMENDMENTS.json`.

## Amendment 1 (October 25, 2026), withdrawn

We re-froze the predictions under model 2026-10-25.2, with $10.5M per WAR and a 10% star premium. That model priced Skubal at 10 years and $486.4M. The reason was a check against the 27 largest non-reliever contracts of 2020–26: those deals signed for 0.87× model 2026-10-25.1, and Gerrit Cole's deal for 0.81×. The re-freeze kept the same 31 players and the same terms, with every total 4–9% lower. Its protocol, predictions and lock (locked at 2026-10-25T22:20:54Z) are in `amendment-1-withdrawn/`.

## Amendment 2 (October 26, 2026): Amendment 1 withdrawn

We withdrew Amendment 1 and restored the first freeze as the scored predictions. The check behind Amendment 1 compared every signing year against the model at a constant 3% annual inflation. Free-agent prices have risen faster than that. Players who signed in 2022–24 got 0.80–0.85× model 2026-10-25.1, the 2025 class 0.90× and the 2026 class 1.00×; these ratios use weighted three-year WAR. Most of the large long-term contracts in Amendment 1's check were signed in 2020–23, before that rise, so they were the wrong benchmark for this winter.

Recent large contracts support the original settings:

| Sample | Model 2026-10-25.1 ($11M, 20%) | Model 2026-10-25.2 ($10.5M, 10%) |
|---|---|---|
| 2026 class, all non-relievers projected at 1+ WAR (projections at signing, n = 50) | 1.03× | 1.09× |
| 2026 class, projected 3+ WAR (n = 8) | 1.13× | 1.22× |
| 2025–26 contracts of $100M+ (three-year WAR, n = 14) | 1.16× | 1.25× |
| 2025–26 contracts of 5+ years (n = 13) | 1.09× | 1.17× |

A larger star premium fit the stars only slightly better: at $11M per WAR, raising it from 20% to 30% moved the 2026 stars from 1.13× to 1.10×. We kept 20% because it is the setting that was frozen.

Nothing else changed: not the rules for price, term, market reach or scoring, and not the inputs. The site's trade model was returned to version 2026-10-25.1 at the same time. The scripts and output for this check are in `calibration/amendment-2/`.
