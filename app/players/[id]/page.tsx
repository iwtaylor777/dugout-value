import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { breadcrumbJsonLd, metaDescription, pageMetadata, webPageJsonLd } from "../../seo";
import { JsonLd } from "../../json-ld";
import { Publication } from "../../site-shell";
import { getProfile, modelContext, money, percent, profiles, sotoOptionValues } from "../profiles";

export function generateStaticParams() { return profiles.map(profile => ({ id: profile.id })); }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const entry = getProfile(id);
  return entry ? pageMetadata({ title: `${entry.profile.name}: model case study`, description: metaDescription(entry.profile.deck), path: `/players/${id}` }) : {};
}

export default async function PlayerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = getProfile(id);
  if (!entry) notFound();
  const { profile, estimate } = entry;
  const sotoPaths = id === "mlb-665742" ? sotoOptionValues() : null;
  return <Publication><JsonLd data={[webPageJsonLd({ type: "ProfilePage", title: `${profile.name}: model case study`, description: profile.deck, path: `/players/${id}`, about: { "@type": "Person", name: profile.name, ...(id.startsWith("mlb-") ? { identifier: `MLBAM:${id.slice(4)}` } : {}) } }), breadcrumbJsonLd([["Player case studies", "/players"], [profile.name, `/players/${id}`]])]}/><article className="longform"><Link className="back-link" href="/players">← Player case studies</Link><header><h1>{profile.name}</h1><p className="article-deck">{profile.deck}</p><div className="story-meta">{modelContext.playerDataAsOf} player data · Model {modelContext.modelVersion} · Offseason view, 2027 onward</div></header><div className="article-body"><p className="article-lead">The default model estimates {money(estimate.total)} in surplus value from 2027 onward, with a sensitivity range of {money(estimate.low)} to {money(estimate.high)}. The range comes from model assumptions; it is not a measured trade-price interval.</p>
    {id === "mlb-665742" && sotoPaths && <>
      <h2>The opt-out changes the answer</h2><p>Soto can leave after 2029, while the Mets can void his opt-out by adding $40 million to the final ten years of his deal. The model treats 2030–39 as one option block. With the same projections and settings, his total remaining value changes by path:</p>
      <ul><li><strong>Default player option:</strong> {money(sotoPaths.option.total)} through 2039.</li><li><strong>Soto leaves after 2029:</strong> {money(sotoPaths.walks.total)} through 2029.</li><li><strong>Mets void the opt-out:</strong> {money(sotoPaths.voided.total)} through 2039.</li></ul>
      <p>These are contract scenarios rather than forecasts of either side’s decision. The model’s annual salary inputs allocate contract cost for its calculation; they do not reproduce the full cash schedule.</p>
      <p><Link href="/ledger/soto-mets-contract-2024">See the dated contract record and sources</Link>.</p>
    </>}
    {id === "mlb-805808" && <>
      <h2>The long horizon matters</h2><p>The model counts {estimate.totalWar?.toFixed(1)} projected wins through {estimate.controlThrough} and {money(estimate.totalSalary ?? 0)} in modeled salary over those years. Its estimate includes {money(estimate.extrapolatedValue)} from seasons after the {entry.player.agingModel?.anchorYear} projection anchor, about {percent(estimate.extrapolatedShare ?? 0)} of the total. Those later years come from an aging model, so the ranking depends heavily on how that extension holds up.</p>
      <p>McGonigle’s modeled salary and long team control raise his estimate. The later projection years are a large source of uncertainty in that figure.</p>
    </>}
    {id === "mlb-592450" && <>
      <h2>Salary offsets the projection</h2><p>The model counts {estimate.totalWar?.toFixed(1)} projected wins through {estimate.controlThrough}, alongside {money(estimate.totalSalary ?? 0)} in remaining modeled salary. Judge’s production still has substantial modeled market value, but the salary absorbs most of it in the surplus calculation.</p>
      <p>The result follows directly from the model’s use of projected wins minus salary. It is a surplus-value estimate, not a measure of Judge’s importance to the Yankees.</p>
    </>}
    <p><Link href="/tools/trade">Open the trade builder</Link> to change the projection, contract, or model settings. <Link href="/analysis/what-trade-value-measures">Read what trade value measures</Link>.</p>
    <p className="source-line">Player database: {modelContext.playerDataAsOf}. Model version {modelContext.modelVersion}. Public projections and contract sources are listed in <Link href="/methods#data">Methods &amp; data</Link>.</p>
  </div></article></Publication>;
}
