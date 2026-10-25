import Link from "next/link";
import report from "../../public/research/projection-baselines-2026-10-20/results.json";
import type { Article } from "./types";
import { AUTHOR } from "./types";

const rateRows = [
  { key: "2024-apr-dc-bat", label: "Depth Charts hitters, April 10, 2024", endpoint: "K%" },
  { key: "2025-dc-bat", label: "Depth Charts hitters, June 1, 2025", endpoint: "K%" },
  { key: "2025-bat", label: "ZiPS hitters, July 31, 2025", endpoint: "K%" },
  { key: "2024-pit", label: "ZiPS pitchers, June 21, 2024", endpoint: "K-BB%" },
  { key: "2025-pit", label: "ZiPS pitchers, June 24, 2025", endpoint: "K-BB%" },
] as const;
const workKeys = ["2024-apr-dc-bat", "2025-dc-bat"] as const;
const fixed = (x: number) => x.toFixed(1);
const dc24 = report.scores["2024-apr-dc-bat"].workload;
const dc25 = report.scores["2025-dc-bat"].workload;
const newcomers = dc25.groups.no_prior_mlb;
const pit24 = report.scores["2024-pit"].rates["K-BB%"].comparisons.multiyear_vs_archived;
const pit25 = report.scores["2025-pit"].rates["K-BB%"].comparisons.multiyear_vs_archived;

export const article: Article = {
  slug: "prior-seasons-and-projection-baselines",
  category: "Research note",
  title: "Prior seasons narrow the gap with ZiPS",
  summary: "Adding three seasons of MLB history brings a simple strikeout-minus-walk forecast close to ZiPS in two pitcher samples. It does much less for playing time, where Depth Charts still has a clear advantage.",
  author: AUTHOR,
  published: "2026-10-21",
  dateLabel: "October 21, 2026",
  readTime: "6 min read",
  evidence: { href: "/research#projection-baselines", label: "Historical counts, results, and replay code" },
  body: <>
    <p className="article-lead">A forecast built from a few weeks of results is a low bar for an established projection system. My <Link href="/analysis/projection-rates-and-playing-time">first benchmark</Link> gave the baseline only the current season. Adding older MLB results makes that comparison more useful, particularly for pitchers.</p>
    <p>The new baseline finishes close to ZiPS on pitcher strikeout-minus-walk rate in both samples. The archived hitter forecasts still do better. Playing time is a separate problem: averaging past workloads misses badly on some players who are just reaching the majors.</p>

    <h2>What older seasons add</h2>
    <p>The rate baseline combines current-season event counts with the previous three seasons. The weights are 1, 0.8, 0.6 and 0.4, from newest to oldest, plus 200 opportunities at the league rate. A season with 600 PA contributes more than one with 60 PA. The weights were fixed before this comparison was scored.</p>
    <p>This is a simple MLB-only estimate. It has no aging curve or minor-league translations and is not <a href="https://tangotiger.net/marcel/">Marcel</a>. It uses the same five forecast lists and remaining-season outcomes as the first benchmark, so these remain retrospective development results.</p>
    <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Rate errors with and without prior seasons"><table style={{ minWidth: 760 }}>
      <caption>Rate RMSE in percentage points; lower is better</caption>
      <thead><tr><th scope="col" style={{ minWidth: 180 }}>Forecast</th><th scope="col">Rate</th><th scope="col">Archived projection</th><th scope="col">Current-season baseline</th><th scope="col">Multi-season baseline</th></tr></thead>
      <tbody>{rateRows.map(row => {
        const rates = report.scores[row.key].rates;
        const s = "K%" in rates ? rates["K%"] : rates["K-BB%"];
        return <tr key={row.key}><th scope="row">{row.label}</th><td>{row.endpoint}</td><td>{(100 * s.metrics.archived.rmse).toFixed(2)}</td><td>{(100 * s.metrics.current_prior.rmse).toFixed(2)}</td><td>{(100 * s.metrics.multiyear.rmse).toFixed(2)}</td></tr>;
      })}</tbody>
    </table></div>
    <p>Adding older seasons lowers error relative to the current-season baseline in all five primary rate comparisons. The biggest change is in April 2024, when current-season results contain little information. Even there, Depth Charts retains an advantage over the new baseline.</p>
    <p>For pitchers, the multi-season estimate has slightly lower error than ZiPS, but neither difference is clear enough to call a win. Its relative advantage is {fixed(pit24.rmse_reduction_pct)}% in 2024, with a 95% interval from {fixed(-pit24.interval95_pct[0])}% worse to {fixed(pit24.interval95_pct[1])}% better, and {fixed(pit25.rmse_reduction_pct)}% in 2025, from {fixed(-pit25.interval95_pct[0])}% worse to {fixed(pit25.interval95_pct[1])}% better. Two midseason samples cannot establish that this recipe matches ZiPS more generally.</p>
    <p>Each player’s rate error is weighted by his actual later PA or batters faced. Pitcher K−BB% includes intentional walks. Players with no later opportunities have no observed rate; they remain in the playing-time scores below. The download also reports hitter walk rates.</p>

    <h2>Past workload is less helpful</h2>
    <p>I added two playing-time estimates. One extends current workload using league-average team games played instead of calendar days. The other blends that pace with three previous seasons, giving more weight to recent years. It counts missing seasons as zero and gives current-season pace half the total weight when the league averages 81 games per team. Neither estimate knows a player’s role or injury status.</p>
    <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Playing-time errors with stronger baselines"><table style={{ minWidth: 650 }}>
      <caption>Rest-of-season PA RMSE; lower is better</caption>
      <thead><tr><th scope="col">Depth Charts date</th><th scope="col">Players</th><th scope="col">Depth Charts</th><th scope="col">Calendar pace</th><th scope="col">Games pace</th><th scope="col">Multi-season</th></tr></thead>
      <tbody>{workKeys.map(key => { const m = report.scores[key].workload.metrics; return <tr key={key}><th scope="row">{key.startsWith("2024") ? "April 10, 2024" : "June 1, 2025"}</th><td>{m.archived.n}</td><td>{fixed(m.archived.rmse)}</td><td>{fixed(m.calendar.rmse)}</td><td>{fixed(m.games.rmse)}</td><td>{fixed(m.multiyear.rmse)}</td></tr>; })}</tbody>
    </table></div>
    <p>The multi-season estimate barely improves on calendar pace in 2024 and has more error in 2025. Depth Charts beats it by {fixed(dc24.comparisons.archived_vs_multiyear.rmse_reduction_pct)}% and {fixed(dc25.comparisons.archived_vs_multiyear.rmse_reduction_pct)}%, respectively. The 95% intervals are 5.0% to 18.3% and 13.6% to 24.5% in Depth Charts’ favor. Changing the clock from days to games does not, by itself, improve these forecasts.</p>
    <p>These scores retain every resolved player, including 48 with no later PA in 2024 and 77 in 2025. The same 16 unresolved prospect identities remain excluded from the 2024 list; their forecasts total 554 PA. Basic ZiPS workload is not a roster-based playing-time forecast and does not enter this table.</p>

    <h2>Where the workload estimate falls short</h2>
    <p>The June 2025 list contains {newcomers.n} hitters with no MLB PA in the preceding three seasons. They averaged {fixed(newcomers.mean_actual)} PA after the forecast. The multi-season estimate underpredicted them by {fixed(-newcomers.metrics.multiyear.bias)} PA on average; Depth Charts underpredicted them by {fixed(-newcomers.metrics.archived.bias)}. Their RMSE was {fixed(newcomers.metrics.multiyear.rmse)} PA for the baseline and {fixed(newcomers.metrics.archived.rmse)} for Depth Charts.</p>
    <p>That weakness follows from the formula: missing MLB seasons pull the forecast toward zero, even when a hitter is about to win a job. Historical MLB workload alone cannot tell us much about an arriving prospect’s opportunity.</p>
    <p>Dated active rosters provide another way to examine the misses. In June 2025, Depth Charts has lower error both for the 389 hitters on an active roster and the 223 who were absent from all 30 active rosters. Simply knowing who is active does not show how to turn that information into a better forecast.</p>
    <p>These roster lists were reconstructed by MLB’s API when retrieved in October 2026. Selected Boston transactions and Juan Soto’s Yankees-to-Mets move agree with the dated responses, but those checks do not validate every player. An absent player could be injured, in the minors or out of affiliated baseball. I used the lists to describe errors, without applying an active-roster bonus or penalty.</p>

    <h2>The next playing-time test</h2>
    <p><strong>Follow-up, October 21:</strong> The <Link href="/analysis/minor-league-history-and-mlb-opportunity">roster and minor-league test</Link> is now available. Those inputs improve the simple model’s probability forecasts; Depth Charts still predicts total PA more accurately.</p>
    <p>The useful next question is whether dated roster and minor-league information can improve forecasts for players with little MLB history. I would start by estimating the chance that a player receives any MLB playing time, then his workload if he does. That separates a missed promotion from an underestimate of an established regular’s playing time.</p>
    <p>The first comparison should keep these fixed baselines and the same Depth Charts forecasts. It should report the chance of zero PA as well as workload error, with separate results for players with and without prior MLB work. Any choices made using 2024–25 results would need a later, untouched test before being used in the trade model.</p>
    <p>The <Link href="/research#projection-baselines">research download</Link> includes normalized historical counts, the formulas, every scored player and an offline replay. Its intervals use 5,000 paired resamples within each forecast list. Source dates follow the first benchmark, including the unscored June 23, 2025 gap; older season totals may reflect later scoring corrections. This study does not change Dugout Value’s trade estimates.</p>
  </>,
};
