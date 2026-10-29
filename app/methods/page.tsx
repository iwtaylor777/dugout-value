import type { Metadata } from "next";
import { pageMetadata, webPageJsonLd } from "../seo";
import { JsonLd } from "../json-ld";
import Link from "next/link";
import database from "../data/player-database.json";
import { Publication, SnapshotNotice } from "../site-shell";
import "./methods.css";

export const metadata: Metadata = pageMetadata({ title: "Methods & data", description: "How Dugout Value’s numbers are made: data sources and dates, the surplus-value model, what has been tested, and what is missing.", path: "/methods" });

const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

// The dollar figures in DISCOUNT_ROWS and FANGRAPHS_ROWS come from context/MODEL-NUMBERS.md (July 31, 2026 snapshot,
// model 2026-10-17.1: $12M a win, 30% star premium). "Default settings" there means timingPreference 10 and
// valuationView "offseason". They are frozen; the prose about the CURRENT defaults (model 2026-10-25.1) is live text.

const FANGRAPHS_ROWS = [
  { fg: 36, player: "Samuel Basallo", model: "7th", gap: "29 places higher", value: "$177.3M", contract: "Controlled through 2034 · $76.4M salary · 26.9 fWAR", driver: "Years. Counting only seasons through 2031, the end of the published ZiPS series, moves him from 7th to 16th of the 50." },
  { fg: 41, player: "Michael Harris II", model: "12th", gap: "29 places higher", value: "$160.7M", contract: "Controlled through 2032 · $76.0M salary · 22.7 fWAR (3.8 a year)", driver: "Not isolated. None of the four tests below moves him more than two places. The database holds no FanGraphs dollar figures, so I can’t say why." },
  { fg: 21, player: "Yoshinobu Yamamoto", model: "48th", gap: "27 places lower", value: "$18.5M", contract: "Controlled through 2035 · $285.5M salary · 25.0 fWAR", driver: "Salary. With every salary set to zero he would rank 28th." },
  { fg: 22, player: "Aaron Judge", model: "49th", gap: "27 places lower", value: "$18.2M", contract: "Controlled through 2031 · $200.0M salary · 17.0 fWAR", driver: "Salary. With every salary set to zero he would rank 19th." },
  { fg: 14, player: "Cam Schlittler", model: "39th", gap: "25 places lower", value: "$63.6M", contract: "Controlled through 2031 · $21.3M salary · 13.9 fWAR (2.8 a year)", driver: "Not isolated. None of the four tests moves him more than two places toward FanGraphs’ 14th." },
  { fg: 49, player: "Roman Anthony", model: "24th", gap: "25 places higher", value: "$103.5M", contract: "Controlled through 2034 · $157.4M salary · 26.7 fWAR", driver: "Years, weakly. Counting only seasons through 2031 moves him three places, from 24th to 27th." },
];

const DISCOUNT_ROWS = [
  { player: "Kevin McGonigle", before: "$594.3M", discount: "$402.4M", both: "$382.4M" },
  { player: "Konnor Griffin", before: "$423.0M", discount: "$279.6M", both: "$278.6M" },
  { player: "JJ Wetherholt", before: "$405.9M", discount: "$281.4M", both: "$266.0M" },
  { player: "Bobby Witt Jr.", before: "$285.7M", discount: "$234.6M", both: "$212.3M" },
  { player: "Paul Skenes", before: "$152.2M", discount: "$130.9M", both: "$107.9M" },
  { player: "Aaron Judge", before: "$6.8M", discount: "$16.7M", both: "$18.2M" },
];

export default function Methods() {
  return <Publication active="methods"><JsonLd data={webPageJsonLd({ type: "TechArticle", title: "Methods & data", description: "How Dugout Value’s numbers are made: data sources and dates, the surplus-value model, what has been tested, and what is missing.", path: "/methods" })}/>
    <header className="section-intro"><p className="eyebrow">How the numbers are made</p><h1>Methods & data</h1><p>The trade model does one calculation. It projects a player’s wins, prices each at $11 million (20% more for wins past a star threshold), subtracts his salary, discounts the future 10% a year, and adds up the years his team controls him, starting with 2027. The projections come from FanGraphs. The prices are assumptions. Neither the prices nor the value ranges have been checked against real trades, and this page says so wherever it matters.</p></header>
    <SnapshotNotice/>
    <div className="methods-layout">
      <nav className="methods-toc" aria-label="On this page">
        <a className="top" href="#trade-model">Trade value model</a>
        <a className="sub" href="#data">Data & dates</a>
        <a className="sub" href="#model">Model assumptions</a>
        <a className="sub" href="#fangraphs">Versus FanGraphs’ list</a>
        <a className="sub" href="#validation">What’s been tested</a>
        <a className="sub" href="#limits">What’s missing</a>
        <a className="top" href="#glossary">Key terms</a>
      </nav>
      <div className="article-body">
        <h2 id="trade-model">Trade value model</h2>
        <p className="methods-intro">Everything in the four tools comes from this model. The sections below cover where the data comes from, what the model assumes, where it disagrees with FanGraphs, and what has and hasn’t been tested.</p>

        <section id="data" className="methods-group"><h3>Data & dates</h3>
          <p>The built-in player database was refreshed on <strong>{longDate(database.meta.refreshed)}</strong>. It contains {database.meta.mlbCount.toLocaleString("en-US")} major league player records and {database.meta.prospectCount.toLocaleString("en-US")} prospect records. This is a dated snapshot; it does not update automatically.</p>
          <p>By default the tools use the “Offseason view (2027 on)” and value 2027 onward, because the 2026 regular season is over. Remaining 2026 production and salary are zero. The valuation clock still starts in 2026, so 2027 surplus is discounted one year.</p>
          <ul>
            <li><strong>Current-year projections:</strong> Remaining-season fWAR and salary are zero after the regular season ends. Recorded 2026 statistics remain available as projection inputs.</li>
            <li><strong>Future projections:</strong> public ZiPS. For the 50 players in FanGraphs’ 2026 Trade Value Series, 2027–31 use that series’ published ZiPS as-is, with no Dugout Value adjustment. For everyone else, future seasons start from published future ZiPS, and seasons beyond the published ones come from an aging curve anchored to ZiPS. During the season, 2027–28 carry the in-season bridge described in <Link href="/analysis/when-a-better-fit-isnt-a-better-forecast">the research note</Link>. Spring ZiPS doesn’t know how the 2026 season went, so after it ended, every player with at least 100 PA or 20 innings in 2026 got an end-of-season update: a regressed, age-adjusted three-season WAR rate plus about 60% of the information ZiPS had beyond it (the share that held up when tested on 2026), applied at ZiPS playing time and fading by 15% a year into later seasons. Pitchers’ roles follow their 2026 usage. The method, its calibration and the script are in <Link href="/research#fa-predictions-2027">the free-agent research files</Link>.</li>
            <li><strong>Dugout Value projections (optional):</strong> the tools can switch from ZiPS to Dugout Value projections v1 under model assumptions. Each player’s 2027 WAR rate comes from our own projection model, which uses data through the 2026 season and matched or beat ZiPS and Steamer on its locked 2025–26 holdout. Each 2027 rate is multiplied by a full season of playing time, the larger of the model’s expected playing time (mapped onto ZiPS’s scale by rank) and the player’s healthy workload (the average of his two largest totals in 2024–26), so a recent injury doesn’t shrink a regular’s season and prices stay on the full-season scale the $11 million-per-win calibration used. Later seasons keep the site’s aging shape, scaled to the new 2027 level. Players without MLB history (prospects and international signings) keep ZiPS. ZiPS stays the default.</li>
            <li><strong>Contracts, roles, and availability:</strong> FanGraphs RosterResource, with model estimates where inputs are incomplete. Arbitration salaries are model estimates.</li>
            <li><strong>Prospects:</strong> FanGraphs The Board and selected SoxProspects grades. Four players absent from the current Board retain their July 31 grades, with source dates and notes in their editors. Their organizations were checked against MLB transactions.</li>
            <li><strong>Trade finder:</strong> roster needs and projected 2027 production. The offseason pool includes every other club; completed-season playoff odds do not identify sellers.</li>
          </ul>
          <p><Link href="/research">Download the dated model and data archive</Link> to reproduce the October 17 model with its July 31 inputs.</p>
          <p>Reviewed option paths are preserved across refreshes. Missing roster records require transaction evidence or remain unresolved. Individual player editors show projection and contract sources. A database refresh date does not imply that every upstream source was published on that date.</p>
          <p className="source-line">Providers: <a href="https://www.fangraphs.com/projections">FanGraphs projections</a>, <a href="https://www.fangraphs.com/roster-resource">RosterResource</a>, <a href="https://www.fangraphs.com/prospects/the-board">The Board</a>, and <a href="https://www.soxprospects.com/">SoxProspects</a>.</p>
        </section>

        <section id="model" className="methods-group"><h3>Model assumptions</h3>
          <p><strong>The price of a win.</strong> For major leaguers, the model converts each projected season of fWAR to dollars, subtracts salary, and adds up the seasons of club control. The default price is $11 million a win, 20% higher for each net win past two, and it rises 3% a year. A roster-spot allowance of 0.5 wins for regulars and 0.2 for relievers comes off each forecast first. A reliever projected for more than 0.8 wins in a season is priced 50% higher than that; lesser relievers get the base price. The $11 million price and the 20% and 50% premiums were set after a calibration against 2020–26 free-agent contracts, described in <Link href="/analysis/what-this-winters-free-agents-should-cost">this winter’s free-agent predictions</Link>. These are assumptions, not observed trade-market prices.</p>
          <p>The dollar figures in the tables and examples below (Kevin McGonigle’s $382.4 million, Aaron Judge’s $18.2 million, the FanGraphs comparison) were computed with model 2026-10-17.1, the October 17 defaults of $12 million per win and a 30% star premium. The current tools use model 2026-10-25.1, so they will show different numbers.</p>
          <p>That curve is close to FanGraphs’. FanGraphs prices a win at roughly $7 million for the first win, $8.5 million for the second and $13 million after that. At default settings, before the 3% yearly rise, a 4-win season is priced about 1% above FanGraphs’ 2026 graduated scale ($41.8 million against $41.5 million) and a 6-win season about 1% above it ($68.2 million against $67.5 million).</p>

          <p><strong>The discount.</strong> By default, future surplus is discounted 10% a year while the price of a win rises 3% a year, matching the rates FanGraphs uses for its prospect values. A no-discount scenario is available in the model settings.</p>
          <p>The July 31 comparison below shows how the defaults changed the board. Earlier versions of this site didn’t discount, which put Kevin McGonigle at $594.3 million. The discount alone brings him to $402.4 million, and dropping the rest of 2026 brings him to $382.4 million. It moves Aaron Judge the other way, because his costly seasons come last.</p>
          <div className="article-table-wrap" tabIndex={0}>
            <table>
              <caption>Surplus value before and after the two default changes (July 31, 2026 data)</caption>
              <thead><tr><th scope="col">Player</th><th scope="col" className="num">Before: no discount, 2026 counted</th><th scope="col" className="num">10% discount only</th><th scope="col" className="num">Both changes (default)</th></tr></thead>
              <tbody>{DISCOUNT_ROWS.map(row => <tr key={row.player}><th scope="row">{row.player}</th><td className="num">{row.before}</td><td className="num">{row.discount}</td><td className="num">{row.both}</td></tr>)}</tbody>
            </table>
          </div>
          <p>The reason for the change is that the two halves of the model were running on different clocks. FanGraphs’ prospect table is already discounted at 10%, but major league seasons weren’t, so a player’s value jumped when he graduated. Prospect values are now not discounted a second time. The discount clock starts at 2026, so 2027 is already divided by 1.10. The refresh updates player inputs without moving this annual discount clock. Prospect values still use the published July 2026 table; a new input date does not rebase that table.</p>

          <p><strong>Offseason view.</strong> The tools and trade finder value 2027 onward. Players with no modeled control after 2026 are excluded from rankings and suggested offers. Historical deadline calculations remain in the downloadable July-input archive. The deadline adjustment is disabled in the current tools because no regular-season 2026 production remains.</p>

          <p><strong>Seasons the projections don’t reach.</strong> Past the last published ZiPS season, value comes from the site’s own aging curve. That season is 2031 for the 50 Trade Value Series players and mostly 2028 for everyone else. In the July 31 comparison, $111.1 million of McGonigle’s $382.4 million, 29.0%, came from 2032–34. The tools mark those seasons.</p>

          <p><strong>Prospects.</strong> Prospect values use FanGraphs’ July 2026 surplus-value table by Future Value grade (<a href="https://blogs.fangraphs.com/introducing-an-updated-method-for-prospect-valuation/">Clemens, “Introducing an Updated Method for Prospect Valuation”</a>), with small adjustments for Board rank, roster status and arrival. That table prices wins on FanGraphs’ graduated scale, which differs from the curve used for major leaguers. The common dollar scale is useful for comparison, but its accuracy across player types has not been tested against trades.</p>

          <p><strong>Ranges.</strong> Value ranges are <strong>rules of thumb, not probabilities</strong>. Each is the midpoint plus or minus an allowance that nobody has checked against outcomes. Range width depends on role, injury status and how far out the surplus sits. It does not yet depend on age, major league experience or projection sample size, so ranges for recent call-ups are too narrow. In the July 31 comparison, rookie McGonigle received ±20.8%, against ±17.0% for Julio Rodríguez. The difference is distance, not age. Injury labels widen a range without cutting its midpoint, and a no-trade clause flags an approval requirement without changing surplus value.</p>
          <p><Link className="text-link" href="/analysis/how-to-read-value-ranges">How to read the ranges →</Link></p>
          <p><Link className="text-link" href="/tools/trade#methodology">See the full calculation and adjustable settings →</Link></p>
        </section>

        <section id="fangraphs" className="methods-group"><h3>Where the model disagrees with FanGraphs’ Trade Value list</h3>
          <p>This comparison uses the archived July 31 player inputs. FanGraphs’ <a href="https://blogs.fangraphs.com/2026-trade-value-nos-21-30/">2026 Trade Value Series</a>, by Ben Clemens, ranks 50 players. The database carries each player’s rank: 48 major leaguers and two prospects, Jesús Made and Kade Anderson. Ranking those 50 by the model’s surplus value at the October 17 default settings (model 2026-10-17.1) gives a Spearman correlation of <strong>0.603</strong> with the FanGraphs order. A correlation of 1 would be the same order. It was 0.600 before the discount and the offseason view.</p>
          <p>That is a benchmark comparison, not a backtest. FanGraphs’ list is another model’s judgment, not what happened to anyone, and the database holds ranks, not FanGraphs’ dollar figures, so I can compare orders but not amounts. Agreement is no proof the model is right, and disagreement is no proof it’s wrong. The six largest gaps follow.</p>
          <div className="article-table-wrap" tabIndex={0}>
            <table>
              <caption>Largest rank gaps among the 50 players, July 31 inputs and October 17 default settings</caption>
              <thead><tr><th scope="col" className="num">FanGraphs rank</th><th scope="col">Player and contract</th><th scope="col">Model rank of the 50</th><th scope="col" className="num">Surplus value</th><th scope="col">What drives the gap</th></tr></thead>
              <tbody>{FANGRAPHS_ROWS.map(row => <tr key={row.player}><td className="num">{row.fg}</td><th scope="row">{row.player}<br/><span className="contract-line">{row.contract}</span></th><td>{row.model}<br/><span className="contract-line">{row.gap}</span></td><td className="num">{row.value}</td><td className="wide">{row.driver}</td></tr>)}</tbody>
            </table>
          </div>
          <p>To find each driver I re-ranked the same 50 players four ways: with every salary set to zero, with no star premium, counting only seasons through 2031, and with no discount. The driver is the test that moves a player’s rank furthest toward FanGraphs’, and only if it moves him three places or more. The next two gaps are Brice Turang (FanGraphs 19th, model 42nd) and Yordan Alvarez (20th, 38th).</p>
          <p>Four of the six fit one pattern: the model charges harder for salary (Yamamoto, Judge) and credits long control more (Basallo, Anthony) than FanGraphs’ order does. That is what surplus value means, and it is also the part of the model nobody has tested against trades.</p>
        </section>

        <section id="validation" className="methods-group"><h3>What’s been tested</h3>
          <p>The repository contains a hitter projection audit last run July 21, 2026. A ridge correction failed the stated same-season uncertainty gate and performed worse than future ZiPS on the following-season holdout. It was not deployed. The smaller role-aware adjustment remains a conservative modeling choice. Its measured advantage had an interval that included no improvement. This page reports the audit as it ran on July 21. It hasn’t been rerun since.</p>
          <p>Three other pieces of research are published. None of them feeds the trade values.</p>
          <ul>
            <li><Link href="/analysis/a-hitters-cold-zone-isnt-a-pitching-plan">A hitter’s cold zone isn’t a pitching plan</Link>: in 2024–25, opponents’ hitter-specific plans lined up with the model at a slope of 0.464 (95% interval 0.391 to 0.537), against 0.027 to 0.098 for shuffled labels. The test of whether that cost hitters anything came back null.</li>
            <li><Link href="/analysis/shapecast-pitch-shape-k-bb">Pitch shape knows something a first half doesn’t</Link>: public pitch traits improved second-half K-BB% forecasts by 2.6% in 2024–25 (95% interval 0.4% to 4.8%). The model’s RMSE was 4.6% higher than ZiPS in the 2025 benchmark.</li>
            <li><Link href="/analysis/three-statcast-ideas-that-didnt-improve-the-forecast">Three Statcast ideas that didn’t improve the forecast</Link>: Damage Conversion, Arsenal Synergy and spray-adjusted xwOBA, all null or worse.</li>
          </ul>
          <p>Nothing here establishes pitcher accuracy, trade-price accuracy, or calibrated value ranges. The FanGraphs comparison above is a benchmark, not a test of any of them.</p>
          <Link className="text-link" href="/analysis/when-a-better-fit-isnt-a-better-forecast">Read the research note on the ZiPS correction →</Link>
        </section>

        <section id="limits" className="methods-group"><h3>What’s missing</h3>
          <p>The tool is a decision aid, not a claim about a club’s private model. It does not fully model team payroll, competitive balance tax, option-year eligibility, service time and 10-and-5 rights, 40-man roster spots, qualifying offers, medical information, or each club’s preferences. Arbitration salaries are model estimates, and the error of that estimate has not been published. Its prospect roster adjustments are rough costs, not a complete 40-man roster simulator.</p>
          <p>Contract paths with a player option or an opt-out, such as Julio Rodríguez’s and Juan Soto’s, are coded by hand. Refreshes now download to a separate review directory. Contract paths must be checked before those inputs replace the published data.</p>
          <p>Before using a scenario outside this historical snapshot, verify transactions, injuries, service time, contract options, and trade protections. Editing an input creates a scenario; it does not refresh the underlying database.</p>
        </section>

        <section id="glossary"><h2>Key terms</h2>
          <dl className="glossary">
            <dt>fWAR</dt><dd>FanGraphs wins above replacement. Forecast fWAR estimates future production; it is not production already recorded.</dd>
            <dt>Surplus value</dt><dd>Modeled production value less employment cost during club control. It is not salary, cash a team receives, or an asking price. In casual copy, trade value.</dd>
            <dt>Midpoint</dt><dd>The model’s single estimate of a value, before any range. The gap between two midpoints is the model’s answer to a trade.</dd>
            <dt>Range</dt><dd>The low and high values the model gives for a player or package. It reflects fixed uncertainty allowances, not a probability.</dd>
            <dt>Roster-spot allowance</dt><dd>The wins a team could get from a roster spot anyway, taken off each forecast before it is priced: 0.5 wins for regulars, 0.2 for relievers.</dd>
            <dt>July deadline scenario</dt><dd>An optional setting, off by default, that raises the price of the rest-of-2026 wins and adds an October term for top starters. It is disabled after the regular season ends.</dd>
            <dt>Pending free agent</dt><dd>A major leaguer with no club control after 2026. His surplus value is zero in the default view, and he is left out of the rankings. The offseason Trade finder excludes these players.</dd>
            <dt>Club control</dt><dd>The years a team can retain a player under the modeled contract and eligibility assumptions.</dd>
            <dt>Arbitration</dt><dd>A salary-setting process for eligible players. The tool estimates those salaries; it does not know future awards.</dd>
            <dt>FV</dt><dd>Future Value, a scouting grade. Converting a grade to dollars adds another layer of assumptions.</dd>
          </dl>
        </section>
      </div>
    </div>
  </Publication>;
}
