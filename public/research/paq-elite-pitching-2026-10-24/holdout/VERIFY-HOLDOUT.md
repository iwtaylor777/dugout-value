# Independent verification of the PAQ holdout test (PROTOCOL-HOLDOUT.md)

Verifier: independent agent, 2026-10-24. Scope: `/home/claude/paq/holdout/` (protocol, decisions, code, outputs), the raw files in `/home/claude/paq-data/raw-holdout/`, and the PAQ inputs in `/home/claude/paq/output/`. Nothing under `/home/claude/paq/` or `/home/claude/paq-explore/` was modified. All verifier code and outputs are in `/home/claude/paq-verify-holdout/`.

## Verdict

**The result stands.** The FAIL verdict, its pooled estimate, both block estimates, the secondaries and the power figures all reproduce exactly from independently written code. I found no error that could change the verdict, let alone flip the sign. The protocol's interpretation rule ("pooled estimate ≤ 0 → evidence against the finding at the planned size") was applied correctly.

I have one low-severity wording correction and three informational notes (below). None changes any number.

## Confirmed

**Protocol lock and provenance**
- SHA-256 of `PROTOCOL-HOLDOUT.md` = `80756e35…5b57`, matching `LOCK-HOLDOUT.json`.
- All 123 raw chunks re-hashed against their fetch manifests: 0 mismatches.
  - rs2020: 23 chunks, 264,262 rows, `hfGT=R|`.
  - Postseasons: `hfGT=F|D|L|W|`, windows Sep 25 to Nov 15 (2026: to Oct 23).
- `hload.load_season_gt` differs from PAQ's `load.load_season` only in the function name, the `game_types` argument and the filter line, which also records game-type counts. I checked this by diff.

**1. Protocol conformance of the implementation**

| Protocol element | Implementation | Status |
|---|---|---|
| Sample: wOBA-denominator, in-denominator, non-pinch-hit PAs vs pitchers on the block's list (≥ 300 scored prior pitches) | Same filters (`q5_table` for 2021; a mirror for the postseason) | ✔ My own filters give the same PA sets: 106,559 and 16,900 PAs, outer merge on `pa_id` 100% "both" |
| z(P1) = (P1 − block-season mean) / 0.154 | Mean is the analysis-sample (PA-weighted) mean per block-season cell | ✔ This is a reasonable reading of "block-season mean" and was dated in DECISIONS before the fit |
| z(xwOBA) within block-season | Same cells, sample SD | ✔ |
| Covariates: same_hand, tto2, tto3, starter, park (home team), season dummies, postseason, postseason × elite, z(xwOBA) × elite | All present; base season 2021; 2022–26 dummies identify the postseason cells | ✔ |
| Two-way clustering by hitter and pitcher | `tests.ols_cluster` (CGM with small-sample factor) | ✔ My own CGM code gives identical SEs |
| Pass rule: one-sided p < 0.025 and both block signs positive | Coded exactly | ✔ |
| Holm m = 2 at one-sided 0.025 for {H1, S1} | `TS.holm`, `HOLM_ALPHA = 0.025` | ✔ H1 p = 0.68 vs 0.0125; S1 p = 0.75 vs 0.025 |
| Interpretation rule | Pooled β ≤ 0 → "evidence against at the planned size" | ✔ The upper CI limit (+0.0037) is below 0.004 and 0.0053 but above +0.002, as stated |

Dropping constant or duplicate columns in sub-sample fits is harmless. It only removes columns that are collinear in that sample.

**2. 2020 scoring and the 2021 elite list**
- Scoring path: `stage_elite` calls PAQ's `score_pitches` with the frozen folds. `fold_for_season(2020) = "full"`, and `vb_assign` puts every 2020 pitch on `vb_full` (the 2023 V/B), which is how the pipeline scores any non-2023 season. The only pipeline steps skipped are the 2026 take refit, the difficulty flag and the hitter reference. None of them enters H_s = EV_swing − V(c).
- Re-scoring check: I re-scored a random 60,000-pitch subset of P_2020 with the frozen models. H_s matched `S_2020_Hs.pkl` to 1.5e-8.
- Feature missingness is 0.20% in 2020 vs 0.26% in 2021, and no feature column is more often missing in 2020.
- Distribution: the 2020 H_s distribution is normal for these seasons.

| season | pitch mean H_s | pitch SD | pitcher-mean SD (≥ 300) | pitchers ≥ 300 | elite | split-half reliability (SB) | swing calib a − p_ref |
|---|---|---|---|---|---|---|---|
| 2020 | −0.0375 | 0.0516 | 0.0070 | **366** | 74 | 0.91 | −0.1 pp |
| 2021 | −0.0382 | 0.0518 | 0.0067 | 587 | 118 | 0.94 | −0.7 pp |
| 2022 | −0.0369 | 0.0510 | 0.0067 | 569 | 114 | 0.94 | +1.0 pp |
| 2023 | −0.0370 | 0.0510 | 0.0065 | 581 | 117 | 0.94 | −0.2 pp |
| 2024 | −0.0377 | 0.0518 | 0.0068 | 567 | 114 | 0.94 | −0.1 pp |
| 2025 | −0.0375 | 0.0518 | 0.0064 | 571 | 115 | 0.94 | −1.2 pp |
| 2026 | −0.0330 | 0.0517 | 0.0064 | 560 | 112 | 0.93 | −2.3 pp |

- Year to year, pitcher mean H_s correlates r = 0.74 from 2020 to 2021, against 0.75–0.78 for the 2021→22 … 2025→26 pairs.
- Of 2020's elite pitchers who also qualify in 2021, 68% are elite again in 2021. For the other year pairs the figure is 57–69%.
- So the 60-game list is smaller, but its ranking is not noisier.
- Direction: elite means bottom 20% (most negative mean H_s, hardest to hit). For 2020, max(elite mean) = −0.04349 = the cut, and min(non-elite mean) = −0.04333.
- Rule identity: all seven stored lists (`elite_lists.pkl`) equal my own recomputation.
- Sanity check: the elite main effect on the residual is negative, −0.0088 in the 2021 block, against −0.004 to −0.009 in 2022–26.

**3. 2021 regular-season block (independent recomputation)**
- My own as-of sums give exactly the same pre-game P1s and xwOBA_s as `SC.pregame_hitter_table` (max abs diff 0). They also match the holdout table on P1s, xwOBA_s, expectation, residual and elite flag (max abs diff 0).
- β = **−0.00251, SE 0.00300, 95% CI [−0.00839, +0.00337]**, n = 106,559, 17,800 elite PAs, 71 elite pitchers. One-sided p = 0.80. Elite main −0.0088; P1 main +0.0023.
- Without park dummies: −0.00254.
- Scaled by the sample SD instead of 0.154: −0.00236.
- Properties of 2021 pre-game P1:
  - SD in the analysis sample is 0.145, the same as 2022 (0.145), 2023 (0.148) and 2024 (0.147), and a little below 2025–26 (0.155 and 0.152). The registered 0.154 comes from 2025–26.
  - Mean 0.0006.
  - PA-weighted correlation with the hitter's end-of-2021 shrunk P1: 0.86.
  - Median prior scored pitches at PA time: 641.

**4. Postseason block**
- Game counts: 37 / 40 / 41 / 43 / 47 for 2021–25. Each season's breakdown by round (W/D/L/F) matches the public series results I know of. For example, 2025 has a 7-game World Series, two 5-game Division Series and a 7-game ALCS.
- 2026 (36 games through 10-23) matches MLB.com's 2026 postseason page:
  - Wild Card: 3 + 2 + 2 + 2 = 9.
  - Division Series: 5 + 3 + 4 + 4 = 16.
  - LCS: 4 + 6 = 10.
  - World Series Game 1, Oct 23, MIL–TB.
  - The data's team pairs and dates agree. No row is after 2026-10-23.
- `pa_x` construction (every season, wOBA-denominator PAs):
  - `pa_x` = `xwoba` on 100% of balls in play, and `woba_value` on 100% of non-BIP PAs.
  - No ball in play is missing xwOBA.
- Flags:
  - Exactly one `starter_id` per game × fielding team, and the first pitcher is the starter in 100% of games.
  - `by_starter` agrees with `pitcher == starter_id` on ≥ 99.9% of PAs. The handful of exceptions are starters re-entering, as in PAQ's RS logic.
  - Times-through-order distributions are sensible: relievers are almost all on TTO 1.
  - Pinch-hit share is 2–5%, highest in 2021, when the NL had no DH.
- Freeze (no leakage):
  - Postseason game_pks never appear in the RS `pa_s.pkl` (0 overlap in every season).
  - The last date in `S_s`/`pa_s` equals the regular-season end.
  - Postseason `pa_id`s (base + 500,000) never collide with RS ids.
  - My own end-of-RS full-season inputs (P1 from all RS scored pitches with ballast 1,000; xwOBA_s and xwOBA_allowed with ballast 200 toward the full-RS league mean) match the holdout's dummy-row query to ≤ 7e-8.
  - The 2024 case (freeze date = first postseason date) is handled correctly because only RS rows enter.
- Recomputed postseason block: β = **+0.00116, SE 0.00448, [−0.0076, +0.0099]**, n = 16,900, 4,520 elite PAs (+0.00117 without park dummies).
- The per-postseason-season estimates reproduce the RESULTS table.

**Pooled and secondary fits (own code, own tables)**

| fit | verifier β | SE | 95% CI | implementer β |
|---|---|---|---|---|
| H1 pooled | −0.00114 | 0.00247 | [−0.0060, +0.0037] | −0.00114 |
| H1 pooled, no park | −0.00123 | 0.00246 | | |
| S1 relievers | −0.00223 | 0.00329 | [−0.0087, +0.0042] | −0.00223 |
| S3 excl. 2026 post | −0.00068 | 0.00259 | [−0.0058, +0.0044] | −0.00068 |
| inverse-variance combination of the two blocks | −0.00138 | 0.00249 | | |

**6. Power claim**
- Realised pooled SE 0.00247 gives power 0.367 at 0.004 and 0.574 at 0.0053 (one-sided 0.025). The 2021 block alone has 0.27 at 0.004.
- The planned SE of 0.0020 would have given 0.52.
- If the 2021 SE had been the planned 0.0022, the pooled SE would have been 0.00197, with power 0.53. So the shortfall is due to the 2021 SE.
- The postseason SE (0.0045) actually came in better than planned (0.0053).
- The claim "37%, not 52%" is **confirmed**.

## Discrepancies

| # | Severity | Item | Evidence |
|---|---|---|---|
| D1 | Low (wording) | RESULTS says the 2021 SE came out at 0.0030 "mainly because the 60-game 2020 season puts only 341 pitchers into the 2021 sample." That is only partly true. | Post hoc, 2021 is noisier than other seasons even with a full list. With a same-season 2021 list (163,614 PA, 118 elite pitchers) the SE is 0.0026. In 2022–26 the SE is 0.0018–0.0026 with about 132k PA and about 100 elite pitchers each. Suggested wording: "partly because…". |
| N1 | Informational | Pitchers batting. 2021 had no universal DH, so about 2,789 PAs (2.6% of the 2021 block) are pitchers hitting. 2022 has 130 such PAs. The protocol does not exclude them, so including them is conformant. | Their mean residual is −0.133 runs/PA, because the log5 expectation is shrunk toward league. Their P1 is near the centre (mean −0.055, SD 0.067), so they carry little interaction leverage. Excluding them gives β = −0.0023 [−0.0083, +0.0036]. |
| N2 | Informational | Park = home_team conflates Toronto's three 2021 home venues (Dunedin, Buffalo, Toronto). This follows the protocol. | The fit without park dummies is essentially identical (−0.0025). |
| N3 | Informational | The protocol scales postseason P1 by the same 0.154 unit. Postseason P1 is end-of-season and less shrunk, with SD about 0.21 against about 0.145 for 2021 pre-game P1. So the postseason β is per the same raw P1 unit, not per postseason SD. | This is as registered. Per-SD it would be about 1.4× larger in magnitude, still small and imprecise. |

`elite_info.json`'s always-null `*_cut_Hs` field is cosmetic, as the implementer says.

## Post hoc diagnostics (EXPLORATORY: these do not change the verdict)

**Per-season estimates under the exact holdout specification** (own code; park, z by 0.154; prior-season list):

| season | β | SE | elite pitchers |
|---|---|---|---|
| 2021 (holdout) | −0.0025 | 0.0030 | 71 |
| 2022 | +0.0039 | 0.0020 | 98 |
| 2023 | +0.0039 | 0.0026 | 103 |
| 2024 | +0.0018 | 0.0024 | 102 |
| 2025 | +0.0057 | 0.0018 | 94 |
| 2026 | +0.0043 | 0.0021 | 99 |
| 2022–26 pooled | **+0.0040** | 0.00098 | [0.0021, 0.0059] |

These reproduce the exploratory numbers.

**Is 2021 noise?**
- The difference between 2021 and the 2022–26 pool is −0.0065, SE 0.0032, z = −2.06, **two-sided p = 0.040** (one-sided 0.020).
- P(β̂ ≤ −0.0025 | true 0.004, SE 0.0030) = 0.015.
- Cochran's Q across the six seasons 2021–26 is 6.17 on 5 df, **p = 0.29**. The inverse-variance mean is +0.0035 (SE 0.0009).
- Reading: 2021 is about a 2-SE outlier from the 2022–26 mean, which is uncommon but not extreme. Formal heterogeneity across seasons is not significant.
- The 2022–26 pool is the product of about 80 exploratory specifications and so is likely biased upward (winner's curse). That makes the gap somewhat less surprising.

**Is the 60-game 2020 list the cause?** No.

| 2021 variant | β | SE | n PA | elite pitchers |
|---|---|---|---|---|
| registered (2020 list, ≥ 300) | −0.0025 | 0.0030 | 106,559 | 71 |
| 2020 list, ≥ 200 pitches | −0.0033 | 0.0028 | 119,925 | 88 |
| 2020 list, ≥ 150 pitches | −0.0054 | 0.0029 | 125,987 | 96 |
| 2020 list, sample = pitchers also qualifying in 2021 | −0.0025 | 0.0030 | 105,284 | 65 |
| 2020 list re-cut within 2021 qualifiers | −0.0027 | 0.0034 | 105,284 | 61 |
| elite in both 2020 and 2021 | −0.0049 | 0.0035 | 105,284 | 44 |
| **2020-free: same-season 2021 list** (in-season information, descriptive) | +0.0006 | 0.0026 | 163,614 | 118 |
| **2020-free: next-season 2022 list** | −0.0037 | 0.0034 | 130,313 | 92 |
| relievers only / starters only | −0.0041 / −0.0023 | 0.0042 / 0.0037 | | |
| from May 1 / prior P1 on ≥ 500 pitches | −0.0026 / −0.0026 | 0.0030 / 0.0033 | | |
| excluding pitchers batting | −0.0023 | 0.0030 | 103,770 | 71 |

- Every 2020-based variant is negative, and so is the 2022-list version.
- Only the same-season list is slightly positive, and it is far below +0.004.
- The 2021 shortfall is not an artefact of the short 2020 list, the 300-pitch threshold, pitchers batting, early-season P1 noise or the park dummies.

**Within-2021 timing (descriptive, forking-paths caveat)**
- Before June 21, 2021: +0.0038 (SE 0.0052). After June 21: −0.0044 (SE 0.0032). June 21 is the start of foreign-substance enforcement. The difference has z ≈ 1.35, which is not significant.
- By calendar month: +0.010, −0.009, +0.014, −0.011, −0.012, +0.003 (April–September).
- This hints at, but does not establish, a 2021-specific change. I would not build a story on it.

## What I could not check

- I did not re-download from Baseball Savant. I verified the raw files only against their own SHA-256 receipts and against public game counts.
- 2020 was re-scored on a 60,000-pitch random subset, not all 264,262 pitches. The match was exact to 1.5e-8.
- I did not check the frozen models themselves (their fit or calibration); that belongs to the original study's verification. I also did not re-audit PAQ's PA builder (`score.build`) line by line. I checked its postseason outputs for internal consistency (pa_x, starters, TTO, pinch-hit, duplicates via the audit).
- The 2026 postseason count was verified against one MLB.com schedule page (fetched 2026-10-24), not game by game.

Sources: [MLB.com 2026 postseason schedule and results](https://www.mlb.com/news/2026-mlb-playoff-and-world-series-schedule?lctg=5526748), [MLB.com 2026 World Series FAQ](https://www.mlb.com/rays/news/2026-mlb-world-series-faq-schedule-times-teams-and-more).

## Verifier files

All in `/home/claude/paq-verify-holdout/`:
- `vlib.py`: own as-of inputs, log5, design and two-way CGM.
- `hs_check.py` → `hs_check.json`: H_s distributions, lists, reliability.
- `rescore2020.py` → `rescore2020.json`.
- `rs2021.py` → `rs2021.json`.
- `post.py` → `post.json`.
- `pooled.py` → `pooled.json`.
- `seasons.py` → `seasons.json`: 2022–26 under the holdout spec.
- `diag2021.py` → `diag2021.json`.
- `pbat.py` → `pbat.json`.
- `leak_sticky.py` → `leak_sticky.json`.
