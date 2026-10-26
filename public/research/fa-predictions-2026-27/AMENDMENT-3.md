# Amendment 3 to the 2026–27 free-agent predictions (October 26, 2026, before free agency opened)

This amendment replaces the scored predictions with `predictions_frozen.json` / `.csv` in this folder. Its hash and timestamp are in `LOCK-AMENDMENT-3.json`. The model settings are unchanged: trade model 2026-10-25.1, at $11M per WAR, a 20% star premium and a 50% reliever premium above 0.8 WAR. No signing or benchmark had been observed when it was made.

The first freeze priced Randy Arozarena at 1.6 projected WAR after a 5.5-WAR season, and Daulton Varsho at 2.5 after 0.8. That led to a check of the inputs, which found three errors (items 1–3). Two calibrations, items 4 and 5, were added at the same time.

## 1. Projections updated for the 2026 season (input error)

**The error.** The 2027–28 projections in the October 18 database were spring 2026 ZiPS. The site's in-season adjustment compares rest-of-season projections with preseason ones, and it fell to zero once the season ended and those projections expired. So the 2026 season was not reflected at all.

**The fix.** For every player with at least 100 PA or 20 IP in 2026, the 2027 WAR rate is now:

> rate = M_fresh + k × (Z − M_stale)

- **M_fresh** is a regressed, age-adjusted three-season WAR rate through 2026 (5/4/3 weights; 1,200 PA or 300 IP of league-average ballast).
- **M_stale** is the same rate computed through 2025.
- **Z** is the ZiPS 2027 rate.
- **k** is 0.575 for hitters and 0.628 for pitchers. It was fit on 2026: it is the share of ZiPS's preseason disagreement with the same Marcel-style rate that showed up in 2026 rates, with a bootstrap 95% CI of [0.26, 0.85] for hitters and [0.30, 1.01] for pitchers. A low-history subset gave 0.58 for hitters and 0.21 for pitchers, the pitcher figure noisy.

**How it's applied.**
- The rate is applied at ZiPS's playing time.
- The 2027 change carries into later seasons at 0.85 per year, the site's existing decay.
- Players below the 2026 threshold keep spring ZiPS. They get a flag (Hunter Harvey and Gavin Lux).
- The 50 players in FanGraphs' 2026 Trade Value Series keep their mid-season ZiPS, as before.

**Site database.** The same update is now in the site's database, so the tools and these predictions use identical projections.

## 2. Pitcher roles from 2026 usage (input error)

**The error.** Roles came from preseason depth charts.

**The fix.** A pitcher with at least 10 starts and starts in at least half his games is now a starter. One who started in under 20% of his games, with at least 20 IP, is a reliever.

**Effect.** Dustin May (31 starts) and Foster Griffin (31 starts) are now starters, so the reliever premium no longer applies to them. 31 pitchers' roles changed in all.

## 3. Opt-out and player-option rule (logic error)

**The error.** The protocol compared the predicted new contract's total, over its own term, with the money left on the old deal, which usually covers fewer years.

**The fix.** A player now opts out, or declines a player option, only if his market value over the years left on his deal exceeds the money left.

**Effect.**
- Bo Bichette, with $84M left over two years and about $50M of market value, is now expected to stay.
- Luis Severino stays on his $22M player option.
- Club options and mutual options are unchanged.

## 4. NPB translation fit on past signings (calibration)

**The change.** The protocol's translation factor of 0.25 was a fixed rule. It is replaced by a fit on the six Japanese hitters who moved to MLB since 2020: Tsutsugo, Akiyama, Suzuki, Yoshida, Murakami and Okamoto. The fit compares their 3:2:1-weighted NPB wRC+ with their PA-weighted wRC+ over their first two MLB seasons, using FanGraphs NPB data.

**The factor.** The PA-weighted least-squares factor is 0.17. On the four moves since 2022 it is 0.22. At 0.17, those four signed for 0.92× the model.

**Sato.** His 181 translates to 114 wRC+ and 2.5 WAR. The protocol's ad hoc strikeout deduction is dropped, because the fit includes high-strikeout hitters.

## 5. Half credit for fielding runs in contract prices (calibration)

**The finding.** The data were 223 hitter free-agent deals from 2020–26 (three-year WAR ≥ 1), controlling for WAR and signing year.
- Each extra win of fielding value per 600 PA came with log(actual/model) of −0.42 (95% CI −0.57 to −0.29).
- The positional adjustment came out at −0.05, with a CI spanning zero.
- The best-fitting fielding credit for non-catchers was 0.4–0.5. For catchers, full credit fit best.

**The change.** These contract predictions subtract half of each non-catcher hitter's projected fielding wins from 2027–28 WAR. The projected fielding wins are 5/4/3-weighted fielding runs per PA, times ZiPS PA, divided by 10.

**Scope.** This applies to the free-agent predictions only. The site's trade model is unchanged.

## Unchanged

The price rule, term rule, club- and mutual-option rules, the list rule, the scoring rules, the benchmarks and the other inputs are unchanged, apart from a tie-break clarification: "alphabetically" means by surname.

The scripts are in `amendment-3/`. They need the FanGraphs leaderboards for 2015–26 and FanGraphs' 2026 preseason ZiPS, which are not redistributed.
