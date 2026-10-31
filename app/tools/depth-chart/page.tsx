import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata, webPageJsonLd } from "../../seo";
import { JsonLd } from "../../json-ld";
import { Publication } from "../../site-shell";
import { DepthChart } from "./depth-chart";
import { BELOW_AVERAGE_FIELDING } from "../../../lib/depth-chart.mjs";

const title = "Depth charts";
const description = "Build a team's 2027 depth chart from Dugout Value projections, change playing time and rosters, and see how its projected WAR and rank move. Free agents who would add the most are highlighted by position.";
export const metadata: Metadata = pageMetadata({ title, description, path: "/tools/depth-chart" });

export default function DepthChartPage() {
  return <Publication active="tools">
    <JsonLd data={webPageJsonLd({ type: "WebApplication", title, description, path: "/tools/depth-chart" })} />
    <header className="section-intro roster-tool-intro dc-intro"><p className="eyebrow">2027 roster planner</p><h1>Depth charts</h1><p>Build your team’s roster, adjust playing time, and see the effect on projected WAR and payroll.</p><nav className="roster-tool-links" aria-label="Related tools"><Link href="/tools/free-agents">Free-agent tracker</Link><Link href="/tools/trade">Trade builder</Link></nav></header>
    <DepthChart />
    <details className="dv-war-notes roster-method dc-methods">
      <summary>How this works</summary>
      <p><strong>Projections.</strong> Each player’s 2027 WAR rate and expected playing time come from the <Link href="/analysis/our-projections-replace-zips">Dugout Value projections</Link>. Expected playing time is the larger of the model’s estimate and the player’s healthy workload in 2024–26. Players without a Dugout Value projection, mostly rookies, use their ZiPS rate and start at part-time playing time (250 PA, 60 innings as a starter or 40 in relief).</p>
      <p><strong>A 162-game team.</strong> Each lineup spot gets 683 plate appearances (6,150 a team), starters 850 innings and relievers 595. Players fill their own positions in order of projected rate, up to their expected playing time. Hitters with time left move down the defensive spectrum and then to DH, and starters’ spare innings go to the bullpen. Any time no one fills is replacement level, worth zero WAR. A number you type is kept exactly; the × returns that player to the automatic allocation.</p>
      <p><strong>Positions.</strong> Positions come from each player’s listed depth-chart role. Our projection doesn’t estimate defense separately, so I work out how much fielding and positional value each hitter’s projected WAR already includes: his projected rate, less replacement level, his projected hitting (from a wOBA projection made with the same model inputs) and his recent baserunning. When his team lists him somewhere other than the position his projection is based on, he is credited at least as a slightly below-average fielder there, {`${BELOW_AVERAGE_FIELDING}`} runs per 600 PA under average, plus that position’s adjustment. A hitter used at DH keeps no more than a DH’s positional value. Catchers and moves you make to unlisted positions keep the projected rate, because the tool doesn’t estimate fielding at a new position. A tag next to a player shows any change.</p>
      <p><strong>Free agents.</strong> The 2026–27 class is off its old teams unless a club option, opt-out or qualifying offer is expected to keep a player in place. As signings are reported in the <Link href="/tools/free-agents">free-agent tracker</Link>, players move to their new teams here. A free agent’s value is the change in his new team’s total after he takes playing time from the players he’d replace. Contract estimates come from the tracker.</p>
      <p><strong>Payroll.</strong> Payroll figures are <a href="https://www.fangraphs.com/roster-resource/payroll">FanGraphs RosterResource</a> estimates of each team’s luxury-tax (CBT) payroll, checked October 30. They count the average annual value of guaranteed contracts, arbitration salaries, other payments, minor-league salaries for 40-man players, player benefits and the pre-arbitration bonus pool. Official final 2026 figures come out in December. The 2027 estimate uses projected arbitration salaries and leaves out pending options until they are exercised; free agents who sign are added at their contract’s average annual value. Your changes add each player’s 2027 CBT hit (our contract estimate for an unsigned free agent) and subtract anyone you remove. The 2027 tax threshold depends on the next labor agreement.</p>
    </details>
  </Publication>;
}
