import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata, webPageJsonLd } from "../seo";
import { JsonLd } from "../json-ld";
import { Publication } from "../site-shell";
import { getProfile, modelContext, money, profiles } from "./profiles";

export const metadata: Metadata = pageMetadata({ title: "Player case studies", description: "Three examples showing how options, salaries, and projection horizon affect the trade model’s estimates.", path: "/players" });

export default function Players() {
  return <Publication><JsonLd data={webPageJsonLd({ type: "CollectionPage", title: "Player case studies", description: "Examples showing how options, salaries, and projection horizon affect the trade model’s estimates.", path: "/players" })}/><header className="section-intro"><h1>Player case studies</h1><p>Three examples of what drives the trade model’s estimates: Soto’s opt-out, McGonigle’s long projection horizon, and Judge’s remaining salary. Values use player data from July 31, 2026 and model version {modelContext.modelVersion}.</p></header><div className="article-index">{profiles.map(profile => { const entry = getProfile(profile.id); if (!entry) return null; return <article key={profile.id}><div><h2><Link href={`/players/${profile.id}`}>{profile.name}</Link></h2><p>{profile.deck}</p><p className="story-meta">Default offseason estimate: {money(entry.estimate.total)} · 2027 onward</p></div><Link className="index-arrow" href={`/players/${profile.id}`} aria-label={`Read ${profile.name} case study`}>↗</Link></article>; })}</div><aside className="editorial-principle"><p>The model’s dollar values have not been validated against actual trade prices. Each page names the inputs that drive its example.</p><Link className="text-link" href="/methods">Read the methods →</Link></aside></Publication>;
}
