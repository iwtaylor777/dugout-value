import Link from "next/link";
import report from "../../public/research/projection-benchmark-2026-10-19/results.json";
import type { Article } from "./types";
import { AUTHOR } from "./types";

const workloadKeys = ["2024-apr-dc-bat", "2025-dc-bat"] as const;
const rateRows = [
  { key: "2024-apr-dc-bat", label: "Depth Charts, April 10, 2024", endpoint: "K%" },
  { key: "2025-dc-bat", label: "Depth Charts, June 1, 2025", endpoint: "K%" },
  { key: "2025-bat", label: "ZiPS hitters, July 31, 2025", endpoint: "K%" },
  { key: "2024-pit", label: "ZiPS pitchers, June 21, 2024", endpoint: "K-BB%" },
  { key: "2025-pit", label: "ZiPS pitchers, June 24, 2025", endpoint: "K-BB%" },
] as const;
const fixed = (x: number) => x.toFixed(1);
const interval = (xs: number[]) => `${fixed(xs[0])}% to ${fixed(xs[1])}%`;
const dc24 = report.scores["2024-apr-dc-bat"].workload;
const dc25 = report.scores["2025-dc-bat"].workload;

export const article: Article = {
  slug: "projection-rates-and-playing-time",
  category: "Research note",
  title: "Depth Charts beat a simple playing-time baseline",
  summary: `Two archived hitter forecasts reduced playing-time RMSE by ${fixed(dc24.comparison.rmse_reduction_pct)}% and ${fixed(dc25.comparison.rmse_reduction_pct)}% against a calendar-day pace estimate. This is a starting benchmark for Dugout Value; it does not test a new projection model.`,
  author: AUTHOR,
  published: "2026-10-20",
  dateLabel: "October 20, 2026",
  readTime: "6 min read",
  evidence: { href: "/research#projection-benchmark", label: "Scoring inputs, source dates, and replay code" },
  body: <>
    <p className="article-lead">A hitter can fall short of his projected WAR because he hits worse than expected or because he gets fewer chances to hit. Before changing Dugout Value’s projections, I want to measure those errors separately.</p>
    <p>I checked five archived FanGraphs forecasts against the rest of their respective seasons. For playing time, the comparison uses two Depth Charts hitter lists and keeps players who received no later plate appearances. For performance rates, it tests hitter strikeout rate and pitcher strikeout-minus-walk rate against a simple estimate based on results available before each forecast.</p>
    <p>The established forecasts generally did better. Nothing here supports replacing them with a new Dugout Value model.</p>

    <h2>Playing time</h2>
    <p><a href="https://blogs.fangraphs.com/all-the-2026-projections-are-in/">FanGraphs Depth Charts</a> combines projection rates with roster-based playing time. Basic ZiPS serves a different purpose: its workload column is not the same as a forecast of MLB opportunities. Only Depth Charts enters the playing-time comparison below.</p>
    <p>The baseline extends each hitter’s year-to-date plate appearances at the same calendar-day pace through the end of the season. It knows nothing about injuries, promotions or the depth chart. It also handles schedules poorly, particularly the gap between the overseas openers and the rest of the league’s first games. Beating it is an initial check, not evidence of superiority over another serious projection system.</p>
    <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Playing-time forecast errors"><table>
      <caption>Rest-of-season plate appearances: lower error is better</caption>
      <thead><tr><th scope="col">Forecast date</th><th scope="col">Players scored</th><th scope="col">Depth Charts RMSE</th><th scope="col">Pace RMSE</th><th scope="col">Error reduction (95% interval)</th></tr></thead>
      <tbody>{workloadKeys.map(key => { const s = report.scores[key].workload; return <tr key={key}><th scope="row">{key.startsWith("2024") ? "April 10, 2024" : "June 1, 2025"}</th><td>{s.archived.n}</td><td>{fixed(s.archived.rmse)} PA</td><td>{fixed(s.pace.rmse)} PA</td><td>{fixed(s.comparison.rmse_reduction_pct)}% ({interval(s.comparison.interval95_pct)})</td></tr>; })}</tbody>
    </table></div>
    <p>RMSE is root mean squared error, which gives large misses more weight than small ones. The average absolute miss was {fixed(dc24.archived.mae)} PA in the April 2024 sample and {fixed(dc25.archived.mae)} PA in the June 2025 sample. Those figures cover different lengths of time, so they should not be read as a year-to-year improvement.</p>
    <p>There were {dc24.zero_actual} players with zero later PA in the 2024 scoring group and {dc25.zero_actual} in 2025. They stay in the workload scores. Dropping them would leave out players whose projected playing time never materialized.</p>
    <p>The 2024 list has one unresolved coverage problem: 16 of its 600 forecasts use prospect IDs I could not verify against the outcome records. Those forecasts total 554 PA and are excluded, with their names and IDs in the download. All 612 identities in the 2025 list were resolved. The scored rosters account for {(report.audits["2024-apr-dc-bat"].forecast_roster_work_coverage * 100).toFixed(1)}% and {(report.audits["2025-dc-bat"].forecast_roster_work_coverage * 100).toFixed(1)}% of later MLB plate appearances, respectively.</p>

    <h2>Performance rates</h2>
    <p>The hitter test measures strikeout rate; the pitcher test measures strikeout rate minus walk rate, including intentional walks. Each player’s error is weighted by his actual later PA or batters faced. A player with zero opportunities has no observed rate and cannot enter this part of the test.</p>
    <p>The baseline combines the player’s current-season rate with 200 opportunities at the league’s current-season rate. The choice of 200 was fixed before these scores were calculated. This baseline has no previous-season history, minor-league translations or age adjustment. It is deliberately simple and is not <a href="https://tangotiger.net/marcel/">Tom Tango’s Marcel</a>.</p>
    <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Performance-rate forecast errors"><table>
      <caption>Weighted rate error, in percentage points</caption>
      <thead><tr><th scope="col">Archive</th><th scope="col">Rate</th><th scope="col">Archive RMSE</th><th scope="col">Baseline RMSE</th><th scope="col">Error reduction (95% interval)</th></tr></thead>
      <tbody>{rateRows.map(row => {
        const rates = report.scores[row.key].rates;
        const s = "K%" in rates ? rates["K%"] : rates["K-BB%"];
        return <tr key={row.key}><th scope="row">{row.label}</th><td>{row.endpoint}</td><td>{(s.weighted.archived.rmse * 100).toFixed(2)}</td><td>{(s.weighted.prior.rmse * 100).toFixed(2)}</td><td>{fixed(s.comparison.rmse_reduction_pct)}% ({interval(s.comparison.interval95_pct)})</td></tr>;
      })}</tbody>
    </table></div>
    <p>These are separate comparisons with the same baseline recipe, not a ranking of projection systems. The forecast dates, remaining schedules and player lists differ. The 2024 pitcher interval includes no advantage over the baseline. The baseline has especially little information early in the year, which may contribute to the larger hitter advantages.</p>

    <h2>What the dates can change</h2>
    <p>A historical leaderboard can contain information that was unavailable on the date printed above it. The June 26, 2024 Boston–Toronto game was completed in August, with its statistics credited to June. I excluded two candidate archives whose baseline windows would have crossed that suspension. Another archive was rejected because that day’s games had already started.</p>
    <p>The June 24, 2025 pitcher archive was captured before late June 23 games had finished. Its simple baseline stops at June 22, with June 23 left unscored. ZiPS may therefore have had more recent information than that baseline. The source manifest records the exact capture times and scoring windows.</p>
    <p>These are retrospective development results. Earlier Dugout Value studies have already examined these seasons. The 95% intervals come from 5,000 paired resamples of players within each archive; they describe uncertainty in these samples, not how a model will perform next year.</p>

    <h2>The next comparison</h2>
    <p><strong>Follow-up, October 21:</strong> The <Link href="/analysis/prior-seasons-and-projection-baselines">multi-season comparison</Link> is now available. Older results improve the rate baseline, while Depth Charts retains its playing-time advantage.</p>
    <p>The immediate task is to strengthen the baselines with multiple seasons of history and dated roster information. Then a proposed playing-time model can be judged against the same archived Depth Charts forecasts, using every player whose identity is verified. Its errors should be reported for regulars, reserves and players with no later MLB work.</p>
    <p>For a new Dugout Value model, I would save a complete preseason forecast before the 2027 games begin, including the chance of receiving no playing time. Later updates would be separate forecasts. That would give us a test in which the model, the player list and the scoring rules were settled before the results arrived.</p>
    <p>The trade model is unchanged. The <Link href="/research#projection-benchmark">downloadable files</Link> include every scored player, unresolved identities, average errors and bias, alternative weighting, and the replay code. Secondary wOBA and FIP results are exploratory because historical queries can use finalized seasonal weights and constants.</p>
  </>,
};
