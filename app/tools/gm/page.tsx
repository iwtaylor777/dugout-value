import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata, webPageJsonLd } from "../../seo";
import { JsonLd } from "../../json-ld";
import { Publication } from "../../site-shell";
import { GmMode } from "./gm-mode";

const title = "GM mode";
const description = "Run a team's 2026–27 offseason: set a budget, sign free agents, make trades other teams would actually accept, then simulate the 2027 season 10,000 times.";
export const metadata: Metadata = pageMetadata({ title, description, path: "/tools/gm" });

export default function GmPage() {
  return <Publication active="tools">
    <JsonLd data={webPageJsonLd({ type: "WebApplication", title, description, path: "/tools/gm" })} />
    <header className="section-intro"><p className="eyebrow">2026–27 offseason</p><h1>GM mode</h1><p>Take over a team, set the budget, and build your 2027 roster. Sign free agents and make trades, then the rest of the league fills its needs and the season is played 10,000 times. You’ll see how your moves changed the team’s odds compared with standing pat.</p></header>
    <GmMode />
    <details className="dv-war-notes roster-method">
      <summary>How the simulation works</summary>
      <p><strong>Rosters and WAR.</strong> Teams start from the <Link href="/tools/depth-chart">depth chart</Link>, with free agents off their old teams and reported signings and option decisions applied. Team WAR uses the same playing-time and position rules.</p>
      <p><strong>Free agents.</strong> Every free agent has a private asking price, usually a bit above our <Link href="/tools/free-agents">contract estimate</Link>, and wants a term within a year of the length we estimate. Your ownership won’t approve a signing that puts the 2027 luxury-tax payroll over your budget. When you simulate, the other 29 teams sign the remaining free agents, most expensive first. Each player goes to the team that gains the most wins per dollar and can afford him.</p>
      <p><strong>Trades.</strong> Other teams value players with our trade model’s surplus value. Projected contenders weigh 2027 most (a 20% discount rate), teams projected to miss the playoffs weigh the future (5%), and the rest use the market default (10%). They need to come out ahead, ask about 50% more for either of their two most valuable players, honor full no-trade clauses, and won’t take on salary past their own budget. Players you just signed can’t be traded.</p>
      <p><strong>The season.</strong> A team’s expected wins are 81 plus its projected WAR above the league average. Each simulated season adds uncertainty for every player’s performance and playing time, plus team-level luck. That totals about 7 wins of spread, similar to the errors of preseason team projections. Twelve teams make the playoffs: three division winners and three wild cards in each league, with byes for the top two division winners. Series winners are drawn from each team’s simulated strength. Your moves and standing pat are compared on the same 10,000 simulated seasons.</p>
      <p><strong>The grade</strong> adds the wins your moves gained in 2027 to the future value they created or gave up, counting about $25M of value per win. Signing a player for less than our estimate adds value; trading away surplus costs it.</p>
    </details>
  </Publication>;
}
