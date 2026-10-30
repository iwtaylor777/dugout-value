import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata, webPageJsonLd } from "../../seo";
import { JsonLd } from "../../json-ld";
import { Publication } from "../../site-shell";
import { DepthChart } from "./depth-chart";

const title = "Depth charts";
const description = "Build a team's 2027 depth chart from Dugout Value projections, change playing time and rosters, and see how its projected WAR and rank move. Free agents who would add the most are highlighted by position.";
export const metadata: Metadata = pageMetadata({ title, description, path: "/tools/depth-chart" });

export default function DepthChartPage() {
  return <Publication active="tools">
    <JsonLd data={webPageJsonLd({ type: "WebApplication", title, description, path: "/tools/depth-chart" })} />
    <header className="section-intro"><p className="eyebrow">Dugout Value tools</p><h1>Depth charts</h1><p>Pick a team to see its 2027 depth chart and projected WAR. Change anyone’s playing time, move players between positions, add players from other teams or the free-agent market, and watch the team’s total and rank update. The free agents who would add the most to that roster are listed beside it and under each position.</p></header>
    <DepthChart />
    <div className="dv-war-notes">
      <h2>How it works</h2>
      <p><strong>Projections.</strong> Each player’s 2027 WAR rate and expected playing time come from the <Link href="/analysis/our-projections-replace-zips">Dugout Value projections</Link>. Expected playing time is the larger of the model’s estimate and the player’s healthy workload in 2024–26. Players without a Dugout Value projection, mostly rookies, use their ZiPS rate and start at part-time playing time (250 PA, 60 innings as a starter or 40 in relief).</p>
      <p><strong>A 162-game team.</strong> Each lineup spot gets 683 plate appearances (6,150 a team), starters 850 innings and relievers 595. Players fill their own positions in order of projected rate, up to their expected playing time. Hitters with time left move down the defensive spectrum and then to DH, and starters’ spare innings go to the bullpen. Any time no one fills is replacement level, worth zero WAR. A number you type is kept exactly; the × returns that player to the automatic allocation.</p>
      <p><strong>Positions.</strong> Positions come from each player’s listed depth-chart role. A hitter moved to DH loses the difference in positional adjustment. Other moves keep his projected rate, so the tool doesn’t estimate how well he would field a new position.</p>
      <p><strong>Free agents.</strong> The 2026–27 class is off its old teams unless a club option, opt-out or qualifying offer is expected to keep a player in place. As signings are reported in the <Link href="/tools/free-agents">free-agent tracker</Link>, players move to their new teams here. A free agent’s value is the change in his new team’s total after he takes playing time from the players he’d replace. Contract estimates come from the tracker.</p>
      <p><strong>Payroll.</strong> The 2026 CBT payroll is <a href="https://www.spotrac.com/mlb/payroll/">Spotrac’s estimate</a>, checked October 30, of each team’s luxury-tax payroll: the average annual value of its 40-man contracts plus retained salary, minor-league salaries and player benefits. The official final figures come out in December. The 2027 numbers are salaries, not CBT values. “Under contract” is guaranteed 2027 salary plus the options our tracker expects to be picked up or kept. Projected payroll adds the site’s arbitration and pre-arbitration salary estimates for players under team control. Your changes add each player’s 2027 salary, using our contract estimate for free agents (or his actual average salary once he signs), and subtract anyone you remove. The 2027 tax threshold depends on the next labor agreement.</p>
    </div>
  </Publication>;
}
