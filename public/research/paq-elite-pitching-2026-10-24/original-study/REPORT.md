# Plate-appearance quality: is good process a skill, and does it pay?

> **Public copy.** The study's results report as of October 24, 2026, before the elite-pitching holdout test. That test failed: see `../holdout/RESULTS.md`. Q5's elite-pitching result below is therefore not confirmed. File references are to the research workspace.

Pre-registered study, October 2026. Protocol draft 4 locked October 23 (SHA-256 `9cc7e368…1ffd`), plus Amendment 1 (`5353b89f…ef7f`). All six seasons of Statcast pitch data, 2021–2026: 4.28 million pitches and 1.1 million plate appearances. Models were fit on 2021–2023, development tests used 2021, 2022 and 2024, and the test seasons are 2025 and 2026. An independent verifier recomputed the main numbers before this write-up (`VERIFY.md`).

## The short version

**Good process is a skill.** A hitter's decision quality, his ability to fight off tough two-strike pitches and his count work are as stable as anything else we measure at the plate. Half a season of decisions predicts the other half with a reliability of 0.84 at 300 PA. On the same test, wOBA manages 0.22–0.32.

**It doesn't buy much that the usual numbers don't already see.** By the standard set before we looked:
- Good process doesn't earn a hitter better pitches to hit later in the season.
- It doesn't predict better contact.
- It doesn't improve a rest-of-season wOBA forecast that already knows his strikeout rate, walk rate, swing rates and contact rates.

All three primary tests fail.

**The exception is elite pitching.** Hitters who make good decisions lose far less ground against the best pitchers than hitters who don't. The effect shows up in both test seasons and survives the multiple-testing correction. It is the study's one clean positive finding: discipline is worth more the better the pitcher.

**We couldn't test whether it wears out starters.** With the data available, that test was underpowered by the rule set in advance, so it is reported as an estimate. The estimate is uninformative.

## What PAQ measures

Every pitch is graded in runs against a reference hitter who sees the same pitch in the same count.
- **P1, decisions.** The value of swinging or taking versus what the league reference would do with that pitch: (a − p_ref) × (EV_swing − EV_take). It splits into a chase component and an in-zone component. Units are runs per 100 pitches.
- **P2, fight-off.** Results on difficult two-strike swings. "Difficult" is defined by the hardest third of two-strike pitches, with cutpoints fixed on 2021–2023.
- **P3, count work.** The hitter effect from a hitter-plus-pitcher fixed-effects model of pitches per PA.
- **PAQ** is decisions plus execution: P1 + E.

Contact quality is deliberately excluded. The question is whether process causes good outcomes, so outcomes can't be part of the measure.

How big are the differences? Among regulars, one standard deviation of P1 is about 0.32 runs per 100 pitches. At about 2,350 pitches a season, that's roughly **7.5 runs of decision value** per SD. Even after the protocol's shrinkage, the decision spread among everyday hitters is real money.

## Result 1: it's a skill (Q1)

Split-half reliability is computed on odd vs. even games for hitters with at least 300 PA, then projected to 300 PA. The skill bar was ≥ 0.5 with the CI excluding 0.3, in both seasons.

| measure | 2025 | 2026 | year-to-year r |
|---|---|---|---|
| P1 decisions | 0.84 | 0.84 | 0.69 |
| P1, chase part | 0.91 | 0.92 | 0.60 |
| P1, zone part | 0.82 | 0.88 | 0.43 |
| P2 fight-off | 0.78 | 0.82 | 0.64 |
| P3 count work | 0.78 | 0.77 | 0.80 |
| PAQ (P1 + E) | 0.87 | 0.85 | 0.56 |
| O-Swing% | 0.90 | 0.91 | 0.83 |
| K% | 0.86 | 0.84 | 0.86 |
| xwOBA | 0.65 | 0.51 | 0.61 |
| wOBA | 0.32 | 0.22 | 0.38 |

Every process measure clears the bar easily. P1's split-half reliability reaches 0.5 in about 55–60 PA, which is roughly two weeks. Two caveats keep this honest:
1. The measures are about as reliable as O-Swing% and K%, not more. Year to year, P1 (0.69) trails O-Swing% (0.83).
2. They aren't just O-Swing% in disguise. Residualized on O-Swing%, Z-Swing% and Contact%, P1 and P2 still have reliabilities of 0.59–0.70 (Q1b). That leftover part is the context the raw rates don't see: count, pitch value and what was at stake on each swing.

## Result 2: it doesn't buy better pitches, better contact or a better forecast (Q2–Q4)

Each test asks whether first-half process improves a second-half prediction for hitters with at least 150 PA in each half. A pass required a gain in **both** 2025 and 2026, after Holm correction across the three tests.

| test | 2025 gain | 2026 gain | verdict |
|---|---|---|---|
| Q2: better pitches to hit (swing hittability) | +0.9% [−2.3%, +4.1%] | +3.0% [+0.6%, +5.4%] | fails |
| Q3: better contact (xwOBAcon) | +0.15% [−0.9%, +1.2%] | +1.8% [+0.7%, +2.9%] | fails |
| Q4: future wOBA beyond standard stats | −0.17% [−0.7%, +0.3%] | +0.07% [−0.6%, +0.7%] | fails |

Gains are RMSE reductions against a baseline without process, with 95% bootstrap CIs.

**Q4** is the cleanest null. Once a forecast knows wOBA, xwOBA, K%, BB%, O- and Z-Swing% and O- and Z-Contact%, process adds nothing.

**Q2 and Q3** both show something in 2026 and nothing in 2025. Neither should be read as a replication:
- **Q2's 2026 signal is mostly an ABS artifact.** The swing models take each batter's strike-zone top and bottom as inputs. In 2026 those became the ABS height-based zone, about 0.24 ft shorter and nearly two SDs outside what the models were trained on. The verifier re-scored 2026 with each hitter's 2025 zone and no refit. Q2 then dropped to p = 0.059, and the decision coefficient flipped sign. Q2 failed regardless: its pre-registered condition that P1's coefficient be positive failed in both seasons.
- **Q3's 2026 gain survives that check.** It comes from count work (P3), which uses no model at all, so ABS doesn't explain it. But it is one significant result out of six season × test combinations, and it fails the both-seasons rule.

A descriptive aside from Q3 that's worth keeping: about a third of the between-hitter variance in xwOBAcon is **selection**, meaning the quality of the pitches a hitter chooses to put in play rather than how hard he hits them. Selection runs opposite to the contact-skill residual (r = −0.35 in 2025, −0.53 in 2026). Part of that is mechanical, because the residual is defined as xwOBAcon minus selection. It is still a hint that the hardest hitters can afford to be less choosy.

## Result 3: discipline pays more against elite pitching (Q5)

This was the key secondary test. Elite pitchers are the best 20% by prior-season swing hittability allowed, among pitchers with at least 300 pitches. The model:
- **Outcome:** each PA's run value minus a log5 expectation from the hitter and the pitcher.
- **Predictors:** the hitter's pre-game, shrunk P1, an elite-pitcher indicator, their interaction, the hitter's pre-game xwOBA × elite, handedness, times through the order, starter or reliever, and park.
- **Standard errors:** clustered by hitter and by pitcher.

- **P1 × elite: +0.0053 runs per PA per SD of pre-game decision skill**, 95% CI [+0.0028, +0.0077]. It is positive in 2025 (+0.0057) and in 2026 (+0.0043), and it clears Holm (p ≈ 0.00001). The fight-off (P2) version does not (+0.0008, CI spans 0).
- **What it looks like.** Against elite pitchers:
  - hitters in the bottom third of decision skill fall about **22 wOBA points** short of their log5 expectation;
  - hitters in the top third fall short by about **5**;
  - against everyone else, the two groups are within about 2–3 points of each other.
- **How much it's worth.** About 6.6 wOBA points per SD of decision skill in elite matchups. A regular gets roughly 95 such PAs a season, so that's about **0.5–1 run per season per SD**. It is real but small in a season total.

The finding is about who holds up in hard matchups. The obvious explanation is that elite stuff punishes bad swing decisions much harder. That matters most in the postseason, where nearly every PA is against good pitching. It's an inference to test next (on postseason PAs, or against top-decile arsenals), not a result.

## Result 4: wearing out starters is untestable with this data (T1)

The hypothesis: lineups with better decision and fight-off skill push starters' pitch counts up over the first 18 batters, and so get them out earlier.

- **Power check.** The pre-registered power check ran on 2022–2024 before any test season was scored. The minimum detectable effect was **0.065 pitches per batter faced, above the 0.05 limit**. Under the locked rule, T1 left the primary family and is reported as an estimate.
- **Estimate.** +0.015 pitches per BF per unit of lineup skill, 95% CI [−0.035, +0.065]. That is uninformative.
- **Why.** The design compares lineups within the same team-season, and that variation is mostly noise. A lineup's season-to-date pitches per PA barely predicts its actual pitches per PA against that day's starter (slope 0.25 instead of about 1). The verifier confirmed this. Even the positive control (lineup pitches per PA → starter outs) can't pass within team-season, though it passes easily without that restriction (−0.18 outs per SD, CI [−0.26, −0.09]).
- **One secondary number not to headline.** Lineup process skill → fewer starter outs (−0.46 per unit) reproduces. But it disappears without the team-season fixed effects and comes with no pitch-count effect. Treat it as exploratory.

The open question is real, and answering it needs a different design: between-team comparisons with explicit controls, or lineup-card variation such as rest days and platoons.

## Other pre-registered checks

- **S3, league vs. hitter-specific reference:** the hitter-specific reference does not do better.
- **S5, replicas of existing approaches:** a SEAGER-style measure and an alternative decision value are both reliable skills (0.75–0.78), and P1 is a little more reliable than either. Realized run value is not a skill.
- **Perceivability sensitivity:** decision rankings barely move when the reference is recomputed from where the pitch looked to be headed at the tunnel point, about 0.17 s before the plate (Spearman 0.98–0.99). Being fooled the same way the league is fooled isn't penalized.

## Caveats and what changed in verification

- **2026 is the first ABS season.** The frozen 2021–2023 models see a strike zone they weren't trained on. That inflates 2026 swing-side quantities and accounts for Q2's 2026 signal (see above). Q1 reliabilities barely move under the counterfactual zone.
- **Model drift.** The frozen swing model over-predicts swings by 1.2 pp in 2025 and 2.3 pp in 2026. League-average P1 is therefore slightly positive in the test seasons rather than zero. Q2–Q4 center within each half-season pair, Q1 is correlational, and the verifier found Q5 robust to it.
- **Run-time changes, logged in `code/DECISIONS.md`.** I sped up the boosting fit:
  - growth in 500-round chunks;
  - incremental validation scoring;
  - truncation at the best round instead of a refit;
  - checkpoints.

  These are tested and verified to select and produce exactly the same models as the original design. Three dtype crashes on the real Savant files were also fixed before the audit, with no change to any computed quantity.
- **The 2,000-round cap was hit.** The swing and swing-outcome models stopped there with validation loss still falling slightly, which the protocol allows. The take models stopped early at rounds 800–875.


## Files

- `results/results.json`, `results/results.md`: pipeline output.
- `results/VERIFY.md`: the independent verification.
- `results/hitter_process_2025_2026.csv`: hitter-season process measures.
- `code/`: the pipeline. `DECISIONS.md` has every implementation ruling.
- `PROTOCOL.md`, `AMENDMENT-1.md`, `LOCK.json`: the locked pre-registration.
- `audit.md`, `power.json`: data audit and the T1 power record.
- `verify/`: the verifier's independent scripts.
