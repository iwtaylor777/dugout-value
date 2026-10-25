# Plate Appearance Quality (PAQ): do disciplined, battling hitters earn better pitches, better contact and shorter starts?

Draft 4, October 23, 2026. It applies a second referee pass (`REVIEW-draft3.md`) to draft 3, which revised draft 2 (`PROTOCOL-draft2.md`) to center Ian's question. Do hitters have a repeatable skill for good at-bats: avoiding chases, fighting off difficult pitches, working counts? If so, does that skill earn them better pitches to hit, better contact, value against elite pitching, and shorter outings from opposing starters? The measurement machinery from draft 2, which was refereed (`REVIEW.md`), is unchanged.

Raw Savant files began downloading before this lock, on October 23, 2026. No pitch-level data has been parsed, summarized or modeled. The original PAQ prototype (ChatGPT, October 2026) was synthetic-only and was not recovered.

## Positioning and prior work

**An open, pre-registered test of the whole chain from plate-appearance process to results:**
- whether good at-bats are a skill;
- whether that skill buys better pitches and better contact;
- whether it shortens opposing starters.

The test also covers whether swing decisions should be graded against the league or against the hitter.

Prior work this builds on:
- [PLV Decision Value and Contact Ability](https://pitcherlist.com/weeks-1-2-plv-weekly/) (Pitcher List, Bland);
- [Process+](https://pitcherlist.com/what-is-process-pitcher-lists-new-all-encompassing-hitting-stat/) (Pitcher List, Bland);
- [SEAGER](https://www.baseballprospectus.com/news/article/86572/the-crooked-inning-corey-seager-rangers/) (Baseball Prospectus, Orr).

E, the execution term, is not claimed as new. A difficulty-adjusted contact credit is PLV Contact Ability, and in runs it is Process+ Contact. This study is not a new execution metric.

## Definition

PAQ grades every pitch of a plate appearance on the hitter's **process**: what he chose to do, and whether he executed the swing he chose. The grade is in runs, relative to a reference hitter seeing the same pitch in the same count. A PA's PAQ is the sum over its pitches. The primary rate is **runs per 100 pitches**; per-PA rates are secondary.

**Currency.** V(c) is count-only linear-weight value, not RE24, which would import base-out context. PAQ is in runs above an average PA. Terminal values are the BB, HBP and K linear weights. Two consequences:
- In pitchers' counts V(c) is below average B, so a two-strike foul is credited against a whiff but debited against a ball in play.
- PAQ cannot value pitch-count pressure, because a foul leaves V unchanged.

**PAQ excludes**:
- the final result of the PA (hit, out, walk or strikeout);
- batted-ball quality (exit velocity, launch angle, spray), which belongs to a separate contact-quality measure and is not part of this study.

PAQ depends on swing outcomes (whiff, foul, ball in play) through the execution term only. With the league reference it is therefore *final-result-independent* and *batted-ball-independent*. It is not outcome-free. Only the decision term is outcome-free.

For pitch i, with count c before the pitch and a_i = 1 if he swung:

- **V(c)** is the league run value of a PA from count c: the expected linear-weight runs of the remaining PA. Fit on 2023 only.
- **EV_take(i)** = P(called strike | pitch)·V(c+strike) + P(ball | pitch)·V(c+ball), plus the HBP probability times the HBP value.
- **EV_swing(i)** = P(whiff | swing, pitch)·V(c+strike) + P(foul | swing, pitch)·V(c after foul) + P(in play | swing, pitch)·B(pitch, c).

  B is the expected run value of a ball in play *given the pitch's characteristics and the count*. It is estimated from the pitch alone, never from the realized exit velocity or launch angle, and fit on 2023 only. Its training target is runs from Statcast's xwOBA (`estimated_woba_using_speedangle`), not realized linear weights: less noisy, and still not a per-pitch input.
- **Decision value** D(i) = EV(chosen action) − [p_ref(i)·EV_swing(i) + (1 − p_ref(i))·EV_take(i)] = (a_i − p_ref(i))·(EV_swing(i) − EV_take(i)). Here p_ref is the league's swing probability on that pitch: credit is relative to what the reference hitter would typically do. This is the advantage function: zero in expectation for the league and immune to pitch mix. A descriptive "regret" version, EV(chosen) − max(EV_swing, EV_take), is also reported but not tested. D_alt = EV(chosen) − EV(other) credits hitters for every obvious take and so rewards hitters who get pitched around; it is reported only for PLV comparability (S5).
- **Execution value** E(i) applies on swings only. E(i) = W(observed swing class) − EV_swing(i), where W(whiff) = V(c+strike), W(foul) = V(c after foul) and W(in play) = B(pitch, c). This credits making contact and spoiling two-strike pitches relative to the league's expectation for that pitch. It ignores how hard the ball was hit.
- **PAQ** = Σ (D + E) over the PA's pitches. Report D and E separately alongside the total.
- **Hittability** H(i) = max(EV_swing(i), EV_take(i)) − V(c_i), from the league models. This is how much a pitch offers a hitter relative to the count it was thrown in. It describes the pitch, not what the hitter did with it. Because an obvious ball scores like a meatball (EV_take ≈ V(c+ball) > V(c)), H means how poor the pitch was; report H split by argmax (swing vs take side).

**The four process skills** are the study's focus. Each is a hitter rate, and each uses the league reference unless stated:
- **P1, decision quality:** D per 100 pitches. Two named parts are reported: *chase avoidance*, D on pitches outside the zone, and *zone aggression*, D on pitches inside it. The zone is |x| ≤ 0.83 ft and z within the fixed batter-season zone; both parts are rated per 100 total pitches so they sum to P1.
- **P2, fighting off difficult pitches:** E per 100 two-strike swings at *difficult* pitches. A difficult pitch is in the top tercile of league P(whiff | swing), with cutpoints set on 2021–2023 two-strike swings. Spoiling a tough two-strike pitch scores above expectation.
- **P3, working the count:** the hitter effect from an additive hitter + pitcher fixed-effects model of pitches per PA, fit only on the period where P3 is measured: each half for Q2–Q4, each odd/even game set for Q1, and games strictly before the scored game (refit nightly) for Q5 and T1. Automatic balls/strikes are not pitches. Pitchers with < 30 BF in the period are pooled into one effect. Season-to-date skills are shrunk toward 0 with ballast of 1,000 pitches (P1), 60 difficult two-strike swings (P2) and 150 PA (P3).
- **PAQ:** P1 + E, the overall process grade, with E per 100 pitches.

**References.** p_ref is always the league swing model. E is always graded against the league swing-outcome model. The hitter-specific reference changes only the decision benchmark: D_h(i) = (a_i − p_ref(i))·(EV_swing,h(i) − EV_take(i)), where EV_swing,h uses the hitter's shrunken P(whiff), P(foul), P(in play) and B. S3 compares D_league with D_h, with E_league held fixed. Shrinkage: a logit offset for each outcome, and an additive offset for B, by hitter × region group (9 zone regions × 3 pitch groups). Each offset gets a normal prior with variance estimated by REML on 2021–2023, and the offsets are updated nightly from games strictly before the scored game, so a PA never informs its own reference.

D_h is not batted-ball-independent at the hitter level, because B_h is his prior contact quality. The ablation **D_h−B** uses the hitter's contact probabilities only (B stays at the league level), to show how much of any D_h gain is xwOBAcon leaking through.

**Pitch features**, fixed in advance:
- plate_x and plate_z in feet, plus a fixed batter-season zone (median sz_top/sz_bot for 2021–2025, the ABS zone for 2026);
- pitch type in seven groups (FF, SI, FC, SL/ST/SV, CU/KC, CH/FS, other);
- velocity;
- horizontal and vertical movement;
- release height and side, and extension;
- approach angles (VAA, HAA) from the 9-parameter fit;
- spin rate;
- pitcher and batter handedness;
- count.

None of these is contact information. Release, extension, approach-angle and spin features keep pitcher quality out of E's residual. The hitter offsets use three pitch groups (fastball/breaking/offspeed).

**Perceivability.** Pitches are graded against the true final location. That is correct for value, and because p_ref is the league's response to the identical pitch, deception is absorbed: a hitter is penalized only for being fooled more than the league. Pre-registered sensitivity: recompute p_ref from the trajectory extrapolated from ~0.17 s before the plate (the tunnel point) and report how D rankings move.

**Models.** HistGradientBoosting (scikit-learn): max depth 4, minimum leaf 200, learning rate 0.05, `max_iter` ≤ 2000 with early stopping on a fixed 10% game split of 2021–2023, seed 20261023. Not tuned on test seasons. Validation is calibration on 2024 by count × region.

**Fitting seasons.** V(c) and B are fit on 2023 only: the 2023 shift ban, pitch clock and larger bases changed the value of balls in play and the run environment. They are checked on 2024. When scoring 2023 itself, V and B are cross-fitted by calendar half: models fit on games through June 30 score July onward, and the reverse. 2021, 2022, 2024 and later seasons use the full-2023 fit. p_ref, the take model and the three-class swing-outcome model are fit on 2021–2023.

**Cross-fitting.** All PAQ values in 2021–2023 are cross-fitted: the pitch models are refit leaving out one season at a time, and each season is scored by the models that excluded it. 2024 is scored by models fit on 2021–2023. 2025 and 2026 are scored by the frozen 2021–2023 models.

**2026 handling.** In 2026, plate coordinates are measured at mid-plate and called strikes are post-challenge, with ABS height-based zones. For swing models, the trajectory reconstruction validated in the ShapeCast study (`analysis/deception_residual/PROSPECTIVE_2026.md`; 0.003 ft median error, 99.1% valid) converts 2026 coordinates to the front-of-plate frame. For 2026 only, P(called strike) is refit on 2026 takes using the final, post-challenge call, cross-fitted by calendar month, with mid-plate coordinates. The take model carries no hitter skill, so this is not test-set tuning.

**Context.** Hit-and-run and take signs are scored as hitter decisions. This is disclosed, not corrected.

## Event classes

| Statcast `description` / event | Class | D | E |
|---|---|---|---|
| ball, blocked_ball, called_strike | take | yes | no |
| hit_by_pitch | take (EV_take already includes P(HBP)) | yes | no |
| swinging_strike, swinging_strike_blocked, **foul_tip** | whiff (W = V(c+strike); a two-strike foul tip is a strikeout) | yes | yes |
| foul | foul (W = V(c), unchanged count, at two strikes) | yes | yes |
| hit_into_play | in play (W = B) | yes | yes |
| foul_bunt, missed_bunt, bunt_foul_tip, bunt BIP (`des` contains "bunt", or events sac_bunt / sac_bunt_double_play) | excluded | no | no |
| pitchout, foul_pitchout, swinging_pitchout | excluded | no | no |
| intentional walk (no pitches since 2017) | PA excluded from the denominator | — | — |
| catcher_interf | pitch excluded | no | no |
| automatic ball/strike (pitch-clock or timer violation) | not a pitch; enters only through the next pitch's pre-pitch count. Batter-timer strikes are reported as a separate descriptive rate. | no | no |
| PA ending without a batter result (caught stealing or pickoff for the third out) | pitches scored; PA not counted in per-PA denominators | yes | yes |

Check swings follow the umpire's ruling.

## Data

- Baseball Savant pitch-level search CSVs, 2021–2026 regular season, downloaded in date chunks with SHA-256 receipts. Same conventions as `analysis/deception_residual/scripts/fetch_2026_outcomes.py`.
- MLB Stats API boxscores for starters' outs, pitches and batters faced, and probable pitchers for opener identification.
- 2020 is excluded because of the short season.
- Identity uses MLBAM IDs.
- Before any scoring, audit the event classes above and count continuity.

## Seasons

| Role | Seasons | Use |
|---|---|---|
| Development | 2021–2023 | Fit p_ref, the take model, the swing-outcome model and the hitter-offset priors (cross-fitted). Fit V(c) and B on 2023 only. Fit the Q2–Q4 regression weights on the pooled development pairs (first half → second half of 2021, 2022 and 2024; 2023 excluded). Compute T1's power. |
| Validation | 2024 | Check calibration of the pitch models by count × region, and check V and B. No PAQ score decisions are made from it; its wOBA enters only as the outcome of the 2024 first-half → second-half pair. |
| Test 1 | 2025 | All PAQ hypotheses below. |
| Test 2 | 2026 | All PAQ hypotheses below, as an independent replication. |

2025 and 2026 have appeared in other Dugout Value studies (ShapeCast, directional xwOBA, arsenal synergy, attackability, damage conversion), never with this endpoint or these features.

## Questions and pre-registered tests

**Half-season cutoff.** The first half is regular-season games through June 30. The second half is July 1 to season end. This is the same cutoff as the ShapeCast study.

**Test pairs.** "Both test seasons" means two pairs: 2025 first half → 2025 second half, and 2026 first half → 2026 second half. The full-season 2025 → 2026 pair is secondary, reported separately. Process measured in one period always predicts outcomes in a *later* period, so no pitch enters both sides.

**Development pairs:** first half → second half of 2021, 2022 and 2024. 2023 is excluded because its first half is scored by V and B fit on its second half. **Qualifying hitter:** ≥ 150 PA in each half. Q2–Q4 weights are fit on the pooled development pairs. Within each pair, the outcome and predictors are centred on qualifying-hitter means (absorbs the 2026 ABS shift).

**Primary family:** Q2, Q3, Q4 and T1. If T1 fails its power rule, it is dropped and m = 3. Each test's p is the larger of its two one-sided season p-values (intersection–union). For T1 it is the pooled one-sided p. Holm is applied at one-sided α = 0.025. A test passes only if it clears its Holm level and its other stated conditions (effect floor, sign). Q1 rules apply per measure, unadjusted. **Key secondaries:** Q5 (elite pitching) and S3 (league vs hitter reference).

### Q1. Are good at-bats a skill?

For P1, its two named parts, P2, P3 and PAQ, within each test season, report:
- odd/even **game** split-half reliability, Spearman–Brown-corrected to 300 PA;
- year-to-year correlation, 2025 → 2026, for hitters with at least 300 PA in both seasons;
- the PA at which each reaches 0.5 reliability. Compare with wOBA, xwOBA, K%, BB%, O-Swing% and Z-Contact%.

A measure **counts as a skill** if its split-half reliability at 300 PA is ≥ 0.5 and the 95% bootstrap CI excludes 0.3, in both test seasons. **Q1b**, descriptive only: the reliability of P1 and P2 residualized on O-Swing%, Z-Swing% and Contact%. It shows what the measures capture beyond raw rates.

### Q2. Does process earn better pitches to hit? (primary)

Outcome: the hitter's later-period mean count-centred hittability H*(i) = H(i) − h̄(c_i), where h̄(c) is the 2023 league mean H in count c. The count channel is descriptive: report his mean h̄(c) and his share of PAs reaching 2-0, 3-0 or 3-1. Baseline: first-period ISO, xwOBAcon, mean decision stakes |EV_swing − EV_take|, mean batting-order slot and bats (L/R/S), plus later-period mean H* that his opponents threw to all other hitters. The challenger adds P1, P2 and P3. Fit OLS on the development pairs, then score on the test pairs.

**Pass:** PA-weighted RMSE reduction with a paired-bootstrap 95% CI excluding 0 in both test pairs, and a positive P1 coefficient when refit on each test pair.

Descriptive companion: the within-PA mechanism. Report the change in H on the next pitch after a take of a ball versus a chase, by count.

### Q3. Does process earn better contact? (primary)

The outcome is the hitter's later-period xwOBA on contact (xwOBAcon). Add first-period P1–P3 to a baseline of first-period xwOBAcon, ISO and age.

**Pass:** BIP-weighted RMSE reduction ≥ 0.5%, with a paired-bootstrap 95% CI excluding 0, in both test pairs. Secondary: the same test with O-Swing% and Z-Swing% added to the baseline.

Descriptive decomposition: for each hitter-season, split xwOBAcon into **selection**, the league B averaged over the pitches he put in play, and **contact skill**, the residual. Report the share of between-hitter xwOBAcon variance due to selection.

### Q4. Does process predict future hitting beyond simpler statistics? (primary)

The target is later-period wOBA, PA-weighted. The baseline is ridge regression on prior-period wOBA, xwOBA, K%, BB%, O-Swing%, Z-Swing%, O-Contact%, Z-Contact% and age. The challenger adds P1, P2, P3 and E. Fit on the development pairs and score on the test pairs.

**Pass:** RMSE reduction ≥ 0.5% with a paired-bootstrap 95% CI excluding 0, in both test seasons. **Ablations**, secondary: each of P1, P2 and P3 removed in turn. Add P1 + P2 vs P1. The P2 ablation keeps E, so it tests P2 beyond E, not beyond decisions; P1 + P2 vs P1 tests P2 beyond decisions. These show which process skill carries any gain.

### Q5. Do process hitters do especially well against elite pitching? (key secondary)

This is a PA-level analysis over 2025 and 2026. The outcome is the PA's expected value: xwOBA-based runs for balls in play, and linear weights for BB, HBP and K.
- **Expectation:** a log5 combination of the hitter's and the pitcher's pre-game, season-to-date xwOBA, shrunk toward the league with 200 PA (or BF) of ballast.
- **Elite pitcher:** the bottom 20% of pitchers by prior-season mean H per pitch, among those with ≥ 300 prior-season pitches; others are excluded. PAs against position players and pinch-hit PAs are excluded. Expectation and outcome are both in runs: (xwOBA − league wOBA) / wOBA scale.
- **Model:** residual on shrunk P1, elite, P1 × elite, the hitter's shrunk pre-game xwOBA × elite, same-hand, times through the order (1, 2, 3+), starter/reliever and park, with two-way clustering. The P1 and P2 versions are Holm-adjusted together.

**Registered direction:** a positive interaction, meaning disciplined hitters lose less against elite pitchers. It passes if the interaction's 95% CI excludes 0 in the pooled 2025–2026 data and has the same sign in each season. Pitchers face batters non-randomly in high-leverage spots, so this is observational. The same test is repeated with P2.

### T1. Do process lineups shorten opposing starters? (primary)

The unit is the team-game: 2025 and 2026, with the opposing team's starting pitcher. **Openers** are excluded on pre-game information only: a start is excluded if the starter's mean BF over his last 10 starts (this and the prior season) is below 15, or he has < 3 starts in that window. Excluding short starts by their outcome would select on the result.

**Predictor:** X = equal-weighted mean over the nine lineup slots of z(P1) + z(P2), each season-to-date and shrunk; z uses 2022–2024 hitter-season SDs. Lineup P3 → starter P/BF becomes a second positive control. Add batting-team × season and home-plate-umpire fixed effects.

- **Primary outcome:** the starter's pitches per batter over his first 18 batters faced, or all batters faced if fewer. A fixed window sidesteps the manager's hook.
- **Secondary outcomes:** the starter's outs recorded; team runs.

Controls:
- starter fixed effects;
- the starter's season-to-date pitches per BF and K-BB%;
- days of rest;
- the lineup's season-to-date wOBA;
- park, season and batting-team fixed effects;
- the starter's and the lineup's handedness mix.

Inference is clustered by game.

**Pass:** the coefficient on X is positive with a 95% CI excluding 0, pooled over 2025–2026, and positive in each season.

**Power:** fit the T1 model on 2022–2024; MDE = 2.8 × SE(β) × √(N_dev / N_test), where N_test counts non-opener 2025–2026 team-games. If MDE > 0.05 pitches per BF per unit of X, T1 is an estimate and leaves the primary family.

**Positive control:** lineup pitches per PA (season-to-date) must predict the starter's outs recorded.

### S3. League or hitter reference? (key secondary)

Repeat Q1 and Q4 with D_h in place of D_league, holding E_league fixed. Report D_league, D_h and D_h−B. D_h counts as better if its Q4 challenger beats the D_league challenger in both test seasons, with a paired-bootstrap 95% CI excluding 0.

### S5. Head-to-head with existing approaches (secondary)

Replicas are built on the same pitch models and run through Q1 and Q4 alongside P1:
- SEAGER-style: hittable = EV_swing > EV_take; selection tendency minus hittable-pitch take rate;
- PLV-style D_alt = EV(chosen) − EV(other);
- realized swing/take run value.

## Deferred

The individual run value of pitch-count pressure (T2) is deferred: it needs a times-through-the-order and next-day bullpen-fatigue model. It can only be built after T1 shows an effect.

## Uncertainty

- Paired bootstrap with 5,000 draws, seed 20261023, resampling hitters for Q1–Q4, S3 and S5, and team-games for T1. Q5 uses two-way clustered errors.
- Holm follows the Primary family paragraph: each primary test's p is the larger of its two one-sided season p-values (T1: the pooled one-sided p), at one-sided α = 0.025. Q5's P1 and P2 versions are Holm-adjusted together across the two.
- Report development-season MDEs for Q2, Q3 and Q5, as information, not a gate.
- Positive results must hold in both test seasons, and nulls are published.
- No weights or components change after test scores are seen.

## Outputs

- The audit.
- Model calibration on 2024.
- Q1–Q5, T1, S3 and S5, including failures, and the perceivability sensitivity.
- Per-hitter P1, P2, P3 and PAQ for 2025–2026, labeled by whether Q1 passed.
- A "best at-bats" list for illustration only.
- Derived data, code and an offline replay. Raw Savant files are not redistributed.

## Changes from draft 3

Applied from the referee report on draft 3 (`REVIEW-draft3.md`), October 23, 2026. Draft 3 is saved as `PROTOCOL-draft3.md`.
- B1: T1 opener rule, predictor X (z(P1) + z(P2); P3 becomes a second positive control), fixed effects, pass and power rule replaced.
- B2: Q2 outcome (count-centred H*), baseline controls and pass replaced.
- B3: P3 bullet replaced with the period-restricted hitter + pitcher fixed-effects fit and the shrinkage ballasts.
- M1: Primary family paragraph replaced (intersection-union p-values, Holm at one-sided 0.025, T1 dropped if underpowered).
- M2: Development pairs and qualifying-hitter rule added after Test pairs; Validation row ridge clause replaced.
- M3: Q5 elite-pitcher and model bullets replaced.
- M4: Q3 pass replaced (BIP-weighted, 0.5% floor, secondary with O-Swing% and Z-Swing%).
- m1: H reported split by argmax (swing vs take side).
- m2: P1 parts defined with the zone and rated per 100 total pitches.
- m3: P2 tercile cutpoints set on 2021-2023 two-strike swings.
- m4: E in PAQ = P1 + E is per 100 pitches.
- m5: Q4 adds P1 + P2 vs P1 and states what the P2 ablation tests.
- m6: development-season MDEs for Q2, Q3 and Q5 reported as information (Uncertainty).
- Seasons table: Development and Validation rows updated to match M2.
- Uncertainty: Holm follows M1; Q5 is Holm-adjusted across its P1 and P2 versions.
- Header changed to Draft 4.

### Ambiguities resolved
- Header: only "Draft 3" was changed to "Draft 4". The rest of that line (it revises draft 2, to center Ian's question) is untouched.
- T1 text: the replacement block was split at its bold labels (Openers, Predictor, Pass, Power) and each part placed where the text it replaces stood; wording is verbatim. In the opener paragraph, "This is a relief role." was removed with the old threshold, and the sentence about excluding short starts by outcome was kept. The existing "park, season and batting-team fixed effects" control and the existing positive-control paragraph were left as they were.
- Q2: the parenthetical "(2022→2023 halves and 2023→2024 halves)" was dropped from "Fit OLS on the development pairs", since M2 defines the development pairs. "Fit OLS ..., then score on the test pairs." was kept after the challenger sentence.
- Primary family: the report's text replaced the old Primary family sentence and the sentence "Everything else is secondary, with Holm adjustment within its family" (it conflicts with "Q1 rules apply per measure, unadjusted"). The "Key secondaries: Q5 and S3" sentence was kept, moved to the end of the paragraph.
- Q5 Holm: the report gives no level or p-value for it. I used the Q5 interaction's pooled one-sided p-value at one-sided alpha = 0.025, with m = 2 (P1 and P2 versions). Q5 stays outside the primary family.
- Q5: the old note that 2025 PAs use 2024 as the prior season, scored with the 2021-2023 models, was removed with the old elite-pitcher bullet. The Registered direction paragraph was left unchanged.
- M2 Development row: the 2024 pair is listed in the Development row's regression-fit clause as well as in the Validation row, since the pairs pool 2021, 2022 and 2024.
- m1, m2, m3, m4, m5, m6: the report gives instructions rather than text, so wording is mine, kept close to the report's words. m6 sits in the Uncertainty section.
- Changes section placement: before "Changes from draft 2", newest first.

## Changes from draft 2

Centered on Ian's question (October 23, 2026):
- the four process skills P1–P3 and PAQ;
- hittability H;
- Q2, better pitches to hit;
- Q3, better contact;
- Q5, elite pitching;
- T1, which returns as a primary test with a fixed-window outcome that sidesteps the manager's hook, starter fixed effects, opener exclusion and a pre-computed power rule.

S2 becomes Q4.

## Changes from draft 1

Where review items conflicted, the review's recommended phase-1 scope was followed:
- V(c) and B are fit on 2023 only (M6). To keep 2023's development scores out of sample (B2), 2023 is scored with V and B cross-fitted by calendar half (orchestrator decision).
- The primary S2 pairs are the two within-season first-half → second-half pairs (M1). The full 2025 → 2026 pair is secondary.
- Reliability is computed on the runs-per-100-pitches rate (m4) and Spearman–Brown-corrected to 300 PA.
- T1(a) is kept as a positive control with starter outs as its outcome; T1(b), T2 and the runs-scored outcome move to Phase 2.
- Hit-and-run and take signs are disclosed, not excluded (m6).
- S1b has no pass rule in the review, so it is reported descriptively.

---

Specification lock: approved by Ian Taylor ("adapt to what I said and then go ahead with the protocol", October 23, 2026, 10:14 ET) and locked on October 23, 2026, before any pitch-level data was parsed. Raw Savant chunks had begun downloading but had not been opened beyond reading the CSV header for column names. The SHA-256 of this file as locked, with this line included, is in LOCK.json.
