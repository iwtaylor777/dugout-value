import Link from "next/link";
import type { Article } from "./types";
import { AUTHOR } from "./types";

const FIG = "/analysis/our-projections-replace-zips";
const FILES = "/research/dv-projections-2026-10-29";

export const article: Article = {
  slug: "our-projections-replace-zips",
  category: "Research",
  title: "Introducing DV Projections: how they compare with ZiPS and Steamer",
  summary: "We created a projection system for Dugout Value. Its original one-year benchmark was competitive on hitter wOBA and better than ZiPS on pitcher FIP. Playing time and long-range trade values require separate evidence.",
  author: AUTHOR,
  published: "2026-10-29",
  dateLabel: "October 29, 2026",
  readTime: "9 min read",
  relatedTool: { href: "/tools/projections", label: "See the projections" },
  evidence: {
    href: `${FILES}.tar.gz`,
    label: "Protocols, locks, results and code (download)",
  },
  body: (
    <>
      <p className="article-lead">We created a projection system for Dugout Value so we can update forecasts from public player data. In our original retrospective benchmark, DV had similar hitter wOBA errors to ZiPS and Steamer and lower pitcher FIP error than ZiPS. The tools now use DV by default, with ZiPS available in the Projections menu. That benchmark tests performance per opportunity; it does not establish that our playing-time forecasts or trade values are more accurate.</p>

      <h2>What we compared</h2>
      <p>We compared next-season forecasts with archived preseason ZiPS and Steamer projections from FanGraphs, on the same players in each season. Hitters needed 100 MLB PA and pitchers 20 IP in the preceding three seasons. To score rates, we then required 200 PA or 40 IP in the season being predicted. Players who missed those thresholds, including players who were injured or lost their jobs, are outside this rate test.</p>
      <p>We developed the model recipe on 2023–24, recorded its code hashes, then evaluated it on 2025–26. Each forecast trained on earlier seasons: the 2025 forecast used outcomes through 2024, and the 2026 forecast could use 2025. The recipe was fixed before this evaluation, but these seasons had appeared in other Dugout Value studies. This is a retrospective rolling-origin benchmark, not two seasons that were entirely unknown to us.</p>
      <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Holdout results">
        <table>
          <caption>Original v1 benchmark, 2025–26 pooled: weighted RMSE (lower is better)</caption>
          <thead>
            <tr><th scope="col">Measure</th><th scope="col">Dugout Value</th><th scope="col">ZiPS</th><th scope="col">Steamer</th></tr>
          </thead>
          <tbody>
            <tr><td>Hitters, wOBA — primary (624 player-seasons)</td><td>.0287</td><td>.0288</td><td>.0288</td></tr>
            <tr><td>Hitters, WAR per 600 PA</td><td>1.63</td><td>1.72</td><td>1.63</td></tr>
            <tr><td>Pitchers, FIP — primary (685 player-seasons)</td><td>.727</td><td>.763</td><td>.731</td></tr>
            <tr><td>Pitchers, ERA</td><td>1.027</td><td>1.070</td><td>1.012</td></tr>
            <tr><td>Pitchers, WAR per 180 IP</td><td>1.57</td><td>1.66</td><td>1.70</td></tr>
          </tbody>
        </table>
      </div>
      <p>RMSE means root mean squared error: it gives extra weight to large misses. We weight hitters by actual PA and pitchers by actual IP, so regular players count more. These are rate errors, not full-season WAR errors. A player appearing in both seasons counts twice.</p>
      <p>On hitter wOBA, the differences are too small to separate the systems. DV minus ZiPS has a paired bootstrap 95% interval of −.0010 to +.0008; DV minus Steamer, −.0011 to +.0008. For pitcher FIP, DV’s error is 4.6% lower than ZiPS’s, with a difference interval of −.058 to −.012. Against Steamer, the interval is −.029 to +.020, so there is no clear separation. Steamer had lower pitcher FIP error in 2025 alone; DV had lower error in 2026. The intervals resample player-seasons and do not capture variation across many possible seasons.</p>
      <p>Our original rule for making DV the default required lower pooled primary error than both systems, with limits on losses in either year. DV passed that point-estimate rule; it did not require statistical significance. Passing it is different from demonstrating superiority. Hitter strikeout-rate error was higher than ZiPS’s, and Steamer’s pooled ERA error was lower than ours.</p>

      <h2>How we created the forecasts</h2>
      <p>Hitters get five MLB seasons of results and underlying measures: expected wOBA, exit velocity, barrels, hard-hit rate, launch angle, plate discipline, batted-ball mix, speed, age and position. They also get up to three seasons of minor-league statistics at AAA, AA and Class A, compared with their level’s averages. Pitchers get three MLB seasons, including strikeout, walk and home-run rates, velocity, contact allowed, called strikes plus whiffs, pitch-quality grades and starter usage.</p>
      <p>Most hitter performance inputs are relative to that season’s league average. For pitchers, selected run estimators are league-relative; many other inputs keep their original scales. The models learn targets relative to their season’s league average, then add a forecast baseline: the preceding three seasons’ average. That reduces the effect of a changing run environment without assuming we know next season’s league average.</p>
      <p>Small samples get several treatments. Our Marcel baseline uses fixed recent-season weights and regression. DV’s hitter model sees individual seasons and recency-weighted aggregates with three regression strengths, equivalent to adding 60, 250 or 1,000 PA of league-average performance to the weighted sample. It learns which representation is useful for each prediction. Pitchers get individual seasons and an innings-weighted 3–2–1 aggregate. These choices describe our models, not the internal methods of ZiPS or Steamer.</p>
      <p>For each target, we average two models equally: gradient-boosted trees, which learn nonlinear relationships and interactions, and ridge regression, which constrains the fitted relationships. Hitter wOBA, strikeout rate, walk rate and isolated power are predicted separately. Pitcher FIP averages a direct forecast with one built from separately projected strikeouts, walks plus hit batters, and home runs per inning.</p>
      <p>WAR rate has its own model, trained to predict FanGraphs WAR per 600 PA or 180 IP. It is not assembled from the other projected statistics and is separate from our <Link href="/analysis/a-statcast-war">Statcast-based WAR research</Link>. Expected playing time is another prediction, including zero-workload seasons in its training sample.</p>

      <h2>The original benchmark and the version in the tools</h2>
      <p>
        The table above reports the original locked v1 model. Version 1.1 added historical fielding, baserunning and positional runs to the hitter WAR-rate model. Putting the forecasts on the site exposed a problem the original benchmark had averaged over. The model that projects a hitter’s WAR rate only saw offensive statistics, so its incomplete position indicators could not adequately distinguish players with different fielding value. In the top fifth of hitters by prior-year fielding, it projected about half a win per 600 plate appearances too low. Adding each player’s fielding, baserunning and positional runs as inputs removed that bias and lowered the error in all four seasons we tested, to 1.54 in 2025 and 1.64 in 2026, against 1.66 and 1.80 for ZiPS. We chose the fix on 2023–24 data. The 2025–26 numbers reuse seasons the first version had already been scored on, so they are a reused comparison rather than a fresh holdout.
      </p>

      <h2>Long-range forecasts: a correction and a separate test</h2>
      <p><strong>Correction, October 29:</strong> the original long-range backtest restricted player inputs to the forecast date but allowed later outcomes into training. That gave horizon models information their aging-curve comparison did not have. We reran the tests with all training outcomes restricted to the forecast date. The original results and code are preserved as superseded files, with correction rules and replacement results in the research download.</p>
      <p>For contract years two through five, the tools blend a separate horizon model (70%) with the one-year rate extended by an age-based curve (30%). We keep the first-year rate and fit a straight-line rate trend through the later estimates. Workload declines separately by role and age. The displayed path therefore includes predictions and choices about blending, smoothing and playing time.</p>
      <p>In the corrected 2024–26 tests, separate horizon models had lower error than a one-year forecast plus the historical aging curve in 16 of 17 comparisons, rather than all 17 as originally reported. The existing 70/30 blend had lower error in all 17; its paired 95% difference interval excluded zero in 12. We kept the original settings and did not retune them. These are reused retrospective samples. At the longest hitter horizon there is only one eligible training-outcome season in the 2026 test, so the evidence is limited. The chart reports rate errors before final smoothing and workload assumptions.</p>
      <figure className="article-figure"><img src={`${FIG}/aging-backtest-corrected.png`} width={1600} height={720} loading="lazy" alt="Corrected retrospective WAR-rate errors for horizon models and a 70/30 blend compared with a one-year forecast extended by an aging curve. All training outcomes stop at the forecast date."/><figcaption>Playing-time-weighted WAR-rate RMSE, averaged over available target seasons at each distance. Hitters need 200 PA; pitchers need 40 IP. These corrected, reused samples test rates among players who reached those workloads, not survival, season totals, or the complete smoothed trade-value path.</figcaption></figure>
      <p>We do not have archived multi-year ZiPS forecasts for a direct comparison. The tools often bring a young star’s distant seasons closer to average than the site’s ZiPS path does, lowering surplus value even when next-year WAR is similar. That is a consequence of the chosen path, not evidence by itself that the trade value is more accurate.</p>

      <h2>Playing time and the price of a win</h2>
      <p>The site converts rate to WAR using the larger of expected playing time mapped onto ZiPS’s workload scale by percentile and the player’s healthy workload: the average of his two largest totals in 2024–26, capped at 700 PA or 200 IP. Later years apply workload retention by role and age. For example, 6.1 WAR per 600 PA over 698 PA means 6.1 × 698 ÷ 600 = 7.1 WAR.</p>
      <p>The workload floor can keep a recent injury from reducing a player’s valuation workload. It is a choice for pricing a full season, not a calibrated claim that he will stay healthy. The rate benchmark above does not validate it.</p>
      <p>The old price refit shared the horizon-training error and also applied a 2026 workload mapping to earlier signings. We rebuilt each mapping from that season’s archived preseason ZiPS workload and restricted the check to 2023–26, dropping 2021–22 because matching archives were unavailable. Among 192 non-reliever contracts with projected first-year WAR of at least one and annual pay of at least $2 million in 2026 dollars, the best fit at the existing 20% star premium is $11.75 million per win, replacing the earlier $10.5 million estimate on 304 contracts. Keeping $11 million raises mean squared log-price error from .3251 to .3290, about 1.2%, so we retain the existing price rather than retune it on this check. This is a descriptive retrospective fit; projection snapshots can postdate signings. In the matched 2026 subset, FanGraphs-based paths still fit pay better than DV paths. Agreement with salaries does not establish better player valuations.</p>

      <h2>What the other checks tell us</h2>
      <p>The original team-level tests did not clearly separate DV from ZiPS or Steamer. Across 90 team-seasons in 2024–26, projected team WAR correlated .743 with wins for DV, .709 for ZiPS and .740 for Steamer. The previous-season baseline had the highest point estimate, .777. All those correlation-difference intervals against DV included zero. These tests applied forecast rates to actual workloads, so they were not preseason forecasts of rosters or playing time.</p>
      <p>An exploratory player-level check added afterward compared projected wOBA with actual base-out run value per PA. Across 952 hitter-seasons in 2024–26, correlations were .553 for DV, .524 for ZiPS and .538 for Steamer; the DV–ZiPS difference interval was .005 to .053. This is a useful additional outcome, but it shares underlying baseball events with wOBA. It is not an independent proof of trade value.</p>
      <p>In the original pay check, every system’s WAR rate used the same archived Steamer workload. Among 187 pitcher signings in 2024–26, correlation with season-demeaned log annual salary was .728 for DV and .687 for ZiPS, with a difference interval of .004 to .081. Hitter differences were inconclusive. This measures agreement with market pay, not whether a contract or trade was good. Preseason snapshots may also postdate a signing.</p>

      <h2>What changes on the site</h2>
      <ul>
        <li>The trade builder, finder, rankings and projections all use Dugout Value projections by default. A Projections menu on each one switches back to ZiPS, and shared trade links remember the choice. Links saved before today still open with ZiPS.</li>
        <li>The projections table shows each player’s rate and playing time behind every number, for example 6.1 WAR per 600 PA × 698 ÷ 600 = 7.1 WAR.</li>
        <li>Players without 100 PA or 20 innings in 2024–26, including prospects and international signings, still use ZiPS. So do any seasons you edit by hand.</li>
        <li>The correction changes our historical evaluation and price-check estimate. Rebuilding the current projection file from its existing inputs reproduced all 1,245 player records without changes; the displayed projections and trade-value settings remain the same.</li>
        <li>This winter’s frozen <Link href="/analysis/what-this-winters-free-agents-should-cost">free-agent predictions</Link> were made with ZiPS and stay as they were.</li>
      </ul>
      <p>
        The clean test is still ahead. We plan to freeze these projections before 2027 and score them against ZiPS and Steamer after the season, along with the version of <Link href="/analysis/a-statcast-war">our WAR</Link> that comes out of the current round of work.
      </p>

      <h2>Methods in brief</h2>
      <ul>
        <li><strong>Data:</strong> FanGraphs season leaderboards for 2010–26 and MLB Stats API minor-league statistics for 2013–26. Historical inputs were retrieved retrospectively and may contain provider revisions. ZiPS and Steamer come from archived preseason FanGraphs pages for 2023–26; Steamer pitchers for 2023 have no archive.</li>
        <li><strong>Scored players:</strong> hitters with 100+ PA and pitchers with 20+ IP in the prior three seasons, judged on seasons with 200+ PA or 40+ IP, weighted by playing time, and limited to players every system projected.</li>
        <li><strong>Locks:</strong> the protocol was locked October 27, 2026 at 23:50 UTC and model v1 at 00:08 UTC the next day, before the holdout was scored. The validation protocol was locked at 00:18 UTC and its amendment at 00:25 UTC.</li>
        <li><strong>Site version:</strong> v1.1, which adds fielding, baserunning and positional inputs to the hitter WAR-rate model, and horizon models for two to five years ahead blended 70/30 with the one-year projection plus a standard aging curve, then smoothed to a straight-line trend for each player.</li>
        <li><strong>Correction:</strong> the <a href={`${FILES}/AMENDMENT-TIMING.md`}>forecast-origin amendment</a>, corrected aggregate results, input checksums, software versions and regression checks are included. We did not retune hyperparameters or blend weights on the corrected results.</li>
        <li><strong>Files:</strong> protocols, locks, aggregate results, the current site-building code and replay instructions are in <a href={`${FILES}.tar.gz`}>the research files</a>. FanGraphs data and per-player results built from it aren’t redistributed.</li>
      </ul>
    </>
  ),
};
