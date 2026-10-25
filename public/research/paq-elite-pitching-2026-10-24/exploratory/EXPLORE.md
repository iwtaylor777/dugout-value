# PAQ Q5 deep dive: exploratory (post hoc) analysis

> **Public copy, October 24, 2026.** Exploratory analysis written before the pre-registered holdout test, which failed (see `../holdout/RESULTS.md`). Individual player names are redacted. File paths refer to the research workspace.


October 24, 2026. **Everything in this document is exploratory.** It was not pre-registered, many specifications were tried, and none of it should be presented as confirmatory. Only regular-season data were used (2021–2026 `S_`, `P_`, `pa_` files under `/home/claude/paq/output/`). No postseason data were downloaded, read or looked at, and nothing was fetched from Baseball Savant. Nothing under `/home/claude/paq/` or `/home/claude/paq-verify/` was modified. The only network call was to the MLB Stats API `people` endpoint, for player names.

## Units used throughout

- β is the **P1 × elite interaction**, in runs per PA, per SD of pre-game shrunk P1. The SD is fixed at the registered **0.154 runs/100 pitches**, P1 is centred within season, and the outcome is (xwOBA − log5 expectation) / 1.25.
- wOBA points ≈ runs/PA × 1250.
- A regular (≥ 450 Q5-sample PA) sees about **88 elite PAs per season**, 17.8% of 497.
- "Elite" means the registered rule unless stated: bottom 20% of prior-season mean swing hittability H_s, among pitchers with ≥ 300 prior-season pitches.
- CIs are 95% and two-way clustered by hitter and pitcher (CGM) unless stated.

## Summary

1. **The finding replicates in every season.** The Q5 base estimate reproduces at +0.0053 [0.0029, 0.0077] on 2025–26. Using the same model with prior-season elite definitions, the interaction is positive in all five seasons: 2022 +0.0041, 2023 +0.0037, 2024 +0.0018, 2025 +0.0057, 2026 +0.0043. **Pooled 2022–26 it is +0.0040 [0.0021, 0.0059]**, about 5 wOBA points per SD, p ≈ 2e-5. On the development seasons alone (2022–24) it is +0.0032 [0.0003, 0.0060]. The registered 2025–26 number is at the high end, so plan with about 0.004.
2. **It is a threshold, not a gradient.** The P1 slope is +0.0049 in pitcher-quality decile 1 and +0.0045 in decile 2. It is about 0 in decile 3 (−0.0002), and from deciles 3 to 10 it scatters between −0.0012 and +0.0023 with no trend. With both a linear pitcher-quality term and the top-20% dummy in the model, the dummy carries it: +0.0035 [0.0010, 0.0061] against a linear term of 0.0003 [−0.0008, 0.0014]. (Caveat: the 20% cut was registered in advance, but the sharpness of the step could be partly noise.)
3. **It is not "just O-Swing%".** On its own, −O-Swing% shows a weaker interaction, +0.0028 [0.0007, 0.0049]. Z-Swing% shows none (+0.0001). When P1 and O-Swing% are fit jointly, P1 keeps +0.0038 [0.0012, 0.0064] and O-Swing% falls to +0.0002. Adding both rates to P1 leaves P1 at +0.0033 [0.0002, 0.0064], p = 0.035; the two rates add nothing beyond P1 (joint p = 0.85). Within P1, the chase part and the zone part both matter when fit jointly: chase +0.0043, zone +0.0032. So the skill is "selective aggression" (don't chase, but don't go passive in the zone), which P1 prices better than either raw rate.
4. **Most of the run gap is contact quality, then walks.** Mechanism by P1 tercile, each hitter measured against his own non-elite baseline:
   - Against elite pitchers, low-P1 hitters lose 0.0170 runs/PA and high-P1 hitters 0.0082, a gap of **+0.0088 [0.0038, 0.0137]**.
   - Of that gap, about 59% is better xwOBA on balls in play, 21% walks/HBP, 13% fewer strikeouts (more balls in play), and the rest is other.
   - K%: high-P1 hitters' strikeout rate rises 0.8 pp less [0.0, 1.5].
   - Walks: their walk rate rises 0.3 pp more, which is not significant.
   - xwOBAcon: low-P1 hitters drop 13.6 points against elite pitchers and high-P1 hitters 4.5, a gap of +9.1 [1.7, 16.4].
5. **The contact edge is execution, not getting better pitches.** Judged by the pitch-based expected value of the pitch put in play, high-P1 hitters put slightly *worse* pitches in play against elite arms (−1.4 points [−2.7, −0.0]). Their contact beats that pitch-based expectation by +10.5 points [3.0, 17.9] more than low-P1 hitters. Chase-rate changes against elite pitchers do *not* explain it: everyone chases slightly more, and high-P1 hitters chase 0.4 pp more (not significant). High-P1 hitters do get pickier in the zone (Z-Swing −0.6 pp relative to low-P1).
6. **It depends on what "elite" means.** The interaction holds for the registered H_s rule. It is weaker for top-20% whiff rate, +0.0028 [0.0009, 0.0046]. It is borderline for xwOBA allowed (+0.0017 [−0.0000, 0.0034]), and about null for K% (+0.0012), FB velocity (+0.0012) and chase induced (+0.0010). H_s-elite pitchers are 81% relievers: hard throwers (95.4 vs 93.5 mph) with high whiff rates (30% vs 25%), more walks (10.3% vs 8.2%) and a lower zone rate.
7. **It is a bullpen phenomenon.**
   - Against relievers: +0.0053 [0.0025, 0.0081].
   - Against starters: +0.0026 [−0.0002, 0.0054].
   - Defining elite within role: relievers +0.0053 [0.0022, 0.0084], starters +0.0008 [−0.0015, 0.0032].
   - Times through the order makes no difference.
8. **It survives the robustness checks.** None of the following moves it much:
   - excluding the 2026 ABS season (+0.0038);
   - leaving out each season in turn (range 0.0036–0.0045);
   - deciles of hitter xwOBA × elite (+0.0039);
   - park × season fixed effects (+0.0040);
   - hitter-season plus pitcher-season fixed effects (+0.0059);
   - raw xwOBA with no log5 expectation (+0.0040);
   - actual wOBA (+0.0029 [0.0006, 0.0052]);
   - controlling −K% × elite and BB% × elite (+0.0035).

   It holds for both platoon sides: same-hand +0.0031, opposite-hand +0.0048.
9. **It is small in runs.** One SD of P1 is worth about 0.35 runs/season against elite pitching for a regular. The most extreme regulars of 2026 (z ≈ ±3) come out about ±1.0–1.5 runs/season against elite pitching, roughly ±15 wOBA points in those PAs. **Individual "clutch against aces" splits are noise:** split-half reliability of a hitter's elite split is 0.02–0.20 (Spearman–Brown, ≥ 100–200 elite PA), and empirical-Bayes shrinkage removes about 92% of each observed split. **Do not name players from observed splits.** Players can be named only by their P1, which is reliable (0.84), with a model-implied advantage.
10. **The postseason alone cannot confirm this.**
    - Sample size: 2021–2025 postseasons have about 15,100 eligible PAs; adding 2026 gives about 18,000. About 24% of those PAs would be against elite pitchers.
    - Interaction test: SE ≈ 0.0053–0.0057, so the 80% MDE is about **0.015–0.016 runs/PA**, roughly 4× the plausible effect. Power is 10–19% at β = 0.004 and 15–26% at 0.0053, depending on whether the test is one-sided at 0.025 or 0.05.
    - Simpler P1 main effect in the postseason: power is 10–33%.
    - Recommendation: keep the postseason as a pre-registered but explicitly *underpowered* check. Put the real confirmatory weight on regular-season holdouts that nobody has examined (2021, plus 2027 when available), pooled with the postseasons. That design reaches about 75–95% power (see the protocol at the end).

## Files

- **Code**, all in `/home/claude/paq-explore/`:
  - `build.py`: per-season PA tables. Extends the verifier's `q5_check.table`.
  - `lib.py`: two-way clustered OLS and the Q5 design.
  - `q1_extend.py`, `q2_dose.py`, `q3_components.py`, `q3b_wald.py`, `q4_mechanism.py`, `q4b_selection.py`, `perpa_extra.py`, `q5q6_robust.py`, `q5b_pitchertype.py`, `q7_individuals.py`, `q7b_implied.py`, `q8_power.py`.
- **Tables:** `tabs/tab_YYYY.pkl` (2022–2026) and `tabs/pitprior_YYYY.pkl` (2021–2025).
- **Results CSVs:** `q1_by_season.csv`, `q2_decile_slopes.csv`, `q3_components.csv`, `q4_mechanism.csv`, `q4b_selection.csv`, `q5q6_robustness.csv`, `q5b_elite_profile.csv`, `q7_reliability.csv`, `q7_hitters_vs_elite_2023_2026.csv`, `q7b_P1_implied_2026_regulars.csv`, `q8_power.csv`, `q8_usage_proxy.csv`.
- **Chart data:** `charts/c1…c11*.csv`.

My table builder reproduces the pipeline's sample exactly: 2025 n = 130,761 and 2026 n = 136,438. The registered fit reproduces too: verifier-style (pooled z, no season FE), 2025–26 gives +0.0053 [0.0029, 0.0077], n = 267,199, SD 0.1541. All other fits centre P1 within season, scale by the fixed SD of 0.154 and add season dummies. That gives +0.0051 on 2025–26.

---

## 1. Reproduction and extension to 2022–2024

Same model as Q5: residual ~ z(P1) + elite + z(P1)×elite + z(xwOBA) + z(xwOBA)×elite + same hand + TTO2 + TTO3+ + starter (+ season dummies). There are no park FE; Q6 shows they don't matter. Each season uses its own prior-season elite list.

| sample | n PA | elite PA | β (runs/PA per SD) | 95% CI | wOBA pts | one-sided p |
|---|---|---|---|---|---|---|
| 2022 | 134,027 | 21,681 | +0.0041 | [0.0000, 0.0081] | 5.1 | 0.024 |
| 2023 | 134,620 | 23,370 | +0.0037 | [−0.0013, 0.0088] | 4.6 | 0.075 |
| 2024 | 132,180 | 22,602 | +0.0018 | [−0.0028, 0.0064] | 2.2 | 0.23 |
| 2025 | 130,761 | 21,861 | +0.0057 | [0.0021, 0.0093] | 7.1 | 0.001 |
| 2026 | 136,438 | 24,877 | +0.0043 | [0.0002, 0.0085] | 5.4 | 0.020 |
| 2022–24 (dev) | 400,827 | 67,653 | +0.0032 | [0.0003, 0.0060] | 4.0 | 0.015 |
| 2025–26 (test) | 267,199 | 46,738 | +0.0051 | [0.0027, 0.0075] | 6.4 | 2e-5 |
| **2022–26** | 668,026 | 114,391 | **+0.0040** | **[0.0021, 0.0059]** | **5.0** | 2e-5 |
| 2022–26, hitter-clustered only | | | +0.0040 | [0.0020, 0.0060] | | |

All five seasons are positive. 2024 is the weakest. In the descriptive tercile means (pooled 2022–26, residual runs/PA):

| | low P1 | mid P1 | high P1 |
|---|---|---|---|
| vs non-elite | −0.0025 | −0.0041 | −0.0001 |
| vs elite | −0.0148 | −0.0120 | −0.0053 |

**Caveat.** The frozen swing, take and outcome models were fit on 2021–2023, so D, P1 and H_s are in-sample in 2022–23. In-sample seasons do not show a larger effect (0.0041 and 0.0037) than the out-of-sample 2025 (0.0057), so I see no sign of inflation.

## 2. Dose–response by pitcher-quality decile

Pitcher deciles come from prior-season mean H_s among ≥ 300-pitch pitchers, with each pitcher counted once. Decile 1 is the hardest to hit. Deciles 1–2 are exactly the registered elite set; I checked the agreement and it is 100%. The model has decile-specific intercepts, P1 slopes and xwOBA slopes.

| decile | n PA | P1 slope (runs/PA per SD) | 95% CI | mean resid |
|---|---|---|---|---|
| 1 | 55,853 | **+0.0049** | [0.0022, 0.0076] | −0.0132 |
| 2 | 58,538 | **+0.0045** | [0.0019, 0.0071] | −0.0084 |
| 3 | 58,901 | −0.0002 | [−0.0029, 0.0025] | −0.0076 |
| 4 | 68,727 | +0.0016 | [−0.0010, 0.0042] | −0.0039 |
| 5 | 66,990 | +0.0004 | [−0.0022, 0.0029] | −0.0030 |
| 6 | 72,282 | +0.0023 | [−0.0002, 0.0048] | −0.0018 |
| 7 | 70,994 | +0.0017 | [−0.0006, 0.0040] | −0.0049 |
| 8 | 76,774 | −0.0012 | [−0.0037, 0.0013] | −0.0007 |
| 9 | 71,635 | −0.0001 | [−0.0021, 0.0018] | −0.0011 |
| 10 | 67,332 | +0.0011 | [−0.0014, 0.0036] | +0.0043 |

Contrasts:
- Deciles 1–2 minus deciles 3–10: +0.0040 [0.0021, 0.0059].
- Deciles 3–4 minus 5–10: 0.0000 [−0.0019, 0.0019].
- Decile 1 minus decile 2: +0.0004 [−0.0032, 0.0040].
- Linear pitcher-quality interaction alone: +0.0012 per pitcher-SD [0.0004, 0.0020]. It vanishes once the top-20% dummy is added.

**Reading.** This is a step at about the top 20%, flat above and below. It is not a smooth gradient. The mean residual falls steadily with pitcher quality: the log5 expectation under-rates good pitchers because their xwOBA allowed is shrunk toward the league mean. The P1 *slope*, however, does not follow that gradient.

Chart data: `charts/c2_P1_slope_by_pitcher_decile.csv` and `charts/c3_resid_by_decile_x_P1_tercile.csv`. The latter gives decile × P1-tercile mean residuals; the high-minus-low gap is +0.0116 in decile 1, +0.0075 in decile 2, and −0.0021 to +0.0050 elsewhere.

## 3. Which part of decision skill carries it, and is it more than O-Swing%?

All predictors are pre-game and shrunk. P1 parts use ballast 1,000 pitches. O-Swing% and Z-Swing% use ballast 150 out-of-zone or in-zone pitches toward the prior-season league rate. Each predictor is centred within season and expressed per its own within-season SD. O-Swing% is negated so that + means better. Values are 2022–26 (2025–26 in parentheses).

| specification | interaction(s), runs/PA per SD |
|---|---|
| P1 alone (SD 0.149) | **+0.0039 [0.0020, 0.0057]** (2025–26: +0.0049) |
| P1 chase part alone | +0.0027 [0.0009, 0.0046] (+0.0037) |
| P1 zone part alone | +0.0013 [−0.0002, 0.0029] (+0.0007) |
| chase + zone jointly | chase +0.0043 [0.0022, 0.0063]; zone +0.0032 [0.0015, 0.0050] |
| −O-Swing% alone | +0.0028 [0.0007, 0.0049] (+0.0026 [−0.0002, 0.0054]) |
| Z-Swing% alone | +0.0001 [−0.0018, 0.0019] |
| −O-Swing% + Z-Swing% jointly | −OSw +0.0038 [0.0016, 0.0061]; ZSw +0.0020 [−0.0001, 0.0040]; joint χ²(2) = 11.2, p = 0.004 |
| P1 + −O-Swing% | **P1 +0.0038 [0.0012, 0.0064]**; −OSw +0.0002 [−0.0028, 0.0031] |
| P1 + −O-Swing% + Z-Swing% | **P1 +0.0033 [0.0002, 0.0064]** (Wald p = 0.035); rates jointly p = 0.85 |
| P1 chase part + −O-Swing% | chase +0.0015 [−0.0017, 0.0047]; −OSw +0.0016 [−0.0019, 0.0052] |

Correlations (PA-weighted): P1 with −O-Swing% is 0.72; P1 with Z-Swing% is −0.07; the chase part with the zone part is −0.37.

**Reading for the article.** "Plate discipline" in the sense of a low chase rate gets you about 70% of the way. The full effect needs both halves: avoid chases *and* keep attacking hittable strikes. A raw O-Swing% + Z-Swing% combination approximates that. P1 encompasses both rates: P1 survives given the rates, and the rates add nothing given P1. The reverse test is less decisive, because the collinearity is high. The chase part on its own cannot be separated from O-Swing% (they correlate 0.77). The honest framing: **mostly chase avoidance, with a real second ingredient (zone aggression) that raw O-Swing% misses. PAQ's P1 combines the two in the right proportion.**

## 4. Mechanism against elite pitchers by P1 tercile

The design uses hitter-season fixed effects, so each hitter is measured against his own non-elite baseline. Each cell gives the change against elite pitchers relative to that baseline, controlling for same-hand, TTO, starter and xwOBA × elite. Terciles are of pre-game P1 within season. The Q5-covariate version (no FE) gives the same numbers to within about 5%; see `q4_mechanism.csv`.

**Run decomposition.** These pieces add up exactly to pa_x / 1.25, in runs/PA.

| piece | low P1 | mid | high P1 | high − low [95% CI] | share of gap |
|---|---|---|---|---|---|
| total (raw xwOBA runs) | −0.0170 | −0.0115 | −0.0082 | **+0.0088 [0.0038, 0.0137]** | 100% |
| BB + HBP | +0.0077 | +0.0094 | +0.0096 | +0.0019 [−0.0011, 0.0049] | 21% |
| strikeouts (K → BIP rate) | −0.0172 | −0.0176 | −0.0160 | +0.0012 [−0.0013, 0.0036] | 13% |
| BIP quality (xwOBAcon) | −0.0074 | −0.0035 | −0.0022 | **+0.0052 [0.0014, 0.0090]** | 59% |
| other | −0.0002 | +0.0001 | +0.0002 | +0.0003 | 4% |

Per SD of P1 (continuous): total +0.0040, BB/HBP +0.0011, BIP rate +0.0005, BIP quality +0.0022.

**Process measures.** Change against elite pitchers relative to the hitter's own baseline:

| measure (non-elite mean) | low P1 | mid | high P1 | high − low [95% CI] |
|---|---|---|---|---|
| K% (21.96%) | +4.46 pp | +4.29 | +3.70 | −0.76 pp [−1.51, −0.02] |
| BB+HBP% (8.71%) | +1.38 pp | +1.67 | +1.72 | +0.34 [−0.20, 0.87] |
| reached 2 strikes (53.1%) | +3.26 pp | +2.90 | +2.88 | −0.38 [−1.20, 0.45] |
| pitches/PA (3.87) | +0.129 | +0.116 | +0.121 | −0.008 [−0.038, 0.021] |
| chase rate (31.3%) | +0.60 pp | +0.83 | +1.01 | +0.41 [−0.12, 0.94] |
| Z-Swing (68.0%) | −0.54 pp | −1.05 | −1.15 | −0.61 [−1.19, −0.03] |
| whiff/swing (24.7%) | +4.58 pp | +4.70 | +4.14 | −0.45 [−1.02, 0.13] |
| xwOBAcon (0.371) | −13.6 pts | −7.2 | −4.5 | **+9.1 [1.7, 16.4]** |
| ... pitch-based expected xwOBAcon of the BIP pitch (selection) | −7.1 | −7.5 | −8.5 | −1.4 [−2.7, −0.0] |
| ... xwOBAcon beyond pitch-based expectation (execution) | −6.4 | +0.3 | +4.0 | **+10.5 [3.0, 17.9]** |
| mean H_s of pitches swung at | −0.0101 | −0.0106 | −0.0107 | −0.0006 [−0.0012, 0.0001] |
| realized D per PA (runs) | −0.0037 | −0.0023 | −0.0014 | +0.0023 [0.0007, 0.0040] |

"Selection" is the pitch-only model B of the in-play pitch, mapped to xwOBA units: xwOBA = 0.328 + 1.04·B on BIP.

**Reading.** The gap comes mainly from **balls in play holding up**, then walks, then slightly fewer strikeouts. It does *not* come from disciplined hitters chasing less against elite arms; relative to their own baselines, everyone chases a bit more against these pitchers. It also does not come from them getting or choosing more hittable pitches, judged by pitch-based expectations. Against the same quality of pitch, their contact is better. One hypothesis, not tested here, is better pitch recognition and therefore better timing and fewer weak swings. Another is that B misses some of what makes an elite reliever's pitch hard to square up, and low-P1 hitters are more exposed to it. This connects to the study's Q3 null, where P1 did not forecast *general* future xwOBAcon. The contact edge appears specifically against elite pitching.

Chart data: `charts/c4_*.csv`, `charts/c5_*.csv` and `charts/c10_*.csv`.

## 5. Alternative "elite" definitions and contexts (2022–26)

Each alternative is the top 20% (per prior season, among pitchers with ≥ 300 prior pitches) on the stated metric. The sample stays the Q5 sample.

| definition / context | β [95% CI] | note |
|---|---|---|
| **H_s (registered)** | **+0.0040 [0.0021, 0.0059]** | 17.1% of PAs elite |
| whiff/swing | +0.0028 [0.0009, 0.0046] | 48% of these PAs also H_s-elite |
| xwOBA allowed (low) | +0.0017 [−0.0000, 0.0034] | 30% overlap |
| K% | +0.0012 [−0.0008, 0.0031] | |
| chase induced | +0.0010 [−0.0009, 0.0029] | |
| FB velocity (≥ 100 FB) | +0.0012 [−0.0008, 0.0032] | |
| low zone% | +0.0021 [−0.0003, 0.0045] | |
| high BB% | +0.0004 [−0.0020, 0.0029] | |
| low H_s on out-of-zone pitches | +0.0033 [0.0013, 0.0053] | |
| low H_s on in-zone pitches | +0.0015 [−0.0005, 0.0036] | |
| joint: H_s + whiff | H_s +0.0033 [0.0013, 0.0053]; whiff +0.0015 [−0.0004, 0.0034] | |
| joint: H_s + xwOBA allowed | H_s +0.0038; xwOBA allowed +0.0010 (ns) | |
| joint: H_s + velo | H_s +0.0040; velo −0.0001 | |
| PAs vs starters | +0.0026 [−0.0002, 0.0054] | elite share 11% |
| PAs vs relievers | **+0.0053 [0.0025, 0.0081]** | elite share 28% |
| elite within starters (role-specific top 20%) | +0.0008 [−0.0015, 0.0032] | |
| elite within relievers (role-specific top 20%) | **+0.0053 [0.0022, 0.0084]** | |
| TTO 1 / 2 / 3+ | +0.0035 / +0.0041 / +0.0040 | wide CIs for 2 and 3+ |
| innings 1–6 / 7+ | +0.0039 / +0.0044 | |

**Profile of H_s-elite pitchers versus the rest** (prior season):

| | H_s-elite | rest |
|---|---|---|
| starter share | 19% | 47% |
| whiff/swing | 30.3% | 24.8% |
| K% | 27.0% | 22.0% |
| BB% | 10.3% | 8.2% |
| zone% | 43.1% | 46.0% |
| FB velo | 95.4 mph | 93.5 mph |
| xwOBA allowed | .303 | .322 |
| chase induced | 30.7% | 30.1% |

They are not simply the pitchers with the best results (xwOBA allowed) or the hardest throwers.

**Reading.** The effect survives as "elite = hard to swing at profitably," especially on pitches outside the zone. It is only partly present for whiff-based definitions and is weak or absent for outcome-, strikeout- and velocity-based definitions. The definition that works was registered, not chosen after the fact. Still, an article should not say "against elite pitching" without qualification. "Against nasty, wild-ish relievers" is closer to what the data show.

## 6. Robustness (2022–26 unless stated)

| check | β [95% CI] |
|---|---|
| baseline | +0.0040 [0.0021, 0.0059] |
| exclude 2026 (ABS) | +0.0038 [0.0015, 0.0061] |
| 2025 only | +0.0057 [0.0021, 0.0093] |
| leave out 2022 / 2023 / 2024 / 2025 / 2026 | +0.0040 / +0.0041 / +0.0045 / +0.0036 / +0.0038 (all CIs exclude 0) |
| hitter xwOBA deciles × elite (replaces linear) | +0.0039 [0.0020, 0.0058] |
| + xwOBA² × elite + expectation × elite | +0.0040 [0.0021, 0.0059] |
| + park × season FE | +0.0040 [0.0021, 0.0059] |
| hitter-season FE + pitcher-season FE, raw outcome | +0.0059 [0.0040, 0.0079] |
| outcome raw xwOBA / 1.25 (no log5) | +0.0040 [0.0021, 0.0060] |
| outcome actual wOBA − expectation | +0.0029 [0.0006, 0.0052] |
| season-specific SD scaling of P1 | +0.0039 [0.0020, 0.0057] |
| only PAs where pre-game P1 rests on ≥ 500 prior pitches | +0.0032 [0.0012, 0.0053] |
| + pre-game −K% × elite and BB% × elite | P1 +0.0035 [0.0013, 0.0057]; −K% +0.0016 (ns); BB% +0.0008 (ns) |
| −K% alone × elite | +0.0017 [−0.0001, 0.0034] |
| platoon: same hand / opposite hand | +0.0031 [0.0005, 0.0058] / +0.0048 [0.0021, 0.0075] |

Nothing here threatens the estimate. It does not move with the 2026 zone shift, with flexible controls for hitter quality, with a model-free outcome, or with fixed effects on both sides. It is also not a proxy for being a low-strikeout hitter.

## 7. Individual hitters (2023–26 pooled)

**Reliability first** (`q7_reliability.csv`). This is the split-half correlation of a hitter's mean residual against elite pitchers, odd versus even game_pk, with each half required to have ≥ 100 non-elite PA:

| min elite PA (total) | hitters | mean elite PA | r (half) | 95% CI | Spearman–Brown full | r for "elite − non-elite gap" |
|---|---|---|---|---|---|---|
| 100 | 322 | 216 | 0.11 | [−0.00, 0.23] | 0.21 | 0.04 |
| 150 | 223 | 252 | 0.04 | [−0.09, 0.17] | 0.08 | 0.01 |
| 200 | 148 | 283 | 0.01 | [−0.16, 0.18] | 0.02 | −0.06 |

Empirical Bayes (regulars with ≥ 150 elite PA, n = 246):
- Observed variance across hitters is 0.000398, against a mean sampling variance of 0.000365.
- Implied true SD is about 0.006 runs/PA, but it is barely identified.
- The mean shrinkage factor is 0.086: about 92% of each observed split is noise.
- After shrinkage every hitter sits within about −0.008 to +0.002 runs/PA, with a posterior SD of about 0.0054. Nobody is distinguishable from anyone else.
- The correlation of a hitter's mean P1 with his raw elite split is 0.16.

For completeness, shrunk top and bottom lists were produced; they are not published, because with reliability ≤ 0.2 they are mostly luck. [Names redacted in the public copy.]

**What can be said about individuals.** P1 itself is reliable (split-half rel300 ≈ 0.84), so a *model-implied* advantage is defensible. It is computed as β × (end-of-2026 shrunk P1 − mean) / 0.154 (`q7b_P1_implied_2026_regulars.csv`; 205 regulars with ≥ 400 PA, names from the MLB Stats API). This applies a population slope to a reliable skill. It is not an observed split.
- [Player lists redacted in the public copy. These model-implied advantages assume the population effect, which the later pre-registered holdout did not confirm.]
- With about 88 elite PA a season, even these extremes are worth only about ±1–1.5 runs/season.

## 8. Postseason planning (no postseason data used)

**Sample size.**
- Postseason games, from the public record (verify before registering): 2021: 37, 2022: 40, 2023: 41, 2024: 43, 2025: 47, for **208 games**. The 2026 postseason is in progress (assume about 40; it must be registered before it is examined).
- PAs: about 72.5 non-pinch-hit wOBA-denominator PAs per game (2025 regular season), so about **15,100 PAs for 2021–25** and **about 18,000 for 2021–26**.
- Eligibility: with a *same-season regular-season* elite rule, coverage of postseason pitchers is about 100% (all proxy pitchers have ≥ 300 regular-season pitches). The prior-season rule covers only about 87%.

**Elite share.** As a proxy I used playoff teams' regular-season PAs by their top 4 starters and top 7 late-inning relievers, weighted 55/45 for starters/relievers. That gives an elite share of about **24%** under either rule (starters about 13%, relievers about 37%), or about **3,600–4,250 elite PAs**. The regular-season share is 17%.

**Power.** I simulated 30 pseudo-postseasons per cell, drawn from regular-season PAs *between playoff teams* (2022–25) at the stated N and elite share, using the full model and two-way clusters (`q8_power.csv`, `charts/c11_*.csv`).

| N PA | elite share | SE(P1 × elite) | MDE 80%, 1-sided .025 | MDE 80%, 1-sided .05 | SE(P1 main, postseason mix) | MDE main (.025 / .05) |
|---|---|---|---|---|---|---|
| 12,000 | 0.24 | 0.0064 | 0.018 | 0.016 | 0.0028 | 0.0079 / 0.0070 |
| 15,000 | 0.24 | 0.0057 | 0.016 | 0.014 | 0.0026 | 0.0072 / 0.0064 |
| 18,000 | 0.24 | 0.0053 | 0.015 | 0.013 | 0.0023 | 0.0064 / 0.0057 |
| 18,000 | 0.35 | 0.0047 | 0.013 | 0.012 | 0.0024 | 0.0066 / 0.0059 |

Power at plausible true effects, N = 18,000:
- Interaction at β = 0.0040 (pooled) or 0.0053 (registered): **11–19%** / **17–26%**.
- P1 main effect in a postseason mix: expected 0.0007 + 0.24 × 0.004 ≈ 0.0017 (pooled) up to 0.0015 + 0.24 × 0.0053 ≈ 0.0028 (registered). Power is **11–33%**.

**Neither postseason test is powered.** To detect the interaction at 80%, the postseason effect would have to be about 4× the regular-season effect.

**A regular-season replication is the only powered route.** One season has SE ≈ 0.0022, so power is 45% at β = 0.004 and 68% at 0.0053. Two seasons give 74% and 93%.

## What would make a good chart

| # | chart | file |
|---|---|---|
| 1 | **The step chart** (lead graphic): P1 advantage (wOBA points per SD) by pitcher-quality decile, with CIs. Two tall bars at the left, flat afterwards. | `charts/c2_P1_slope_by_pitcher_decile.csv` |
| 2 | Lines: residual by pitcher decile for low/mid/high P1 terciles. The lines separate only at the left edge. | `charts/c3_resid_by_decile_x_P1_tercile.csv` |
| 3 | Forest: interaction by season, 2022–2026 plus pooled. "It's there every year." | `charts/c1_interaction_by_season.csv` |
| 4 | Stacked bars: where the runs come from against elite pitching, low vs high P1 (walks, strikeouts, contact quality). | `charts/c4_run_decomposition_vs_elite_by_P1_tercile.csv` |
| 5 | Dumbbell: selection vs execution in contact quality. Same pitches, better contact. | `charts/c10_contact_selection_vs_execution.csv` |
| 6 | Horse race: P1 vs O-Swing% vs Z-Swing% interactions, alone and jointly. | `charts/c9_decision_components_horse_race.csv` |
| 7 | Forest: alternative elite definitions and starter/reliever contexts. "It's about nasty relievers." | `charts/c6_alt_elite_definitions.csv` |
| 8 | Forest: robustness checks. | `charts/c7_robustness_forest.csv` |
| 9 | Process-change table or small multiples (K%, BB%, chase, Z-Swing, whiff, xwOBAcon). | `charts/c5_process_change_vs_elite_by_P1_tercile.csv` |
| 10 | Scatter, cautionary: hitters' P1 vs shrunk elite split. A flat cloud makes the "don't trust individual splits" point. | `charts/c8_hitter_P1_vs_elite_scatter.csv` |
| 11 | Power curve for the postseason test vs true effect size. | `charts/c11_postseason_power_curve.csv` |

## Caveats

- **Exploratory.** I ran about 80 specifications. Only the registered 2025–26 Q5 test is confirmatory. The 2022–24 extension uses seasons the protocol called development seasons; they were not used to choose the Q5 specification, but they are not holdouts either.
- **In-sample models in 2022–23.** The frozen models were fit on 2021–23, so P1 and H_s are in-sample there. The 2026 inputs carry the ABS zone shift, and p_ref drifts −1.2/−2.3 pp in 2025/26; I centred P1 within season. None of these changes the conclusion.
- **Sample coverage.** The Q5 sample drops about 26% of PAs: pitchers without ≥ 300 prior-season pitches, plus pinch-hit PAs.
- **What the expectation is.** The log5 expectation uses shrunk pitcher xwOBA allowed (200 PA ballast). It under-rates elite pitchers, which is why the residual means are negative against elite pitchers. The interaction, not the level, is the finding. It survives with no expectation and with two-way FE.
- **The pitcher definitions share the same models.** Elite H_s and P1 both come from the PAQ pitch models. The outcome (xwOBA or wOBA) does not, so the interaction is not mechanical. Still, the finding is specific to model-defined "hard to swing at" pitchers, and is weaker for outcome- and stuff-based definitions.
- **The mechanism split rests on assumptions.** The selection/execution split assumes the pitch-only B model captures pitch quality. "Execution" includes anything about the pitch that B misses.
- **Postseason inputs are approximate.** Game counts are from memory of the public record and should be verified. The usage proxy for elite share is crude; the plausible range is 20–35%. The MDEs barely move across that range.
- **Untouched data.** The 2021 regular season has not been used for any Q5-type analysis. Neither the pipeline, nor the verifier, nor I have looked at it; I used 2021 only to define 2022 elite pitchers. Keep it that way if it is to serve as a holdout.

## Recommended confirmatory protocol

**Bottom line: a postseason-only test is not powered.** At N ≈ 18,000 PAs, power is about 11–26% for the interaction and 11–33% for the P1 main effect. Register it if you want, but label it a low-power consistency check whose failure is uninformative. The powered design pools the postseasons with regular-season data that nobody has examined.

**Primary confirmatory test (powered).** Use the P1 × elite interaction, registered Q5 model, in a pooled holdout made of:
- (a) the 2021 regular season, never examined for Q5. It needs 2020 regular-season Statcast for the prior-season elite rule (60-game season, ≥ 300 pitches) and must be fetched after registration;
- (b) all 2021–2026 postseasons;
- (c) optionally, the 2027 regular season if the article can wait.

Specification:
- **Outcome:** (xwOBA_PA − log5 expectation) / 1.25 on wOBA-denominator, non-pinch-hit PAs.
- **Expectation:** shrunk pre-game hitter xwOBA (200 PA) and pitcher xwOBA allowed (200 PA), with the league mean as in Q5. For postseason PAs, freeze all inputs at the end of that season's regular season.
- **Skill:** pre-game shrunk P1 (ballast 1,000). For the postseason, use the end-of-regular-season value. P1 is centred within season and scaled by the registered 0.154.
- **Elite:** regular season, prior-season bottom-20% mean H_s (≥ 300 pitches). Postseason, the same season's regular-season bottom-20% H_s (≥ 300 regular-season pitches). The postseason needs **no model scoring of postseason pitches**, only PA outcomes, IDs, handedness, TTO and starter flag. That keeps it leakage-free and insulated from the ABS zone issue.
- **Model:** as Q5, plus season dummies and a postseason indicator × elite. Two-way clustering by hitter and pitcher.
- **Pass rule:** pooled β > 0 with one-sided p < 0.025, and the point estimate positive in the regular-season block and in the postseason block. Report the postseason block's own estimate, CI and power.
- **MDE / power:** 2021 regular season (SE ≈ 0.0022) plus postseasons (SE ≈ 0.0053) gives a combined SE ≈ 0.0020, MDE ≈ 0.0057. Power is about 52% at β = 0.004 and 74% at 0.0053. Adding the 2027 regular season gives SE ≈ 0.0015, MDE ≈ 0.0042, and power of about 76% at 0.004 and 95% at 0.0053. **Recommend (a) + (b) + (c) for a powered test, or state openly that (a) + (b) has roughly coin-flip power.**

**Pre-registered secondaries** (Holm across them, all on the same holdout):
1. The same test restricted to PAs against relievers, which is where the effect lives.
2. The mechanism: the xwOBAcon component, high- vs low-P1 tercile change against elite pitchers.
3. The P1 main effect in postseason PAs against the regular-season expectation. Prediction: about +0.002 runs/PA per SD, power about 15%. Descriptive only.

**Interpretation rules, registered in advance:**
- If the postseason block alone is null, that is not evidence against the finding, because power is under 25%.
- A negative pooled estimate whose CI excludes +0.002 would count against it.
- Individual-hitter splits are never tested or named.
