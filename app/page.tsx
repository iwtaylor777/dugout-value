import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { toolCards } from "./editorial-content";
import { articles, isExplainer, type Article } from "./articles";
import { Publication, SnapshotNotice } from "./site-shell";
import { pageMetadata } from "./seo";

export const metadata: Metadata = pageMetadata({ title: "Dugout Value: Baseball analysis & tools", absoluteTitle: true, description: "Baseball research on pitching, hitting, and projections, plus tools for comparing players, contracts, and trade value.", path: "/" });

function StoryCard({ article }: { article: Article }) {
  return <article className="story-card"><p className="eyebrow">{article.category}</p><h3><Link href={`/analysis/${article.slug}`}>{article.title}</Link></h3><p>{article.summary}</p><span className="story-meta">{article.dateLabel}<span>·</span>{article.readTime}</span></article>;
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const trade = Array.isArray(params.trade) ? params.trade[0] : params.trade;
  if (trade) redirect(`/tools/trade?trade=${encodeURIComponent(trade)}`);
  // The home page leads with the first article marked `featured` and shows that article's own evidence panel.
  const feature = articles.find(article => article.featured && article.featurePanel) ?? articles[0];
  const research = articles.filter(article => article !== feature && !isExplainer(article));
  const explainers = articles.filter(isExplainer);
  return <Publication active="home">
    <section className="home-intro"><p className="eyebrow">Baseball analysis</p><h1>Pitching, hitting,<br/>and player value.</h1><p>Research on pitching, hitting, and projections, alongside tools for comparing contracts and building trades. The articles report the tests and their limits; the trade tools use a July 31, 2026 data snapshot.</p></section>
    <section className="feature-story" aria-labelledby="feature-title"><div className="feature-copy"><p className="eyebrow">Featured research <span>{feature.dateLabel}</span></p><h2 id="feature-title"><Link href={`/analysis/${feature.slug}`}>{feature.title}</Link></h2><p>{feature.summary}</p><div className="story-meta">By {feature.author}<span>·</span>{feature.readTime}</div><Link className="solid-link" href={`/analysis/${feature.slug}`}>Read the research <span aria-hidden="true">↗</span></Link></div>{feature.featurePanel}</section>
    <section className="reading-section" aria-labelledby="research-heading"><div className="section-heading"><h2 id="research-heading">More research</h2><Link href="/analysis">All analysis <span aria-hidden="true">→</span></Link></div><div className="story-grid">{research.map(article => <StoryCard article={article} key={article.slug}/>)}</div></section>
    <section className="reading-section" aria-labelledby="model-heading"><div className="section-heading"><h2 id="model-heading">How to read the trade model</h2><Link href="/methods#trade-model">Methods & data <span aria-hidden="true">→</span></Link></div><div className="story-grid">{explainers.map(article => <StoryCard article={article} key={article.slug}/>)}</div></section>
    <section className="tools-section" aria-labelledby="tools-heading"><div className="section-heading"><div><h2 id="tools-heading">The tools</h2></div><Link href="/tools">All tools →</Link></div><SnapshotNotice/><div className="tool-grid">{toolCards.slice(0, 4).map(tool => <Link className="tool-card" href={tool.href} key={tool.href}><h3>{tool.title}<span aria-hidden="true">↗</span></h3><p>{tool.description}</p></Link>)}</div></section>
    <aside className="editorial-principle"><h2>About the trade estimates</h2><p>The model combines public projections with contract and team-control data. Its default value per win, discount rate, and value ranges are choices you can inspect in the methods notes and change in the trade builder.</p><Link className="text-link" href="/methods">Methods and data →</Link></aside>
  </Publication>;
}
