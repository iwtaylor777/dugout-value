# PAQ independent verification

Verifier, October 24, 2026. I modified nothing under `/home/claude/paq/`. All of my code and intermediate files are in `/home/claude/paq-verify/`: `q1_check.py`, `zone_check.py`, `build_tables.py`, `q23_check.py`/`q23_variant.py`, `calib_check.py`, `rescore2026.py`, `q1_2026_zone.py`, `q5_check.py`, `t1_check.py`, `t1_x.py`. None of the independent recomputations import pipeline code. `rescore2026.py` imports the code directory only to unpickle the frozen models. It calls `predict` on them and never refits.

## Verdict

**Reportable with the listed corrections.** I found no blocker. Every pass/fail verdict reproduces and follows PROTOCOL.md (draft 4) plus AMENDMENT-1.md. Hashes match. There is no test-season leakage into fitting or into the T1 power rule.

Six corrections are needed before the write-up is published:
1. Q5 effect units are mislabeled (see M1).
2. The 2026-only Q2 signal is partly an artifact of model inputs (see M2).
3. The failure of T1's positive controls is a power problem in the design, not a bug. "Unreliable" should read "uninformative," and the secondary X → starter-outs number must not be headlined (see M3).
4. p_ref drifts in the test seasons, so the league mean of D is not zero (see m1).
5. The undisclosed code edits and the fit change need provenance notes (see m2 and m3).
6. The Q5 phrasing needs the fix in M1.

## Confirmed

- **Lock.** SHA-256 of PROTOCOL.md (`9cc7e368…1ffd`) and AMENDMENT-1.md (`5353b89f…ef7f`) match LOCK.json. The scores S_2021–S_2026, power.json, the models manifest and all 7 model files match their recorded hashes. The code hash recomputes to `06de9b1c…c515`, which equals run_info.json and the models manifest. No pipeline `.py` file was modified after the fit started (models.py 11:39, fit 11:43).
- **Order (D).**
  - Models were fit on 2021–2023 rows only (`run.py:231-243`; manifest `development_seasons` [2021, 2022, 2023]).
  - power.json was written at 12:36:46 and 2025 scoring began at 12:37:02. `t1_power` (`tests.py:867-883`) fits on 2022–2024 only. It uses 2025–26 only for the count of eligible team-games (N_test 8,852), which rests on structure and the BF of prior starts.
  - MDE = 2.8 × 0.018988 × √(13286/8852) = 0.0651. The arithmetic is correct and the value exceeds 0.05, so T1 is correctly dropped and m = 3.
  - These are all from development seasons: the P2 cut (`run.py:294`, DEV_SEASONS), h̄_s (2023), the Q2–Q4 weights and ridge alpha (dev pairs 2021/2022/2024), and the z-reference SDs (2022–2024).
- **Holm (ii), recomputed.** The intersection–union p is the maximum of the two season p-values: Q2 0.2773, Q3 0.3825, Q4 0.7333. The thresholds are 0.0083, 0.0125 and 0.025. All three fail, and step-down stops at the first test. For Q5 with m = 2, P1 (p = 1.2e-5) passes against 0.0125 and P2 (0.295) fails against 0.025. `tests.py:48-59` and `924-946` match the protocol. The extra conditions are in the code: Q2 needs CI > 0 and a positive refit P1 coefficient, Q3 and Q4 need a 0.5% floor and CI > 0, and T1 needs the pooled CI > 0 plus a positive estimate in each season.
- **Q1 (i), recomputed.** For P1 in 2025, using odd/even games by date per hitter, ≥ 300 denominator PA, Pearson r and Spearman–Brown with k = 300/253.2: r = 0.818 and rel300 = **0.842**, CI [0.799, 0.874], against the reported 0.8417 [0.800, 0.875]. In 2026 I get 0.835 against 0.836. wOBA comes out at 0.322 and 0.222, against 0.322 and 0.223. Rank correlation gives 0.82 and 0.83, so the result is not driven by outliers. The skill rule (≥ 0.5 and CI low > 0.3, both seasons) is coded as written (`tests.py:231`).
- **Q2/Q3, replicated independently.** I built my own half-season tables, including my own P3 hitter + pitcher fixed-effects solver, and reproduce the reported numbers to 4 decimals:
  - Q2 2025: 0.0094 [−0.023, 0.041]
  - Q2 2026: 0.0304 [0.006, 0.054]
  - Q3 2025: 0.0015
  - Q3 2026: 0.0183 [0.007, 0.029]
  - The refit P1 coefficients match: −0.0022 and −0.0008 for Q2.
- **Q5 (iii), replicated.** I used my own pre-game P1s, log5 and two-way-clustered OLS, without park fixed effects. Pooled β = **0.00528**, CI [0.0029, 0.0077], against the reported 0.00525 [0.0028, 0.0077]. The 2025 and 2026 estimates are 0.0058 and 0.0043, with identical n = 267,199. The result is robust to:
  - using the raw PA value instead of the residual (0.0055);
  - season-specific z-scores plus season × elite terms: 0.0039 against 0.0041 for the same minimal model without them. Ruling 12 is therefore harmless.

  Descriptively, against elite pitchers the resid is −0.0174 for the low-P1 tercile and −0.0037 for the high tercile. Against non-elite pitchers the gap is about 0.002.
- **T1, replicated.** I rebuilt the team-game table from the PA tables: 8,855 team-games against 8,852. Lineup X has SD 0.3647 against 0.3648. I reproduce:
  - primary 0.013 against 0.015;
  - PC1 −0.065 [−0.18, 0.05] against −0.064;
  - secondary outs −0.454 [−0.83, −0.08] against −0.460.
- **Protocol conformance (A).** These all match the text: the Q2 baseline and challenger (including |stakes|, PA-weighted slot, the opponent H_s* from all other hitters, and Amendment A1's outcome); the Q3 and Q4 specifications; the Q5 elite rule (prior-season mean H_s, ≥ 300 pitches, A1); T1's X, 18-BF window, opener rule, fixed effects, controls and game clustering; the A2 positive-control signs; A3 umpires; and the P2 tercile (2021–23, 0.2736). For 2026, swing models use front-plane coordinates rebuilt from the bridge. The audit shows the reconstruction to mid-plate matches published 2026 coordinates at a median of 0.004 ft, and front plane matches 2021–25 at the same 0.004. The take model is refit by month and is well calibrated (called strike − p_cs ≈ 0.000 in 2026). The in_zone flag uses mid-plate coordinates.
- **Boosting change (E), by reading the code against sklearn 1.9.1.**
  - `n_iter_` is the property `len(_predictors)` (gradient_boosting.py:1353). That makes truncation (`models.py:151-153`) and warm-start resume consistent.
  - Warm start recomputes the training raw predictions with `_raw_predict` in tree order, the same summation order as the incremental update. The bin mapper and seed are reused (lines 487-492, 739-772). With early_stopping = False and max_features = 1.0 nothing random changes.
  - Trees 1..k are therefore identical whether growth is in chunks of 25 or 500, and checks run at the same 25-round boundaries with the same patience and tolerance. The selected `best_iter` and the truncated model equal a fresh fit at `best_iter` on the 90% training games.
  - Caveat (minor m3): I cannot see the original code. If the original "refit from scratch" used **all** 2021–23 games, the final models now differ from that design: they are trained on 90% of games instead of 100%. Selection is unchanged, and the protocol allows either.
  - The swing and swing-outcome models hit the 2,000-round cap, which is allowed by the protocol (`max_iter ≤ 2000`).

## Discrepancies

| # | Severity | Issue | Evidence | Changes a verdict? |
|---|---|---|---|---|
| M1 | **major** (write-up) | Q5 β is **per SD of pre-game shrunk P1**, not "per unit P1". | `tests.py:638-639` z-scores the skill. `results.json` Q5 `skill_sd` = 0.154 runs/100 pitches. results.md line 56 gives no units. Per unit of P1 (1 run/100 pitches) the effect is 0.0053/0.154 = **0.034 runs/PA**. | No |
| M2 | **major** (interpretation) | The 2026 Q2 "signal" is partly a 2026 model-input artifact (see the diagnosis below). | Q2 2026 under stance zones: 0.024 [−0.006, 0.051], p = 0.059. | No (Q2 fails on P1 sign either way) |
| M3 | **major** (interpretation) | Failing T1 positive controls are caused by the batting-team × season FE design, not a bug. The X → outs secondary (−0.46) is fragile and should not be presented as evidence. | Diagnosis below. | No |
| m1 | minor | The frozen p_ref over-predicts swings in the test seasons. a − p_ref = −0.1 pp (2024), −1.2 pp (2025), −2.3 pp (2026). The league mean D is therefore not 0 (P1 league mean +0.079 in 2025, +0.034 in 2026 per 100 pitches), contrary to "zero in expectation for the league". | `calib_check.py` | No. Q2–Q4 centre within pair, Q1 is correlational, and Q5 is robust (above). Disclose it. |
| m2 | minor | features.py, load.py and score.py were edited Oct 24 between 08:39 and 08:41, just before the real-data audit at 08:42. DECISIONS.md has no entry for this. | file mtimes; audit.log | No (no scores existed). Log what changed and why. |
| m3 | minor | The fit change's equivalence holds against a fresh fit on the 90% training games. I cannot confirm what the original refit target was. | `test_fit_resume.py` FitExactness compares with `fit(X[~val])` | No |
| m4 | minor | Q1 parity is assigned separately in the pitch table and the PA table (`tests.py:148-151`, `score.py:474-483`). Games with PAs but no scored pitches can flip later parity in one table only. | P1 rel300 is 0.8417 as coded against 0.8408 with a common game list | No |
| m5 | minor | results.md lists T1 in the Holm table and also says "in primary family False". | results.md lines 14 and 61 | No. State plainly that T1 is outside the family. |

## T1 positive-control diagnosis

This is **not a bug.** I checked the sign, units, merges, outcome, lineup aggregation and opener exclusion.

- **The outcome is wired correctly.** Within the full spec, starter outs on the realised P/BF of the first 18 BF gives −2.26 [−2.46, −2.07]. Starter outs average 15.9 (SD 3.8) at 22.4 BF.
- **The FE absorb the signal.** The control uses the batting-team × season FE. Season-to-date lineup P/PA (pooled SD 0.054 pitches/PA) keeps only **40% of its variance** after the full FE and controls, and 50% after the team-season FE alone. The table below gives the coefficient per pooled SD:

| specification | outs | P/BF (first 18) |
|---|---|---|
| no FE, no controls | **−0.185 [−0.27, −0.11]** | 0.047 [0.037, 0.057] |
| starter FE only | **−0.161 [−0.24, −0.08]** | 0.047 |
| full spec without team-season FE | **−0.180 [−0.26, −0.09]** | 0.040 [0.029, 0.050] |
| team-season FE only | −0.082 [−0.19, 0.03] | 0.009 [−0.006, 0.023] |
| full pipeline spec | −0.065 [−0.18, 0.05] | 0.013 [−0.002, 0.028] |

- **The within-team-season variation is mostly noise.** Within the full spec, the ex-ante lineup P/PA predicts the lineup's *realised* P/PA against that starter with slope 0.25 [−0.01, 0.51] instead of about 1. That variation is mostly early-season shrinkage drift: hitters average 6 prior PA in March and 54 in April. The rest is lineup reshuffles.
- **The expected effect is far below the SE.** Expected PC1 effect ≈ −2.64 outs per pitch/PA × 0.25 × 0.054 ≈ −0.035 outs per SD, against an SE of 0.06. The control could not pass under this design.
- **The same weakness defeats T1 itself.** 58% of the remaining within-team-season variance of X is explained by team-season × month. This is the design weakness the power rule flagged.
- **The secondary X → outs result is fragile.** The −0.46 per unit X (≈ −0.09 outs per within-team-season SD) reproduces and survives month FE (−0.54). It disappears without the team-season FE (−0.20 [−0.45, 0.05]) and comes with no P/BF effect (0.013), so it is not the hypothesised pitch-count mechanism. It is one of two unadjusted secondary outcomes (team runs +0.30, p_two-sided ≈ 0.07) and should be labelled exploratory.

## 2026-only signal diagnosis

The frozen 2021–23 models take the batter's median `sz_top`/`sz_bot` as **raw features** (`features.py:23`, `111-120`). This is protocol-mandated: "the ABS zone for 2026." In 2026 these become ABS height zones:

| zone feature | 2025 | 2026 |
|---|---|---|
| mean zone_top | 3.44 ft | 3.22 ft |
| zone height | 1.83 ft (SD 0.10) | 1.59 ft (SD 0.05), about 2 SD below the training mean |
| batter year-over-year correlation | 0.91 (2024→25) | 0.64 (2025→26) |

The zone shift shows up in the scores:
- Whiff calibration (actual − p_whiff on swings) flips from −1.8 pp in 2025 to +0.8 pp in 2026.
- The share of "difficult" two-strike swings falls from 34% to 29%.
- Hitter-level SD of E rises from 0.46 to 0.55, and of H_s from 0.0067 to 0.0081. P1's SD is unchanged.

**Counterfactual test** (`rescore2026.py`): I re-predicted 2026 with the same frozen models. First I reproduced S_2026 to within 3e-8. Then I substituted each hitter's 2025 stance zone. Under stance zones:
- whiff calibration returns to −1.2 pp, the difficult share to 33%, and the SD of H_s* to 0.0068;
- **Q2 2026 falls to 0.024 [−0.006, 0.051] (p = 0.059)** and the refit P1 coefficient turns positive;
- **Q3 2026 survives** at 0.015 [0.004, 0.026]. Its outcome (xwOBAcon) is not model-based, and the gain comes from P3 (pitches per PA, which uses no model) and P2. Adding zone_top/zone_bot as covariates also leaves Q3 2026 unchanged at 0.027.
- 2026 Q1 reliabilities barely move: P1 0.835 vs 0.847 and P2 0.814 vs 0.827 under stance zones.

The take-model refit by month is not the source: 2026 called-strike calibration is about 0 in every month.

**Conclusion.** Q2's 2026 significance depends on a 2026-specific shift in model inputs. Q3's 2026 gain is not an artifact I can identify. It is still a single-season result that fails the both-seasons rule, and with one of six season × test cells significant it is consistent with chance. Neither result should be described as a 2026 replication.

## Effect sizes in interpretable units

- **P1** is in runs per 100 pitches relative to the league swing decision. The hitter-season SD (≥ 1,000 pitches) is about 0.32. For a regular at about 2,350 pitches (600 PA × 3.9), 1 SD ≈ **7.5 runs/season** of decision value.
- **Q5:**
  - +0.0053 runs/PA per SD of pre-game shrunk P1 (SD 0.154), about 6.6 wOBA points (× 1.25) against elite pitchers.
  - Per unit of P1: 0.034 runs/PA. With a full-season SD of P1 (0.32): about 0.011 runs/PA.
  - Elite PAs are 17.5% of the Q5 sample, about 95 PA for a regular. That works out to roughly **0.5–1 run per season** per SD of P1.
  - The elite penalty at mean P1 is −0.0064 runs/PA.
  - Development MDE is 0.0048, so the estimate is just above it.
- **Q2–Q4:**
  - Q2 lowers the RMSE of hitter mean H_s* (about 0.006–0.0075 runs/pitch) by 0.9% and 3.0%.
  - Q3 lowers the BIP-weighted RMSE of later xwOBAcon (about 0.040) by 0.15% and 1.8%.
  - Q4's change in wOBA RMSE is −0.17% and +0.07%.
  - Sample sizes are n = 221 and 213 hitters (≥ 150 PA in each half).
- **T1:**
  - X SD is 0.365 across team-games and about 0.20 within team-season.
  - Primary: 0.015 pitches/BF per unit X, about 0.003 per within-SD, or 0.05 pitches over 18 BF.
  - MDE is 0.065 per unit X. PC1 is −0.064 outs per SD of lineup P/PA (0.054 pitches/PA).
- **Q1:** n = 277 hitters (2025) and 266 (2026) at ≥ 300 PA. Mean half-season PA is 253 to 256.

## What I could not check

- The perceivability sensitivity (Spearman 0.98–0.99), which needs the tunnel-point models refit.
- The S3 and S5 numbers beyond reading the code. They share Q1/Q4 machinery, and P1 itself was verified.
- Q1 for P2, P3, PAQ and the benchmarks, apart from approximate P2/E reliability in 2026. The year-to-year correlations.
- The development MDEs.
- The calibration table by count × region in detail (I checked the summary only).
- The original pre-change `fit_hgb` source (it is not preserved).
- The fetch of umpires and Savant data.
- The external ShapeCast bridge validation, beyond the audit's internal consistency check.
- I did not refit any boosted model.
