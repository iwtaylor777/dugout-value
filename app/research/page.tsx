import type { Metadata } from "next";
import Link from "next/link";
import scores from "../../public/research/2026-forecast-results/forecast_scores.json";
import snapshot from "../../public/research/snapshots/2026-10-17/manifest.json";
import { Publication } from "../site-shell";
import { breadcrumbJsonLd, datasetJsonLd, pageMetadata, webPageJsonLd } from "../seo";
import { JsonLd } from "../json-ld";

export const metadata: Metadata = pageMetadata({ title: "Research files and forecast results", description: "Download data and code for historical projection tests, frozen forecasts, and the dated trade-model archive.", path: "/research" });

/** Each downloadable research bundle, described as a schema.org Dataset so data search can find it. */
const datasets = [
  datasetJsonLd({ name: "Dugout Value projections: holdout, validation and site build, 2023–26", description: "Historical rate and whole-season WAR comparisons against ZiPS and Steamer, independent measurement replay, model code and multi-year backtests.", path: "/research#dv-projections", datePublished: "2026-10-29", files: [{ url: "/research/dv-projections-2026-10-29.tar.gz", format: "application/gzip" }, { url: "/research/dv-projections-2026-10-29/eval_holdout-v1.json", format: "application/json" }] }),
  datasetJsonLd({ name: "Dugout Value WAR v1 validation, 2016–26", description: "Pre-registered protocol, amendment, locks, code and holdout results for a test of whether a Statcast-built WAR explains team run differential in games it was not measured in better than the FIP-based and runs-allowed methods.", path: "/research#value-war", datePublished: "2026-10-29", files: [{ url: "/research/value-war-2026-10-29.tar.gz", format: "application/gzip" }, { url: "/research/value-war-2026-10-29/holdout_results_v1.json", format: "application/json" }] }),
  datasetJsonLd({ name: "How free agency prices defense, 2020–26", description: "Scripts and printed results for an exploratory analysis of how free-agent contracts, future WAR and team runs allowed treat a run of fielding relative to a run of offense.", path: "/research#defense-pricing", datePublished: "2026-10-26", files: [{ url: "/research/defense-pricing-2026-10-26.tar.gz", format: "application/gzip" }, { url: "/research/defense-pricing-2026-10-26/outputs.txt", format: "text/plain" }] }),
  datasetJsonLd({ name: "Free-agent contract predictions, 2026–27 offseason", description: "Contract estimates recorded October 29 from current DV projections for the top 30 modeled MLB free agents plus Teruaki Sato, with dated inputs, source code and scoring rules.", path: "/research#fa-predictions-2027", datePublished: "2026-10-25", files: [{ url: "/research/fa-predictions-2026-27.tar.gz", format: "application/gzip" }, { url: "/research/fa-predictions-2026-27/predictions_frozen.csv", format: "text/csv" }] }),
  datasetJsonLd({ name: "Decision skill against elite pitching: pre-registered study, exploratory follow-up and holdout test", description: "Protocols with checksums, results, chart data and independent verifications for a test of whether hitters' swing-decision skill pays more against elite pitchers (2021–26 regular seasons and postseasons).", path: "/research#paq-elite-pitching", datePublished: "2026-10-24", files: [{ url: "/research/paq-elite-pitching-2026-10-24.tar.gz", format: "application/gzip" }, { url: "/research/paq-elite-pitching-2026-10-24/holdout/results.json", format: "application/json" }] }),
  datasetJsonLd({ name: "Roster and minor-league opportunity test (June 2024 → June 2025 hitters)", description: "Training data, forecasts and replay code for a playing-time model fitted on 584 hitters' June 2024 snapshots and evaluated on 612 June 2025 forecasts, with AA/AAA workloads and dated active rosters.", path: "/research#playing-time-opportunity", datePublished: "2026-10-21", files: [{ url: "/research/playing-time-opportunity-2026-10-21.tar.gz", format: "application/gzip" }, { url: "/research/playing-time-opportunity-2026-10-21/results.json", format: "application/json" }] }),
  datasetJsonLd({ name: "Multi-season projection baselines", description: "Historical counts and replay code for a three-season projection baseline compared with ZiPS and FanGraphs Depth Charts.", path: "/research#projection-baselines", datePublished: "2026-10-21", files: [{ url: "/research/projection-baselines-2026-10-20.tar.gz", format: "application/gzip" }, { url: "/research/projection-baselines-2026-10-20/results.json", format: "application/json" }] }),
  datasetJsonLd({ name: "Projection rates and playing time benchmark (2024–2025)", description: "Scoring inputs and replay code for five archived FanGraphs forecasts, scoring performance rates separately from playing time.", path: "/research#projection-benchmark", datePublished: "2026-10-20", files: [{ url: "/research/projection-benchmark-2026-10-19.tar.gz", format: "application/gzip" }, { url: "/research/projection-benchmark-2026-10-19/results.json", format: "application/json" }] }),
  datasetJsonLd({ name: "ShapeCast 2026 frozen forecast results", description: "Frozen pitch-shape strikeout and walk forecasts for 387 pitchers, their 2026 outcomes, and the scoring code.", path: "/research#2026", datePublished: "2026-10-18", files: [{ url: "/research/2026-forecast-results.tar.gz", format: "application/gzip" }, { url: "/research/2026-forecast-results/shapecast_pitcher_scores.csv", format: "text/csv" }] }),
  datasetJsonLd({ name: "Dugout Value trade-model archive (model 2026-10-17)", description: "The trade model's code, settings and July 31, 2026 player inputs, with a checksum and replay instructions.", path: "/research#model-archive", datePublished: "2026-10-17", files: [{ url: "/research/snapshots/dugout-value-2026-10-17.tar.gz", format: "application/gzip" }] }),
];

export default function ResearchFiles() {
  return <Publication active="analysis"><JsonLd data={[webPageJsonLd({ type: "CollectionPage", title: "Research files and forecast results", description: "Data and code for historical projection tests, frozen forecasts, and the dated trade-model archive.", path: "/research" }), breadcrumbJsonLd([["Research files", "/research"]]), ...datasets]}/><header className="section-intro"><h1>Research files</h1><p>Forecasts, outcomes, and code for checking the published results. The trade-model archive preserves the inputs and rules behind the October release.</p></header><div className="research-files">
    <section id="bullpen-leverage"><h2>Bullpen leverage, 2021–26</h2>
      <p>Published October 30, 2026. Exploratory. The leverage measure, the hindsight estimates, the team scores and the luck test were planned before any result was computed; the real-time rules and the tie and extra-inning comparisons were added afterward. In hindsight, giving each team’s highest-leverage batters to its best relievers is worth 1.9 wins per team a season. Rules that use only what a manager knew at the time recover almost none of it, and no team’s efficiency carries over from year to year.</p>
      <p><Link href="/analysis/bullpen-management-is-harder-than-you-think">Read the article</Link>.</p>
      <ul>
        <li><a href="/research/bullpen-leverage-2026-10-30.tar.gz" download>Download the plan, code and aggregate results</a></li>
        <li><a href="/research/bullpen-leverage-2026-10-30/PROTOCOL.md">Plan</a> and <a href="/research/bullpen-leverage-2026-10-30/results.json">all aggregate results (JSON)</a></li>
      </ul>
      <p>Statcast and FanGraphs data and player-level rows are not redistributed.</p>
    </section>
    <section id="dv-projections"><h2>Dugout Value projections against ZiPS and Steamer</h2>
      <p>Published October 29, 2026. Historical 2025–26 rate forecasts are competitive with ZiPS and Steamer on hitter wOBA (.0287 versus .0288 and .0288); pitcher FIP error is .728 versus .763 and .731. The package contains the original benchmark, an independent raw-input replay, player-clustered intervals, additional whole-season WAR tests including zero-workload players, and multi-year comparisons. DV with expected workloads had season-WAR RMSE of 1.14 for hitters and .80 for pitchers, compared with ZiPS’s 1.40 and .88 and Steamer’s 1.16 and .80. Historical seasons have been reused; the prospective test is 2027.</p>
      <p><Link href="/analysis/our-projections-replace-zips">Read the analysis</Link>.</p>
      <ul>
        <li><a href="/research/dv-projections-2026-10-29.tar.gz" download>Download the protocols, locks, results and code</a></li>
        <li><a href="/research/dv-projections-2026-10-29/PROTOCOL-PROJECTIONS.md">Protocol</a>, <a href="/research/dv-projections-2026-10-29/LOCK-MODEL-v1.json">model lock</a> and <a href="/research/dv-projections-2026-10-29/eval_holdout-v1.json">holdout results (JSON)</a></li>
        <li><a href="/research/dv-projections-2026-10-29/site/horizon_backtest_summary.json">Multi-year backtests</a> and <a href="/research/dv-projections-2026-10-29/site/calibration_dv_results.json">the descriptive price-per-win refit</a></li>
      </ul>
      <p><a href="/research/dv-projections-2026-10-29/validation/full_season_war_results.json">Season-WAR validation</a>, <a href="/research/dv-projections-2026-10-29/validation/independent_primary_replay.json">independent score replay</a> and <a href="/research/dv-projections-2026-10-29/README.md">reproduction instructions</a>. Archived versions retain their original files and locks. Raw FanGraphs data and bulk player-level projection outputs are not redistributed.</p>
    </section>
    <section id="value-war"><h2>DV WAR with a contact adjustment and full fielding credit</h2>
      <p>The current hitter leaderboard starts with fWAR, changes batting credit for expected versus actual contact value, and retains full fielding, framing, baserunning, positional and replacement credit. With actual later playing time held fixed, the contact adjustment reduced 2022–26 next-season team run-differential error by 2.9% (.5277 versus .5436 runs per game). The roster-turnover comparison was inconclusive. These are exploratory comparisons on previously examined seasons, not proof of superior individual retrospective WAR.</p>
      <p><Link href="/analysis/a-statcast-war">Read the methods</Link> · <Link href="/tools/dv-war">Explore the leaderboard</Link>.</p>
      <ul>
        <li><a href="/research/value-war-contact-2026-10-29.tar.gz" download>Download the current comparisons, code, checksums and leaderboard recipe</a></li>
        <li><a href="/research/value-war-contact-2026-10-29/results.json">All fixed comparisons</a>, <a href="/research/value-war-contact-2026-10-29/calibration_results.json">the separate batting forecast diagnostic</a> and <a href="/research/value-war-contact-2026-10-29/README.md">reproduction instructions</a></li>
        <li><a href="/research/value-war-2026-10-29.tar.gz">Original locked study and every original result</a>: the broader original model passed its half-season test and did not win its roster-change test. Its salary and stability results are not validations of the current leaderboard formula. The original locks and prospective experiment are unchanged.</li>
      </ul>
      <p>Raw pitch data and FanGraphs source leaderboards are not redistributed.</p>
    </section>
    <section id="defense-pricing"><h2>How free agency prices defense</h2>
      <p>Published October 26, 2026. Exploratory, not pre-registered. Free-agent contracts from 2020 to 2026 credit a run of fielding at about 65% of a run of offense, close to the 72% that fielding’s three-year track record justifies; team fielding runs convert to runs prevented at about 95% of the rate batting runs convert to runs scored.</p>
      <p><Link href="/analysis/teams-pay-less-for-defense">Read the analysis</Link>.</p>
      <ul>
        <li><a href="/research/defense-pricing-2026-10-26.tar.gz" download>Download the scripts and printed results</a></li>
        <li><a href="/research/defense-pricing-2026-10-26/outputs.txt">Printed results</a></li>
      </ul>
      <p>FanGraphs leaderboards and free-agent tracker data are not redistributed.</p>
    </section>
    <section id="fa-predictions-2027"><h2>Free-agent contract predictions, 2026–27</h2>
      <p>Estimates recorded October 29, 2026, using DV forecasts through the completed 2026 season. The top 30 modeled MLB free agents plus Teruaki Sato are priced with fixed $11M-per-win and contract-term rules. Tarik Skubal is estimated at 10 years and $386M, with his term set by hand (the model’s rule gives nine years and $367M), in a revision recorded the same evening. The download contains the dated predictions, scoring protocol, input hashes, reproducible pricing code and the earlier ZiPS-based release.</p>
      <p><Link href="/analysis/what-this-winters-free-agents-should-cost">Read the predictions</Link>.</p>
      <ul>
        <li><a href="/research/fa-predictions-2026-27.tar.gz" download>Download the predictions, protocol, amendments, locks and calibration scripts</a></li>
        <li><a href="/research/fa-predictions-2026-27/PROTOCOL-FA-2027.md">Scoring protocol</a>, <a href="/research/fa-predictions-2026-27/DV-20261029.md">forecast conventions</a> and <a href="/research/fa-predictions-2026-27/LOCK-DV-20261029.json">input checksums and recording time</a>, plus revisions <a href="/research/fa-predictions-2026-27/DV-20261029-R1.md">R1</a> and <a href="/research/fa-predictions-2026-27/DV-20261029-R2.md">R2</a> (ages) and <a href="/research/fa-predictions-2026-27/LOCK-DV-20261029-R2.json">the current lock</a></li>
        <li><a href="/research/fa-predictions-2026-27/predictions_frozen.csv">Predictions (CSV)</a> and <a href="/research/fa-predictions-2026-27/predictions_frozen.json">with flags and exclusions (JSON)</a></li>
      </ul>
      <p>The MLB Trade Rumors free-agent list and FanGraphs data are not redistributed; their checksums are in the locks.</p>
    </section>
    <section id="paq-elite-pitching"><h2>Decision skill against elite pitching: original study and holdout</h2>
      <p>Published October 24, 2026. The pre-registered plate-appearance quality study (locked October 23), the exploratory follow-up on 2022–26, and a holdout test locked before its data was downloaded: the 2021 regular season and the 2021–26 postseasons (2026 through October 23). The holdout failed its pass rule.</p>
      <p><Link href="/analysis/do-good-swing-decisions-beat-elite-relievers">Read the results</Link>. Exploratory results are labeled as such and are not confirmatory.</p>
      <ul>
        <li><a href="/research/paq-elite-pitching-2026-10-24.tar.gz" download>Download the protocols, locks, results and verifications</a></li>
        <li><a href="/research/paq-elite-pitching-2026-10-24/holdout/PROTOCOL-HOLDOUT.md">Holdout protocol</a> and <a href="/research/paq-elite-pitching-2026-10-24/holdout/LOCK-HOLDOUT.json">its checksum and lock time</a></li>
        <li><a href="/research/paq-elite-pitching-2026-10-24/holdout/RESULTS.md">Holdout results</a> and <a href="/research/paq-elite-pitching-2026-10-24/holdout/VERIFY-HOLDOUT.md">independent verification</a></li>
        <li><a href="/research/paq-elite-pitching-2026-10-24/original-study/PROTOCOL.md">Original study protocol</a>, <a href="/research/paq-elite-pitching-2026-10-24/original-study/REPORT.md">results report</a> and <a href="/research/paq-elite-pitching-2026-10-24/exploratory/EXPLORE.md">exploratory analysis</a></li>
      </ul>
      <p>Statcast pitch data comes from Baseball Savant and is not redistributed. The bundle holds the protocols, results and chart data needed to check the published numbers.</p>
    </section>
    <section id="playing-time-opportunity"><h2>Roster and minor-league opportunity test</h2>
      <p>Published October 21, 2026. A model fitted on 584 hitters’ June 2024 snapshots and evaluated on 612 June 2025 forecasts. Dated active rosters and AA/AAA workloads lower probability forecast error in this sample, while archived Depth Charts retains lower total-PA error.</p>
      <p><Link href="/analysis/minor-league-history-and-mlb-opportunity">Read the results</Link>. This is retrospective development; candidate-list dates and forecast timestamps differ.</p>
      <ul>
        <li><a href="/research/playing-time-opportunity-2026-10-21.tar.gz" download>Download the training data, forecasts, and replay code</a></li>
        <li><a href="/research/playing-time-opportunity-2026-10-21/results.json">Errors, probability calibration, and player groups (JSON)</a></li>
        <li><a href="/research/playing-time-opportunity-2026-10-21/PROTOCOL.md">Model specification and validation notes</a></li>
        <li><a href="/research/playing-time-opportunity-2026-10-21/timing-evidence/timing-validation.json">Game-completion and forecast-timing checks</a></li>
      </ul>
      <p>The offline replay refits only the 2024 training rows and reproduces every 2025 prediction and score. The trade model does not use these experimental forecasts.</p>
    </section>
    <section id="projection-baselines"><h2>Multi-season projection baselines</h2>
      <p>Published October 21, 2026. A follow-up using three prior MLB seasons, completed-game counts and dated active rosters. The multi-season rate estimate finishes close to ZiPS in two pitcher samples; Depth Charts retains a clear playing-time advantage.</p>
      <p><Link href="/analysis/prior-seasons-and-projection-baselines">Read the comparison</Link>. It reuses the first benchmark’s forecast lists and outcomes, so these remain retrospective development results.</p>
      <ul>
        <li><a href="/research/projection-baselines-2026-10-20.tar.gz" download>Download the historical counts and replay code</a></li>
        <li><a href="/research/projection-baselines-2026-10-20/results.json">Results and roster groups (JSON)</a></li>
        <li><a href="/research/projection-baselines-2026-10-20/PROTOCOL.md">Formulas and scoring rules</a></li>
        <li><a href="/research/projection-baselines-2026-10-20/roster-validation.json">Historical roster checks and limitations</a></li>
      </ul>
      <p>The replay rebuilds the new baseline forecasts and scores from normalized counts. Roster membership describes the error groups; it does not adjust the forecasts.</p>
    </section>
    <section id="projection-benchmark"><h2>Projection rates and playing time</h2>
      <p>Published October 20, 2026. Five archived FanGraphs forecasts from 2024 and 2025, with performance rates scored separately from playing time. The workload comparison keeps players with zero later appearances and reports unresolved identities.</p>
      <p><Link href="/analysis/projection-rates-and-playing-time">Read the benchmark</Link>. These are retrospective development results, not a test of a new Dugout Value model.</p>
      <ul>
        <li><a href="/research/projection-benchmark-2026-10-19.tar.gz" download>Download the scoring inputs and replay code</a></li>
        <li><a href="/research/projection-benchmark-2026-10-19/results.json">Results, coverage, and excluded identities (JSON)</a></li>
        <li><a href="/research/projection-benchmark-2026-10-19/PROTOCOL.md">Scoring rules and archive-date checks</a></li>
        <li><a href="/research/projection-benchmark-2026-10-19/sources.json">Source URLs and checksums</a></li>
      </ul>
      <p>The bundle reproduces the published scores without a data download or model fitting. Basic ZiPS workload is labeled separately from Depth Charts’ roster-based playing-time forecasts.</p>
    </section>
    <section id="2026"><h2>2026 forecast results</h2><p>Scored October 18, 2026, using regular-season outcomes from July 16 through September 27.</p>
      <p><strong>ShapeCast:</strong> {scores.shape.eligible_count} of {scores.shape.frozen_forecast_count} pitchers met the required 75 batters faced. Forecast error was 1.3% lower than the results-only baseline; the 95% interval ranges from 1.9% worse to 4.1% better.</p>
      <p><strong>Miguel Vargas:</strong> 28 later pitches fell in the registered high-away four-seam region. The required sample was 75, so the registered tests remain unevaluated.</p>
      <p><Link href="/analysis/shapecast-2026-forecast-results">Read the scoring report</Link>.</p>
      <ul>
        <li><a href="/research/2026-forecast-results.tar.gz" download>Download the complete scoring bundle</a></li>
        <li><a href="/research/2026-forecast-results/shapecast_pitcher_scores.csv" download>All 387 pitchers: forecasts, outcomes, and eligibility (CSV)</a></li>
        <li><a href="/research/2026-forecast-results/forecast_scores.json">Full metrics, role groups, and calibration (JSON)</a></li>
        <li><a href="/research/2026-forecast-results/frozen_shapecast_protocol.md">Original ShapeCast protocol</a> and <a href="/research/2026-forecast-results/frozen_vargas_prediction.json">Vargas registration</a></li>
        <li><a href="/research/2026-forecast-results/manifest.json">File checksums and source manifest</a></li>
      </ul>
      <p>The bundle includes outcome counts, the frozen files, and a Python replay script. It reproduces the scoring without refitting the forecasting model. ShapeCast’s protocol was saved after some target games had occurred, before their outcomes were imported into the workspace; the report preserves that timing limitation.</p>
    </section>
    <section id="model-archive"><h2>Trade-model archive</h2><p>Model {snapshot.modelVersion}, captured October 17, 2026. The underlying player and playoff inputs are dated July 31, 2026. The capture date does not make those inputs current.</p>
      <ul>
        <li><a href="/research/snapshots/dugout-value-2026-10-17.tar.gz" download>Download the model and data archive</a></li>
        <li><a href="/research/snapshots/dugout-value-2026-10-17.tar.gz.sha256">Archive checksum</a></li>
        <li><a href="/research/snapshots/2026-10-17/manifest.json">Model version, source dates, and file manifest</a></li>
      </ul>
      <p>Unpack the archive and follow its README to verify the files and replay a player’s value. It includes the original settings and model code. A later revision is saved separately rather than replacing this copy.</p>
      <p><Link href="/players">Player case studies</Link> explain how salaries, option paths, and distant projection years affect the estimates. The <Link href="/ledger">transaction ledger</Link> keeps the dates and terms of historical moves separate from these later calculations.</p>
    </section>
    <section><h2>Source data</h2><p>The 2026 ShapeCast outcomes came from <a href="https://baseballsavant.mlb.com/statcast_search">Baseball Savant</a>. The historical projection benchmark uses FanGraphs archives and leaderboards, with MLB schedules to check forecast timing. Each release records its source requests and checksums. The trade database uses the sources listed in <Link href="/methods#data">Methods &amp; data</Link>.</p><p>New trade-data downloads go to a separate review directory. A candidate must pass checks for missing players, projection years, and contract paths before replacing the published database.</p></section>
  </div></Publication>;
}
