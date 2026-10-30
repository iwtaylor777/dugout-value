# Free-agent contract estimates, 2026–27

Current estimates are recorded October 29, 2026, using DV Projections v1.3 through the completed 2026 season. Revision R1, recorded the same evening, sets Skubal's term to 10 years by hand and adds a note on Jake Bauers. The article is “Tarik Skubal is worth $386 million on the open market.”

## Current snapshot

- `predictions_frozen.json` / `.csv`: revision R2 of the 31 estimates, the top 30 modeled MLB totals expected to reach the market plus Teruaki Sato. They include the 2027 forecast used to price the contract, later WAR paths, fixed settings, flags, exclusions and unmodeled coverage.
- `LOCK-DV-20261029-R2.json` and `DV-20261029-R2.md`: revision R2, which corrects 2027 ages (no listed price or term changed). Do not change this snapshot after observing contracts.
- `LOCK-DV-20261029-R1.json` and `DV-20261029-R1.md`: revision R1's timestamp, hashes and two editorial changes. Its table is kept in `archive/2026-10-29-dv-r1/`.
- `LOCK-DV-20261029.json`: timestamp and hashes of the original October 29 inputs, pricing code and prediction files, which are kept in `archive/2026-10-29-dv-original/`.
- `DV-20261029.md`: precise source, coverage, workload and extension conventions.
- `PROTOCOL-FA-2027.md`: scoring definitions for guarantees, term, AAV, flags, eligible contracts and dated benchmarks. The actual current freeze time is in the current lock; historical claims about when free agency would open are not used to date this release.
- `code/`: the current pricing, term, class-matching and freeze code, with the matching value/aging libraries.

The numeric forecasts use $11M per net WAR, 20% extra for net wins above two, a 50% reliever premium above .8 WAR, 3% annual inflation and 10% discounting. The roster allowances are .5 WAR for hitters/starters and .2 for relievers. The term rule is unchanged. All five DV years are used directly; subsequent years extend rate and workload separately with the fixed age policy. In the original snapshot no term or price was forced by hand. Revision R1 sets one term, Skubal's, to 10 years; his price for those years still comes from the model.

Michael King's reported opt-out is included as a known market-reach decision, with the MLB report URL stored in the JSON. Other option decisions follow the fixed model rule until observed. Kyle Wright is marked unmodeled because recent-history coverage and a current public baseline are absent; he is not assigned zero value. The extra class identities matched outside the roster snapshot fall below the displayed cutoff. Sato's separate six-player NPB translation remains 2.5 first-year WAR and four years/$80M. Posting-fee and QO flags do not change numeric prices.

## Reproduction

Use the repository revision containing this release, its `app/data/player-database.json` and `app/data/dv-projections.json`, the original local MLB Trade Rumors list and full FanGraphs season leaderboards. Those raw third-party inputs are not redistributed; their hashes are recorded. Sato's translation input is `amendment-3/sato_k017.json`.

First generate complete class identities outside the roster snapshot using `code/scripts/build-fa-class-coverage.py --database REPOSITORY/app/data/player-database.json --class-list LOCAL_MLBTR_LIST --raw LOCAL_RAW --output PRIVATE_CLASS`. The raw directory contains complete `fg_bat_YEAR.json` and `fg_pit_YEAR.json` responses, 2010–26. The helper uses listed hitting/pitching position before matching a historical identity, so occasional position-player pitching is not treated as his role.

Use the projection package's `site/build_dv_site.py` with `PRIVATE_CLASS/extended_database.json` and the same current local fitted forecasts, map, history and retention inputs to produce `PRIVATE_CLASS/extended_projections.json`. This is the same builder used for the main current projection artifact; it does not retrain or tune the extra players.

Export `DV_FA_EXTRA_PLAYERS=PRIVATE_CLASS/extra_players.json` and `DV_FA_EXTRA_PROJECTIONS=PRIVATE_CLASS/extended_projections.json`, then run:

```sh
node code/scripts/freeze-dv-free-agents.mjs REPOSITORY LOCAL_MLBTR_LIST amendment-3/sato_k017.json LOCAL_RAW PRIVATE_REPLAY
```

Compare every numeric prediction with the recorded JSON. A new replay timestamp changes file hashes; it is not a replacement for the existing dated predictions. The complete 31-row replay was verified exactly before this release. The current article imports the recorded JSON directly, avoiding a separately copied table.

## Earlier records

`archive/2026-10-26-zips-release.tar.gz` is the previous complete published release, with its predictions and original locks intact. The older root locks and amendments refer to historical snapshots; verify their predictions within the corresponding archive, not against the current root table. Calibration scripts and earlier translations remain available for provenance. No old lock is rewritten to endorse the new numbers.

The settings were calibrated against historical contracts; the current class is a prospective contract-estimate exercise. The projection package separately reports rate and full-season WAR validation, including zero-workload players. Historical comparisons have been reused and do not establish precise future contract prices.
