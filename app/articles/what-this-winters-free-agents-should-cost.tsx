import Link from "next/link";
import type { Article } from "./types";
import { AUTHOR } from "./types";
import current from "../data/free-agent-tracker.json";

type Valuation = { id: string; name: string; pos: string; age: number; war2027: number; years: number; total: number; aav: number; publishedForecast?: unknown; marketForecast?: { reference: { label: string; years: number; total: number; url: string } } | null };
const predictions = (current.players as Valuation[]).filter(p => p.publishedForecast).sort((a, b) => b.total - a.total);
const money = (m: number) => `$${m.toFixed(1)}M`;
const value = (id: string) => predictions.find(p => p.id === id)!;
const suzuki = value("mlb-673548"), rogers = value("mlb-669432");

export const article: Article = {
  slug: "what-this-winters-free-agents-should-cost",
  category: "Research",
  title: "What this winter’s free agents are worth",
  summary: "I use current DV projections to value each player’s production over a stated contract term, then compare it with published market forecasts. A valuation and an expected winning bid answer different questions.",
  author: AUTHOR,
  published: "2026-10-25",
  dateLabel: "October 25, 2026 · Updated November 6",
  status: "Current production values updated November 6, 2026. Public market forecasts captured the same day; the original October 29 predictions remain available for scoring.",
  readTime: "5 min read",
  relatedTool: { href: "/tools/free-agents", label: "Compare the full free-agent class" },
  evidence: { href: "/research/fa-market-2026-11-06/README.md", label: "Market-model tests and valuation checks" },
  body: (
    <>
      <p className="article-lead">A player can be worth one amount under a production model and sign for another. I use my current DV projections to estimate the value of his future wins, and show public contract forecasts alongside that valuation. That makes the disagreement visible: how much comes from the player forecast, and how much comes from the price of buying those seasons?</p>

      <h2>What the numbers mean</h2>
      <p><strong>Model value</strong> is the flat guaranteed contract with the same discounted value as the player’s projected production over the term shown. <strong>Market forecast</strong> is a published expectation of the deal he will sign. The table shows MLB Trade Rumors where available, otherwise FanGraphs’ writer estimate; the <Link href="/tools/free-agents">tracker</Link> also includes the FanGraphs crowd and links to every source.</p>
      <p>The comparison term is fixed separately from the WAR forecast. Where public estimates are available, I use the term in the displayed market forecast. Elsewhere, I retain a stated comparison term. A small change in projected WAR changes the value of those seasons without automatically adding years to the commitment. It does not imply that every player will receive that exact term.</p>
      <p>Prices start at $11 million per win after a roster allowance: 0.5 WAR for hitters and starters, 0.2 for relievers. Net wins above two receive a 20% premium. Relievers projected above 0.8 WAR receive a 50% premium. Prices grow 3% annually, and future production is discounted at 10%. Posting fees and qualifying-offer acquisition costs are not deducted, so they can reduce the contract a club should offer below the quoted production value.</p>

      <h2>Current values</h2>
      <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Current free-agent production values and public market forecasts"><table><caption>Current valuations for the 31 players in the original published list, reordered by model value. Updated November 6, 2026. Dollars are millions; ages are for 2027. Public forecasts may use a different term.</caption><thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Pos</th><th scope="col">Age</th><th scope="col">2027 WAR</th><th scope="col">Comparison years</th><th scope="col">Model value</th><th scope="col">Public forecast</th></tr></thead><tbody>
        {predictions.map((p, i) => <tr key={p.id}><td className="num">{i + 1}</td><th scope="row">{p.name}</th><td>{p.pos}</td><td className="num">{p.age}</td><td className="num">{p.war2027.toFixed(2)}</td><td className="num">{p.years}</td><td className="num">{money(p.total)}</td><td className="num">{p.marketForecast ? <a href={p.marketForecast.reference.url} title={p.marketForecast.reference.label}>{p.marketForecast.reference.years} yrs / {money(p.marketForecast.reference.total)}</a> : "—"}</td></tr>)}
      </tbody></table></div>

      <h2>Two different kinds of disagreement</h2>
      <p>Seiya Suzuki projects for {suzuki.war2027.toFixed(2)} WAR in 2027, almost the same as the 2.7 WAR in the <a href="https://blogs.fangraphs.com/2027-top-50-free-agents/">Steamer forecast accompanying FanGraphs’ list</a>. My valuation is {money(suzuki.total)} over {suzuki.years} years. MLB Trade Rumors projects four years and $105 million. The first-year performance forecasts are close; most of that gap concerns the price teams will pay and the value of the remaining seasons.</p>
      <p>Trevor Rogers presents a different question. DV projects {rogers.war2027.toFixed(2)} WAR in 160 innings; the same public comparison gives 3.2 WAR in 175. My value is {money(rogers.total)} over {rogers.years} years, while MLB Trade Rumors projects five years and $115 million. If I raise his first-year WAR to 3.2 and carry that rate increment through the same DV workload path, four years of production prices at about $111 million. That is a sensitivity calculation, not a published multi-year Steamer forecast or evidence that either player forecast is correct.</p>

      <h2>The production forecast</h2>
      <p>The valuations use <Link href="/analysis/our-projections-replace-zips">DV Projections</Link> through the completed 2026 season. The models combine results, contact quality, plate discipline, pitching traits, age and player history. WAR rate and workload are estimated separately. Five-year paths blend horizon-specific models with a historical aging curve and are smoothed; later seasons follow fixed age and workload curves. The tracker adds the full five seasons in its 2027–31 column, regardless of the comparison contract’s length.</p>
      <p>For valuation I use a full-season workload: the expected playing time or the player’s recent healthy workload, whichever is larger. It describes what that production would be worth on that scale, rather than precisely predicting each future injury. Teruaki Sato retains a separate NPB translation based on a small historical comparison group; players outside DV coverage retain their separately identified baseline.</p>

      <h2>What the comparison can establish</h2>
      <p>The price scale and role premiums were calibrated against past free-agent pay. That does not establish a superior forecast of contract length, every player’s market, or a club’s willingness to pay. A reliable bat in a thin class, a pitcher’s restored health, a closing track record, an opt-out or a particular team’s needs can change the winning offer.</p>
      <p>I test market-contract methods separately from player projections, scoring guaranteed total, annual salary and years. A method that fits ordinary contracts better but underprices the largest deals is not enough to justify replacing the market forecast. The <a href="/research#fa-market-2026-11-06">research files</a> report those tests and their limitations. The public estimates here remain attributed to their publishers.</p>

      <h2>The dated prediction record</h2>
      <p>The <a href="/research/fa-predictions-2026-27/predictions_frozen.csv">original October 29 forecasts</a> remain unchanged. I will score those predictions against guaranteed MLB deals through Opening Day 2027, with errors in total value, annual salary and years reported separately. Players who remain under contract, accept qualifying offers, retire or do not sign guaranteed MLB deals are handled separately. Current valuations and later public forecasts do not replace the dated prediction record.</p>
    </>
  ),
};
