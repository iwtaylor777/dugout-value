import type { Metadata } from "next";
import Link from "next/link";
import ledger from "../data/ledger.json";
import { pageMetadata, webPageJsonLd } from "../seo";
import { JsonLd } from "../json-ld";
import { Publication } from "../site-shell";

export const metadata: Metadata = pageMetadata({ title: "Transaction ledger", description: "Two sourced baseball transactions with their original terms and dates. Retrospective records captured October 17, 2026.", path: "/ledger" });

const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function Ledger() {
  return <Publication><JsonLd data={webPageJsonLd({ type: "CollectionPage", title: "Transaction ledger", description: "Sourced baseball transactions with their original terms and dates.", path: "/ledger" })}/><header className="section-intro"><h1>Transaction ledger</h1><p>Two historical moves, recorded from team and MLB sources on {dateLabel(ledger.capturedAt)}. The transaction details are dated to the moves themselves.</p></header><div className="article-index">{ledger.records.map(record => <article key={record.slug}><div><p className="story-meta">{dateLabel(record.date)} · {record.kind === "trade" ? "Trade" : "Contract"}</p><h2><Link href={`/ledger/${record.slug}`}>{record.title}</Link></h2><p>{record.summary}</p></div><Link className="index-arrow" href={`/ledger/${record.slug}`} aria-label={`Read ${record.title}`}>↗</Link></article>)}</div><aside className="editorial-principle"><h2>Dates and estimates</h2><p>The player database was refreshed July 31, 2026, and model version {ledger.modelVersion} was captured October 17, 2026. The ledger records the historical terms without assigning a trade-date model value or a winner.</p><Link className="text-link" href="/methods">Read the methods →</Link></aside></Publication>;
}
