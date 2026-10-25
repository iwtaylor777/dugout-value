# PAQ holdout test: results

The locked holdout test failed, and the result counts as evidence against the Q5 finding at its planned size. The test ran on October 24, 2026, under PROTOCOL-HOLDOUT.md (SHA-256 `80756e35…5b57`, matching LOCK-HOLDOUT.json) and the implementation decisions dated 2026-10-24 in DECISIONS-HOLDOUT.md, which were written before the fit. H1 and the secondaries were fit once. An independent verification (protocol step 6) is still pending.

## Verdict

**FAIL: evidence against the finding at the planned size.**

The pooled P1 × elite interaction is **−0.0011 runs/PA per SD of P1, 95% CI [−0.0060, +0.0037], one-sided p = 0.68**.

| pass condition | result |
|---|---|
| pooled one-sided p < 0.025 | **no** (p = 0.68) |
| 2021 regular-season block estimate > 0 | **no** (−0.0025) |
| postseason block estimate > 0 | yes (+0.0012) |

Which interpretation rule applies: the protocol reads a pooled estimate ≤ 0 as "evidence against the finding at the planned size," and that is the rule triggered here. The CI also excludes both planning sizes, +0.004 and +0.0053. It does not exclude the protocol's +0.002 line, so a small positive effect, about half the planned size or less, remains possible.

The test also had less power than planned (37% at 0.004 instead of 52%). The 2021 block's SE came out at 0.0030 rather than 0.0022, partly because the 60-game 2020 season puts only 341 pitchers into the 2021 sample. (Corrected October 24 after independent verification, which had read "mainly": with a full same-season elite list the 2021 SE is still 0.0026.)

## Estimates

Model: the Q5 model + park + season dummies + postseason + postseason × elite. Two-way clustered SEs (`tests.ols_cluster`). β is the coefficient on z(P1) × elite, in runs/PA per 0.154 SD of P1.

| fit | β | 95% CI | one-sided p | n PA | elite PA | hitters | pitchers (elite) | power at 0.004 / 0.0053 |
|---|---|---|---|---|---|---|---|---|
| **H1: pooled holdout** | **−0.0011** | **[−0.0060, +0.0037]** | 0.68 | 123,459 | 22,320 | 1,056 | 619 (172) | 0.37 / 0.57 |
| 2021 regular-season block | −0.0025 | [−0.0084, +0.0034] | 0.80 | 106,559 | 17,800 | 914 | 341 (71) | 0.27 / 0.42 |
| postseason block (S2, descriptive) | +0.0012 | [−0.0076, +0.0100] | 0.40 | 16,900 | 4,520 | 435 | 436 (129) | 0.14 / 0.22 |
| S1: relievers only (pooled) | −0.0022 | [−0.0087, +0.0042] | 0.75 | 41,214 | 12,677 | 868 | 531 (156) | 0.23 / 0.36 |
| S3: pooled without 2026 postseason | −0.0007 | [−0.0058, +0.0044] | 0.60 | 121,050 | 21,696 | 1,018 | 582 (161) | 0.34 / 0.53 |

**Holm across {H1, S1}** (m = 2, one-sided 0.025):
- H1: p = 0.68 against a threshold of 0.0125, not cleared.
- S1: p = 0.75 against 0.025, not cleared.
- S1 gives no support.

**Other coefficients, pooled fit:**
- P1 main effect: +0.0021 runs/PA per SD.
- Elite main effect: −0.0089.

**Postseason seasons, each alone.** These are descriptive only, with very wide CIs:

| postseason | β | 95% CI | n PA |
|---|---|---|---|
| 2021 | +0.0041 | [−0.026, +0.034] | 2,476 |
| 2022 | +0.0050 | [−0.019, +0.029] | 2,854 |
| 2023 | +0.0214 | [+0.001, +0.042] | 2,902 |
| 2024 | −0.0088 | [−0.029, +0.011] | 2,943 |
| 2025 | −0.0048 | [−0.024, +0.015] | 3,316 |
| 2026 (through 10-23) | −0.0148 | [−0.035, +0.006] | 2,409 |

## S4: size in plain units

The pooled β of −0.0011 runs/PA per SD equals **−1.4 wOBA points per SD** against elite pitching. For a regular with about 88 elite PAs that is about **−0.10 runs per season per SD**.

For comparison:
- the registered Q5 estimate was +0.0053 (+6.6 wOBA points);
- the exploratory 2022–26 estimate was +0.0040 (+5.0 wOBA points).

The upper confidence limit of the holdout, +0.0037 (+4.6 wOBA points, about +0.33 runs per season), lies below both.

## Context (no extra claims)

- Taken at face value, the 2025–26 test estimate (+0.0053) and this holdout disagree. The difference is 0.0064, with an SE of about 0.0028.
- The exploratory finding came from 2022–26 regular seasons under about 80 specifications. The holdout favours a smaller true effect than those seasons suggested, possibly near zero.
- Individual-hitter splits were not tested or named, as the protocol requires.

## Audit summary

Full report: `out/audit_holdout.json`. The audit read no outcome-by-elite or outcome-by-P1 quantity.

**Raw files.**
- Every chunk matches its fetch-manifest SHA-256.
- There are no unlisted files, no duplicate pitch rows and no duplicate PA keys.
- No unknown descriptions or events appear.
- PAQ's ordering and count-continuity checks pass in every block; the largest break share is 0.00019.

**2020 regular season.**
- 898 games, 264,262 pitches.
- 99.99% of decision pitches scored, with the frozen `full` fold and 2023 V/B.
- Swing-model calibration (a − p_ref): −0.1 pp.
- Mean H_s is −0.0375, close to the 2021–25 range of −0.037 to −0.038.
- Elite list: 74 of 366 pitchers with ≥ 300 pitches.

**Postseasons.**

| season | games (public record) | rounds W/D/L/F | regular season ends | first postseason game | eligible PAs |
|---|---|---|---|---|---|
| 2021 | 37 (37) | 6 / 17 / 12 / 2 | 10-03 | 10-05 | 2,476 |
| 2022 | 40 (40) | 6 / 16 / 9 / 9 | 10-05 | 10-07 | 2,854 |
| 2023 | 41 (41) | 5 / 14 / 14 / 8 | 10-01 | 10-03 | 2,902 |
| 2024 | 43 (43) | 5 / 18 / 11 / 9 | 09-30 | 10-01 | 2,943 |
| 2025 | 47 (47) | 7 / 18 / 11 / 11 | 09-28 | 09-30 | 3,316 |
| 2026 | 36, through 10-23 (World Series game 1 included) | — | 09-27 | 09-29 | 2,409 |

- Rounds are World Series / Division Series / LCS / Wild Card.
- 2024: the regular season ended with the Sep 30 NYM–ATL makeup doubleheader, so the freeze date equals the first postseason date. The frozen inputs still use regular-season games only.
- 2026 cutoff: 0 rows after 2026-10-23 (the fetch window ended on 10-23).
- 1 postseason hitter (2025) had no regular-season history. He was kept at PAQ's n = 0 shrinkage values (DECISIONS item 4).

**Sample.**
- 2021 regular season: 106,559 of 172,281 non-pinch-hit wOBA-denominator PAs (62%) are against the 366 pitchers on the 2020 list. That is per protocol; the 2020 season was short.
- Postseasons: 16,900 of 17,546 PAs (96%).
- No PA was dropped for a missing input.
- Elite share is 16.7% in 2021 regular season and 22–31% by postseason.

## Deviations

None from PROTOCOL-HOLDOUT.md. Implementation choices the protocol did not fix are dated in DECISIONS-HOLDOUT.md, all written before the fit:
- the loader copied with only the game-type filter changed;
- the postseason pa_id offset;
- frozen inputs via dummy query rows in PAQ's pre-game tables, unit-tested;
- the n = 0 hitter;
- centring cells;
- dropping constant columns in sub-sample fits;
- the Holm handling for S1.

One stray field, `*_cut_Hs`, in `elite_info.json` is always null. It is cosmetic.

## Provenance

`out/run_info.json` records:
- protocol, lock and decisions hashes;
- holdout code hashes;
- the PAQ code hash `06de9b1c…c515`, equal to the original run's, so PAQ's code was unmodified;
- the models manifest, verified;
- the raw fetch manifests;
- the PAQ input S/pa hashes and the holdout data hashes.

No step is stochastic (seed 20261024 recorded). Code is in `/home/claude/paq/holdout/code/`: `holdout.py`, `hload.py` and `test_holdout.py`; the unit tests ran on already-examined 2022 data and synthetic data. Nothing under `/home/claude/paq/output/` or `/home/claude/paq/code/` was written.
