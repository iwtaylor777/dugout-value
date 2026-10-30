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
    <header className="section-intro roster-tool-intro"><p className="eyebrow">2026–27 offseason</p><h1>Free-agent tracker</h1><p>Explore the whole class, compare our contract estimates, and follow the deals as they happen.</p><nav className="roster-tool-links" aria-label="Related tools"><Link href="/tools/depth-chart">Try a signing on your team</Link><DisclosureLink target="tracker-method">How to read this</DisclosureLink></nav></header>
    <FreeAgentTracker />
    <details className="dv-war-notes roster-method" id="tracker-method">
      <summary>How to read the tracker</summary>
      <p><strong>DV WAR</strong> is the Dugout Value projection on a full-season scale: the model’s expected playing time or the player’s healthy workload, whichever is larger. The 2027–31 column adds the five seasons. <strong>fWAR 2026</strong> is FanGraphs WAR for the season just finished. A dash means he didn’t play in the majors. Teruaki Sato’s projection is a separate translation of his NPB record, and four relievers with too few recent innings for our model use ZiPS.</p>
      <p><strong>Our estimate</strong> prices each projected season at $11M per win above a replacement-level allowance, with 20% more for wins above two, 3% annual inflation and a 10% discount rate. The term is capped by projected value and age, and ends when the forecast drops below one win (half a win for relievers). <em>Minimum</em> means the estimate is under $1M a year. These are what the projection says a contract is worth, not a forecast of who signs where.</p>
      <p><strong>Options and opt-outs pending</strong> are players the model expects to stay put: a club option worth less than his projected 2027 value, or an opt-out leaving more guaranteed money than the market would pay. They move to available or signed when the decision is reported. Jake Bauers is listed as expected to accept a qualifying offer.</p>
      <p>The 31 forecasts <Link href="/analysis/what-this-winters-free-agents-should-cost">published on October 29</Link> keep their frozen numbers (revision R2) so we can evaluate them after the winter. Their player notes identify them. Everyone else is recalculated with the current Dugout Value projections as the model updates. The original predictions, pricing code and settings are in <Link href="/research#fa-predictions-2027">the research files</Link>.</p>
    </details>
  </Publication>;
}
