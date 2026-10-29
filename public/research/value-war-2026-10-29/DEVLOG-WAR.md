# DV WAR development log

The protocol was locked on 2026-10-29 at 14:19Z. Amendment 1 (adding T7, roster churn) was locked at 14:32Z.

## 2026-10-29: pipeline

**Data.** Statcast pitch data comes from Savant one day at a time. Run values are computed within each season:

| Event | Run value |
|---|---|
| 1B | .44 |
| 2B | .74 |
| 3B | 1.03 |
| HR | 1.38 |
| BB | .31 |
| K | −.26 |
| Out | −.26 |

(2015 values. Linear weights are the mean RE24 by event; the league plate appearance is centered at 0.)

**Event models.** Both are LightGBM, cross-fitted in 4 folds on exactly the games being measured.
- Expected run value of a ball in play: exit velocity, launch angle, spray, sprint speed, batter side, park and batted-ball type.
- Called-strike probability: location, normalized height in the zone, count, batter and pitcher handedness, and zone size.

**Fielding.** The responsible fielder is:
- the Statcast hit location;
- for ground balls that reach the outfield, the infielder by spray zone (third-base side to first: −22°, 0°, +22°);
- for air balls with no recorded fielder, the outfielder by spray.

**Fielding check, 2016 full season.**
- My raw fielding residual correlates 0.36 with Savant fielding run value (non-catching), with SD 10.9 runs against Savant's 5.5.
- The gap comes from position-level bias in responsibility (1B −4.8 per 1,000 outs, 2B +6.2, SS +4.3).
- Fix: center credit within position (credit minus outs played × position-average rate).
- After the fix: correlation 0.55, SD 6.4 against 5.5. That is weaker than OAA, which uses fielder starting positions that public pitch data lacks. The same fielding model is used in all three rebuilt frameworks, so this doesn't favor any one of them.

**2015 accounting sanity check, one half.**
- Batting linear weights against the same half's runs scored: r = .87, or .97 with RE24 context.
- Park adjustment lowers same-half accounting, as expected.

## First look at T1 (2016, splits 0–2)

| System | T1 transfer RD | Offense | Defense | Same-half accounting RD |
|---|---|---|---|---|
| FIP-style | .656 | .271 | .550 | .898 |
| RA9-style | .689 | .271 | .643 | .951 |
| DV, default weights (λ_b 1, κ 1, λ_p 0, λ_f 1, γ_c 1) | .664 | .271 | .606 | .918 |
| DV, λ_b 0 | .692 | .283 | .606 | .898 |

RA9 beating FIP on within-season defense transfer led to Amendment 1. Within a season, players stay with their teams, so team-environment credit transfers too.

## 2026-10-29: parameterization change, before any tuning

The pitcher's ball-in-play credit is split into non-home-run and home-run parts, with separate weights (κ and λ_p for non-HR balls in play, κ_hr and λ_hr for home runs). Non-HR balls are centered on the non-HR mean, so DV with κ = λ_p = 0 and κ_hr = λ_hr = 1 reproduces FIP-style exactly (max difference 7e-15). With κ = λ_p = κ_hr = λ_hr = σ_p = 1, DV equals RA9-style without the team-fielding adjustment (difference 1e-14). Components were recomputed for 2016 with the HR fields added.

**T1 on 2016, all 10 splits.** Run differential correlations:
- FIP-style .627
- RA9-style .643
- DV with FIP settings .627; with λ_b .25, .663

Defense correlation rises with the pitcher's contact-quality weight κ: .533 at 0, .556 at .25, .573 at .5, .595 at 1.

## 2026-10-29: development tuning (`tune.py`, `tune_dev.json`)

**Method.** Coordinate descent over the grid, with the objective set to the mean of T1 and T7 run-differential correlations on development data:
- T1: 2016–19 and 2021, 10 splits × 2 directions.
- T7: 16→17, 17→18, 18→19 and 19→21.

**Best weights:**

| Weight | Value | Meaning |
|---|---|---|
| λ_b | 0.5 | Batter gets contact quality plus half the post-contact outcome |
| σ_b | 0 | No batter sequencing credit |
| κ | 1 | Pitcher gets full contact quality on non-HR balls in play |
| λ_p | 0 | No pitcher credit for non-HR ball-in-play luck |
| κ_hr | 0.5 | Pitcher gets half the contact quality on home runs |
| λ_hr | 1 | Pitcher gets the full HR residual |
| σ_p | 0.5 | Pitcher gets half the sequencing credit |
| γ_p | 0 | No framing removed from pitchers |
| λ_f | 0.5 | Fielders get half their measured runs (the defense study found 0.48 persistence for fielding) |
| γ_c | 1 | Catchers get full framing credit |

**Development scores:**

| System | T1 | T7 |
|---|---|---|
| FIP-style | .7203 | .3752 |
| RA9-style | .7252 | .3678 |
| DV tuned | .7355 | .4236 |

**By year.** DV is at or above both in every development year except 2018 T1 (FIP .764, DV .761):

| Year | FIP-style | RA9-style | DV |
|---|---|---|---|
| T1 2016 | .627 | .643 | .644 |
| T1 2017 | .673 | .656 | .679 |
| T1 2018 | .764 | .757 | .761 |
| T1 2019 | .785 | .790 | .806 |
| T1 2021 | .730 | .753 | .756 |
| T7 16→17 | .229 | .241 | .241 |
| T7 17→18 | .392 | .377 | .411 |
| T7 18→19 | .140 | .280 | .297 |
| T7 19→21 | .576 | .494 | .599 |

**One-at-a-time sensitivity** (four development years, before the full tune):
- T1 prefers a low λ_b, while T7 prefers λ_b = 1.
- T7 prefers κ_hr = 0.
- Sequencing weights help T7 only at 0.5.

**Speed.** The slowness was LightGBM thread oversubscription (two processes on two cores). Setting n_jobs=1 brings one half-season down to about 15 seconds. Development components were computed with default threads; holdout components use n_jobs=1. Only floating-point summation order differs.

## 2026-10-29: fixes to season-level code after the v1 lock, before any holdout result

These changes touch only the secondary-test code. `attrib.py`, `split.py`, `season.py` and the weights, which are what T1 and T7 use, are unchanged.

1. **`dvwar.py`.** The DV-minus-FIP attribution difference is now centered to zero per PA (hitters) and per batter faced (pitchers) within each season.
   - Without centering, the unassigned half of home-run contact value (κ_hr = 0.5) lifted league pitcher DV WAR to about 540 instead of fWAR's 430.
   - After centering, totals are 570 for hitters and 434–436 for pitchers.
2. **`eval_season.py`.** The win and game columns are renamed so they don't collide when merged.

**Rebuild check.** My RA9-style minus FIP-style pitcher runs correlate .82 (2017) and .81 (2019) with FanGraphs' published RA9-WAR minus WAR, for pitchers with at least 40 IP.

**Season-level development results** (pairs 16→17, 17→18, 18→19, 19→21; exploratory). "Rebuilt" columns are built from Statcast; "published" columns are FanGraphs' numbers, with DV WAR as published fWAR plus the DV attribution differences.

| Test | Rebuilt FIP | Rebuilt RA9 | Rebuilt DV | Published fWAR | Published RA9-WAR | DV WAR |
|---|---|---|---|---|---|---|
| T7, change in run differential | .375 | .368 | .424 | .474 | .449 | .491 |
| T3, next-season wins | .603 | .562 | .627 | .693 | .667 | .679 |
| T4, same-season wins | .908 | .932 | .915 | .906 | .931 | .897 |

**T6, year-to-year stability:**

| Group | fWAR | RA9-WAR | DV WAR |
|---|---|---|---|
| Hitters (n=784) | .471 | .471 | .518 |
| Pitchers (n=655) | .390 | .256 | .395 |

## 2026-10-29: holdout results, v1 (`holdout_results_v1.json`)

Run once, with the locked weights. Primary results:

**T1, split-season transfer** (150 team-seasons, 2022–26). Run differential correlation:
- FIP-style .6782
- RA9-style .6775
- DV .6965

DV minus FIP-style: [.001, .037]. DV minus RA9-style: [.009, .030]. Both intervals exclude zero, so the **T1 win rule is met**. Offense and defense correlations are each higher too.

**T7, roster churn** (150 team-pairs, 2021→22 through 2025→26):
- Rebuilt: FIP-style .590, RA9-style .534, DV .576.
- Published: fWAR .609, RA9-WAR .561, DV WAR .569.
- The **T7 win rule is not met**.
- Note that DV's offense (.441 against .424) and defense (.487 against .471) correlations are both higher than FIP-style's, yet its combined run differential correlation is lower. DV's pitcher credit (full contact quality) varies more than its signal supports, so it gets too much weight once offense and defense are added together.

**Secondary tests:**
- **T3, season transfer, wins.** fWAR .739 > DV WAR .720 > rebuilt FIP .717 > RA9-WAR .702.
- **T4, same-season accounting.** RA9 frameworks are best, as expected.
- **T5, pay:**

  | Group | n | DV WAR | fWAR | RA9-WAR | Result |
  |---|---|---|---|---|---|
  | All | 746 | .687 | .673 | .658 | DV beats RA9-WAR; against fWAR the interval is [−.002, .030] |
  | Hitters | 303 | .750 | .721 | — | DV beats fWAR, interval [.012, .048] |
  | Pitchers | 443 | .661 | .668 | .626 | — |

- **T6, stability.** Hitters: DV .532 against fWAR .473. Pitchers: DV .387, fWAR .447, RA9 .237.

**Exploratory, after seeing the holdout (not a claim).** DV hitters with FIP-style pitchers scores T1 .691 and T7 .611 (offense .441, defense .503). This is the hypothesis for v2, which needs a fresh test such as the 2027 season.

## 2026-10-29: correction to the win target (T3 and T4 only)

Team wins rebuilt from Statcast run totals were wrong. Statcast misses about 1.6% of runs (team run-differential correlation with official is .999), but the missing runs flip close games: the 2023 Angels came out 68–94 instead of 73–89. T3 and T4 win targets now use the official MLB statsapi standings. Run-based results are identical. The corrected win results:

| Test | fWAR | DV WAR | Rebuilt FIP | RA9-WAR | Rebuilt DV |
|---|---|---|---|---|---|
| T3, next-season wins | .729 | .711 | .702 | .693 | .688 |
| T4, same-season wins | .928 | .919 | — | .940 | — |
