import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata, webPageJsonLd } from "../../seo";
import { JsonLd } from "../../json-ld";
import { Publication } from "../../site-shell";
import { FreeAgentTracker } from "./tracker";
import { DisclosureLink } from "../../disclosure-link";

const title = "Free-agent tracker";
const description = "Every player in the 2026–27 free-agent class with Dugout Value WAR projections, a contract estimate, 2026 fWAR, and the contract he actually signs.";
export const metadata: Metadata = pageMetadata({ title, description, path: "/tools/free-agents" });

export default function FreeAgentsPage() {
  return <Publication active="tools">
    <JsonLd data={webPageJsonLd({ type: "CollectionPage", title, description, path: "/tools/free-agents" })} />
    <header className="section-intro roster-tool-intro"><p className="eyebrow">2026–27 offseason</p><h1>Free-agent tracker</h1><p>Compare current DV values with public market forecasts, and follow the deals as they happen.</p><nav className="roster-tool-links" aria-label="Related tools"><Link href="/tools/depth-chart">Try a signing on your team</Link><DisclosureLink target="tracker-method">How to read this</DisclosureLink></nav></header>
    <FreeAgentTracker />
    <details className="dv-war-notes roster-method" id="tracker-method">
      <summary>How to read the tracker</summary>
      <p><strong>DV WAR</strong> is the Dugout Value projection on a full-season scale: the model’s expected playing time or the player’s healthy workload, whichever is larger. The 2027–31 column adds the five seasons. <strong>fWAR 2026</strong> is FanGraphs WAR for the season just finished. A dash means he didn’t play in the majors. Teruaki Sato’s projection is a separate translation of his NPB record, and four relievers with too few recent innings for our model use ZiPS.</p>
      <p><strong>Model value</strong> prices the current production forecast over the term shown: $11M per win after a roster allowance (0.5 WAR for hitters and starters, 0.2 for relievers), a 20% premium above two net wins, 3% annual inflation and 10% discounting. Relievers above 0.8 WAR receive a 50% premium. Where public forecasts exist, the comparison term matches the displayed forecast; otherwise it is the previously selected comparison term. Updating WAR does not change that commitment. <em>Minimum</em> means the modeled annual value is under $1M.</p>
      <p><strong>Market forecasts</strong> are published contract predictions from MLB Trade Rumors, FanGraphs’ Ben Clemens and the FanGraphs crowd. Open Sources to see each estimate and its term. The column shows MLB Trade Rumors where covered, otherwise FanGraphs’ writer estimate. A dash means no covered public forecast.</p>
      <p><strong>Options and opt-outs pending</strong> are players the model expects to stay put: a club option worth less than his projected 2027 value, or an opt-out leaving more guaranteed money than the market would pay. They move to available or signed when the decision is reported.</p>
      <p><strong>QO pending</strong> marks a player who received a qualifying offer and hasn’t answered yet. He has until the date shown to accept the one-year offer. Jake Bauers is the one recipient we expect to accept.</p>
      <p>Every production value and five-year WAR total uses the current forecast. The 31 original October 29 predictions remain in player notes and <Link href="/research#fa-predictions-2027">the research files</Link> for scoring; they do not replace the current values. <Link href="/analysis/what-this-winters-free-agents-should-cost">Read the valuation method</Link>.</p>
    </details>
  </Publication>;
}
