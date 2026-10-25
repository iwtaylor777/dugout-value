import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ledger from "../../data/ledger.json";
import { breadcrumbJsonLd, metaDescription, pageMetadata, webPageJsonLd } from "../../seo";
import { JsonLd } from "../../json-ld";
import { Publication } from "../../site-shell";

const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export function generateStaticParams() { return ledger.records.map(record => ({ slug: record.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const record = ledger.records.find(item => item.slug === slug);
  return record ? pageMetadata({ title: record.title, description: metaDescription(record.summary), path: `/ledger/${slug}` }) : {};
}

export default async function LedgerEntry({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = ledger.records.find(item => item.slug === slug);
  if (!record) notFound();
  return <Publication><JsonLd data={[webPageJsonLd({ type: "Article", title: record.title, description: record.summary, path: `/ledger/${slug}`, datePublished: ledger.capturedAt }), breadcrumbJsonLd([["Transaction ledger", "/ledger"], [record.title, `/ledger/${slug}`]])]}/><article className="longform"><Link className="back-link" href="/ledger">← Transaction ledger</Link><header><p className="story-meta">{dateLabel(record.date)} · {record.kind === "trade" ? "Trade" : "Contract"}</p><h1>{record.title}</h1><p className="article-deck">{record.summary}</p></header><div className="article-body">
    {record.kind === "trade" ? <>
      <h2>Recorded exchange</h2><p><strong>Boston sent:</strong> Rafael Devers to San Francisco.</p><p><strong>San Francisco sent:</strong> Jordan Hicks, Kyle Harrison, James Tibbs III, and Jose Bello to Boston.</p>
      <p>The transaction log dates the move June 15; the Red Sox announcement followed June 16. The names and teams above are those at the time of the trade. Several players had changed clubs by the July 2026 data snapshot, which makes a sum of their current values misleading as a 2025 trade estimate.</p>
    </> : <>
      <h2>Recorded terms</h2><p>The Mets finalized a 15-year, $765 million contract with Soto on December 11, 2024. He can opt out after the 2029 season. The Mets can void that opt-out by raising the final ten years by $4 million a year, or $40 million in total.</p>
      <p><Link href="/players/mlb-665742">Soto’s player profile</Link> compares the option paths using the July 31, 2026 data snapshot and model version {ledger.modelVersion}.</p>
    </>}
    <h2>Sources</h2><ul>{record.sources.map(source => <li key={source.url}><a href={source.url}>{source.label}</a></li>)}</ul>
    <p className="source-line">Recorded {dateLabel(ledger.capturedAt)} · Player data {dateLabel(ledger.playerDataAsOf)} · Model {ledger.modelVersion}.</p>
  </div></article></Publication>;
}
