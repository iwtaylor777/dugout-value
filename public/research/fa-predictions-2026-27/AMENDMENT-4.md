# Amendment 4 to the 2026–27 free-agent predictions (October 26, 2026, before free agency opened)

This amendment removes item 5 of Amendment 3, the half credit for non-catcher hitters' projected fielding runs. Everything else in Amendment 3 stands:

- the 2026 season update to projections;
- pitcher roles from 2026 usage;
- the opt-out rule on the remaining years;
- the NPB translation.

The scored predictions are now `predictions_frozen.json` / `.csv` in this folder. Their hash and timestamp are in `LOCK-AMENDMENT-4.json`. No signing or benchmark had been observed when this amendment was made.

## Why

Amendment 3's fielding credit (0.4–0.5) came from comparing contracts with the model applied to raw three-year WAR, fit without removing each signing year's price level. A lower credit also lowered the model's overall price, and the model was already above these contracts on average, so the fit favored a low credit partly for that reason.

With signing-year means removed, the market credits a run of fielding at 0.65 of a run of offense, with a bootstrap 95% interval of 0.29 to 0.83 (195 non-catcher contracts, 2020–26). A past fielding run predicts 0.72 as much future three-season WAR as a past offense run (0.52 to 0.91). The discount in contracts therefore matches fielding's weaker persistence.

The predictions price projected WAR, and projections already regress fielding. Applying an extra discount on top double-counts. The 2026 class, priced on FanGraphs' projections at signing (27 non-catcher hitters), shows no extra fielding discount. The analysis is at https://dugoutvalue.com/analysis/teams-pay-less-for-defense, and its scripts are in `/research/defense-pricing-2026-10-26`.

## Effect

The same scripts as Amendment 3 were run on the site's database, with no fielding adjustment.

| Player | Amendment 3 | Amendment 4 |
|---|---|---|
| Jazz Chisholm Jr. | $83.4M | $97.7M |
| Seiya Suzuki | $59.8M | $68.6M |
| Daulton Varsho | $24.2M | $28.8M |
| Ian Happ | 2 years, $23.2M | 3 years, $37.0M |
| Randy Arozarena | $84.2M | $74.2M |
| Trent Grisham | $65.1M | $52.0M |
| Gleyber Torres | 3 years, $43.6M | 2 years, $27.7M |

J.P. Crawford, Gavin Lux and Jake Bauers drop below the cutoff. Patrick Sandoval, Brady Singer and Tyler Stephenson enter, tied at $19.6M. The Lux flag goes with him. All other flags and exclusions are unchanged.
