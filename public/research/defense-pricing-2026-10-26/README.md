# Teams pay less for defense: analysis files (October 26, 2026)

These are the scripts and printed results behind https://dugoutvalue.com/analysis/teams-pay-less-for-defense. The analysis is exploratory and was not pre-registered.

- `outputs.txt`: every number quoted in the article, as the scripts printed it.
- `reliab.py`: the year-to-year correlation and the three-year persistence of each WAR component (batting, baserunning, fielding and positional), plus the aging deltas. It covers non-catchers from 2015 to 2026.
- `predictive.py`: future three-season WAR, and future plate appearances, on the previous three seasons' offense, fielding and positional runs per 600 PA, with a bootstrap of the fielding-to-offense ratio.
- `team.py`: runs allowed on FIP-based runs and team fielding runs, and runs scored on batting and baserunning runs, for 2015–25 excluding 2020, with a bootstrap of the conversion ratio.
- `theta_boot.mjs` and `theta2d.mjs`: the fielding credit that best fits 2020–26 free-agent contracts under the Dugout Value trade model (2026-10-25.1), after removing each signing year's mean. The second script also lets the credit for offense vary.
- `proj_theta.mjs`: the same fit for the 2026 class, priced on FanGraphs' projections at signing.
- `retest.mjs`, `market_weights2.py`, `projcheck.py`, `defense.mjs` and `defense2.mjs`: secondary checks. They cover component-weighted predictions, log-linear market weights, 2026 projections against actuals, and the earlier contract test. `defense2.mjs` does not remove signing-year means, which is why it pointed to a lower credit (0.4–0.5).

The scripts read FanGraphs leaderboards (`fg_bat_YYYY.json`, team totals and 2026 preseason projections) and the FanGraphs free-agent tracker. None of these are redistributed. The model code is in the site's public repository.
