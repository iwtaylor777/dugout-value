# PAQ holdout test: does decision skill pay more against elite pitching?

Pre-registered October 24, 2026, before any of the holdout data below was downloaded or examined. This protocol extends the locked PAQ protocol (draft 4, SHA-256 `9cc7e368…1ffd`) and Amendment 1 (`5353b89f…ef7f`). Its own hash goes in `LOCK-HOLDOUT.json`.

## Why a holdout

PAQ's pre-registered Q5 found that hitters with better swing decisions (P1) lose less ground against elite pitchers. The estimate was +0.0053 runs/PA per SD of pre-game P1 [0.0028, 0.0077] in 2025–2026. An exploratory follow-up then looked at 2022–2026 regular seasons under about 80 specifications. It found the effect in every season, pooled at +0.0040 [0.0021, 0.0059], concentrated against relievers.

Those seasons have now been examined. This test uses data that no analysis of this question has touched: the 2021 regular season, and the 2021–2026 postseasons.

## What has and hasn't been seen

- **2021 regular season.** Its pitches were scored by PAQ with the models fit on 2022–2023 (fold `loso_2021`), and it entered PAQ's Q2–Q4 development pairs. No Q5-type quantity has been computed on it: no P1 × elite fit, no elite × outcome table, and no 2021 elite list. 2021 data was used only as the prior season that defines the 2022 elite list.
- **2020 regular season.** Not yet downloaded. It is needed only to define the 2021 elite list.
- **Postseasons 2021–2026.** Not yet downloaded. PAQ's loader dropped every non-regular-season row (`game_type != "R"`). No one has looked at them.

## Data, fetched after this file is locked

1. **2020 regular season.** Baseball Savant pitch-level search CSVs, `hfGT=R|`, July 23 to September 27, 2020. Fetched in 3-day chunks with SHA-256 receipts, the same way as `fetch_savant.py`.
2. **Postseasons 2021–2026.** Baseball Savant pitch-level search, `hfGT=F|D|L|W|` (Wild Card, Division Series, LCS, World Series), from the day after each regular season ends through November 15. The year 2020 is excluded.
3. **2026 cutoff.** The 2026 postseason is in progress. It is included through games with `game_date ≤ 2026-10-23`, the day before this file was locked. Later 2026 games are excluded even if they appear in the download.

## Inputs (no postseason pitch is scored by the PAQ models)

Every input comes from PAQ's frozen models and code. The code is hashed in `run_info.json`, and the models in `models_manifest.json`.

- **Elite pitcher, regular-season block (2021).** The bottom 20% of pitchers by 2020 mean swing hittability H_s, among pitchers with ≥ 300 scored 2020 pitches. This is `tests.elite_map` with prior season 2020. The 2020 pitches are scored with the frozen `full` fold, which never saw 2020, using PAQ's scoring code unchanged. Only the 2020 H_s by pitcher is used.
- **Elite pitcher, postseason block (season s).** The same rule applied to season s's regular-season H_s: ≥ 300 scored regular-season pitches, bottom 20%. Postseason pitches never enter the elite rule.
- **Hitter skill.**
  - Regular season: pre-game shrunk season-to-date P1, from `SC.pregame_hitter_table`, with ballast 1,000 pitches.
  - Postseason: the hitter's shrunk P1 over his full season-s regular season, as of the day after it ends.
- **Hitter xwOBA and pitcher xwOBA allowed** for the log5 expectation.
  - Regular season: pre-game shrunk season-to-date values, as in `q5_table`, with ballast 200.
  - Postseason: full regular-season shrunk values as of the day after the season ends.
  - League xwOBA comes from the same season's regular season.
- **Outcome.** (PA xwOBA − log5 expectation) / 1.25, exactly as in `q5_table`. PA xwOBA (`pa_x`) is built from postseason PA rows by PAQ's own PA-building code (`score.py`). `tto`, `by_starter`, `pinch_hit`, `in_denominator` and `woba_denom` come from the same code.
- **Sample.** As Q5: wOBA-denominator, in-denominator, non-pinch-hit PAs against pitchers on that block's elite list, with or without the elite flag. PAs with any input missing are dropped and counted.

## Model

This is the Q5 model, pooled across the two blocks:

```
resid_runs ~ z(P1) + elite + z(P1)×elite + z(xwOBA) + z(xwOBA)×elite + same_hand + tto2 + tto3 + starter
             + park (home team) + season dummies + postseason + postseason×elite
```

- z(P1) = (P1 − block-season mean) / 0.154. The 0.154 is the registered Q5 SD of pre-game P1, so β is in runs per PA per Q5-SD of P1.
- z(xwOBA) is standardized within block-season.
- Standard errors are two-way clustered by hitter and pitcher (`ols_cluster`).
- β is the coefficient on z(P1) × elite.

## Primary test and pass rule

**H1.** β > 0 in the pooled holdout (2021 regular season plus 2021–2026 postseasons through the cutoff).

**Pass** requires all three:
- one-sided p < 0.025 on the pooled β; and
- a positive point estimate when the same model is fit on the 2021 regular-season block alone; and
- a positive point estimate when it is fit on the postseason block alone.

Each block's estimate, CI and power is reported whatever the verdict.

**Power, stated in advance.**
- Planning effect 0.004 runs/PA (the exploratory pooled estimate). The pre-registered Q5 estimate was 0.0053.
- Expected SEs: about 0.0022 for the 2021 regular season and about 0.0053 for about 18,000 postseason PAs, combining to about 0.0020.
- Minimum detectable effect at 80% power is about 0.0057.
- Power is about 52% at 0.004 and about 74% at 0.0053.

**This test may fail even if the effect is real.**

## Secondary analyses (each labeled; no extra claims rest on them)

- **S1, relievers only.** The same pooled model restricted to PAs against relievers (`starter == 0`), where the exploratory effect was concentrated. It is Holm-adjusted together with H1. It is reported as supporting H1 only if H1 passes.
- **S2, postseason block alone.** Descriptive. Its power is about 15–25%, so a null here is not evidence against the effect.
- **S3, sensitivity.** H1 excluding the 2026 postseason. Descriptive.
- **S4, size in plain units.** The pooled β in wOBA points (× 1,250 per SD), and in runs per season for a regular with about 88 elite PA.

## Interpretation rules, fixed now

- **Pass.** Report as a confirmed holdout replication of the Q5 finding, at the estimated size.
- **Fail with a positive pooled estimate.** Report as not confirmed, with the estimate, the CI and the power, and do not call it a refutation.
- **Pooled estimate ≤ 0, or a CI that excludes +0.002.** Report as evidence against the finding at the planned size.
- **Individual hitters.** Their elite splits are never tested or named. The exploratory work found their reliability at 0.02–0.2.
- **Any deviation.** A deviation from this file, such as a data problem the rules above don't cover, is written as a dated amendment before the holdout outcomes are fitted. If it has to be made after the fit, it is reported as a deviation alongside the result.

## Order of operations

1. Lock this file: record its SHA-256 in `LOCK-HOLDOUT.json`.
2. Fetch 2020 regular-season and 2021–2026 postseason data, with receipts.
3. Audit the postseason rows with PAQ's own audit checks, plus game counts per season. The audit reads no outcomes.
4. Score the 2020 pitches (H_s only) and build the 2020 elite list. Build the 2021 regular-season and postseason tables.
5. Fit H1 and the secondaries once, with seed 20261024 for anything stochastic.
6. An independent agent verifies the result before it is reported.
