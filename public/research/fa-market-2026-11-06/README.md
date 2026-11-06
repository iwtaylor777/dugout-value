# Free-agent values and market models — November 6, 2026

The live tracker now values current DV projections and shows public market forecasts separately. The original October 29 release remains unchanged for scoring. Market contract length is no longer selected by a threshold in projected WAR: each model value covers a stated, fixed comparison term. Where public forecasts exist, that term matches the displayed published estimate; elsewhere it is the previously chosen comparison term. These are valuation scenarios, not a newly validated DV forecast of contract length.

For Suzuki, the current four-year production value is $73.8M, compared with the original three-year/$48.3M forecast. Rogers's current five-year value is $74.2M, compared with the original four-year/$62.6M. Their performance forecasts have not been changed. The public forecast and its source are shown independently. No new market regression is used to set either headline number.

## Market-model tests

I tested three simple contract models on 373 signings by 265 players in the 2023–26 classes, fitting only earlier classes each time. They use pre-origin age, WAR and workload histories, offensive/pitching traits and prior usage. Signing teams, future performance, 2027 contract forecasts and target-season role are not inputs. The final training dataset has 647 contracts from 2020–26.

| Candidate | Total-log error | Change vs legacy reference | AAV-log error | Years MAE |
|---|---:|---:|---:|---:|
| Legacy price/term formula with regressed historical WAR proxy | .774 | — | .523 | .729 |
| Prior-class role median | .968 | — | .610 | .949 |
| Log total and log duration | .617 | 20.3% lower | .450 | .665 |
| Annual salary times continuous duration | .591 | 23.6% lower | .428 | .651 |
| Same, plus age/value interactions | .591 | 23.6% lower | .437 | .630 |

All candidates improved the primary total-error measure in every tested class. The age/value candidate's player-cluster interval for its broad gain versus the legacy reference is about 17.0–29.9%. This interval conditions on the fitted forecasts and does not cover the full model search or class uncertainty. The two salary/duration candidates are post-result diagnostics recorded in Amendment 1.

The largest contracts remain a concern. On the 25 outcomes of at least $100M, total-log error was .491 for the legacy reference, versus .600 for the age/value candidate and .621 for the salary/duration candidate. The outcome-selected group is not an independent prospective population; a high realized outcome naturally selects positive forecast errors. The separate origin-defined high-value group (84 contracts) improved about 13% with age/value interactions. That is promising evidence, but does not settle the upper tail. I retained all three candidates as research rather than claiming a dependable replacement for top-free-agent market forecasts.

The primary reference is the old pricing formula anchored to a three-year regressed WAR proxy and a healthy workload. It is not a full historical replay of current DV v1.5, so these percentages must not be advertised as improving on every current DV contract estimate. Nor do they establish superiority over MLBTR or FanGraphs. Public 2027 forecasts were not used to tune or train these regressions.

## Data and timing limits

The saved FanGraphs tracker records are filtered to Free Agent/GUARANTEED deals of at least $2M AAV, with apparent accepted QOs removed. Repeated player/class records retain the largest guarantee, avoiding later prorated re-signings. Recent history must contain at least 100 PA or 20 innings. Pitcher role comes from prior usage. 2020 workload/count features are annualized by 162/60; rate features use actual exposure.

The underlying contract records do not independently certify signing dates, Opening Day eligibility, or all opt-out/deferral/option economics. A fresh historical download was declined by the source. These are retrospective rolling class checks on saved data, not new untouched, signing-time-certified holdouts. Historical classes have also been examined in earlier research. Results conditional on a signed deal of at least $2M AAV do not validate forecasts for unsigned players or the whole minimum-salary pool.

## What changed on the site

- Current WAR and all five forecast seasons are used for every covered tracker player, including the 31 originally scored players.
- Current model value, attributed public market forecast and original dated forecast are separate fields.
- Contract valuation uses an explicit commitment; crossing a WAR threshold cannot add years. The old rule remains only in the immutable research release and this diagnostic's legacy reference.
- Public forecasts cover 54 players in the tracked class. The displayed source is MLBTR where available, otherwise FanGraphs' writer; source details include every covered estimate.
- The simulator uses those market forecasts for asking-price references where available, while its signing grade retains the separate DV model value. Other asking behavior remains a game assumption.
- Dollar/WAR settings, performance models and the original scored predictions are unchanged.

## Validation

Independent checks reproduced 528 score calculations, 1,833 scalar forecast outputs and all train-only imputation/scaling statistics. Seventy future-season mutations left origin features unchanged. A separate JavaScript replay reproduced all 1,833 predictions to less than 1e-8 million dollars. Current tracker pricing, fixed-term continuity, five-year completeness, original-forecast preservation and market/game separation are covered by site tests and the independent valuation check.

## Reproduce

Raw FanGraphs leaderboards, contract rows and detailed player forecasts are not redistributed. Restore the input files whose hashes are in `input_audit.json`, then set `DV_BASEBALL_ROOT` to their repository root and `DV_APP_ROOT` to the site checkout. Use Python 3.13 with numpy 2.3.5, scipy 1.16.3 and scikit-learn 1.7.2, one BLAS thread, and Node 24.

Run `experiment.py`, `baselines.mjs`, `score.py`, `composed.py`, then `score.py composed_scored.json composed_results.json` and `score.py age_value_scored.json age_value_results.json`. Run `validate.py`, then `replay.mjs`. All generated player rows remain in ignored `private/`. The baseline helper's only difference from the local study is its relative import of the bundled historical pricing code. The final coefficient files and aggregate outputs are included; none is a production contract predictor.

Sources: [FanGraphs contract tracker](https://www.fangraphs.com/roster-resource/free-agent-tracker?season=2026), [MLBTR 2026–27 forecasts](https://www.mlbtraderumors.com/2026/11/2026-27-top-50-free-agents-with-predictions.html), and [FanGraphs 2027 forecasts](https://blogs.fangraphs.com/2027-top-50-free-agents/). The original forecast release is in the adjacent `fa-predictions-2026-27` package.
