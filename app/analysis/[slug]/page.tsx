import type { Metadata } from "next";
import { metaDescription, pageMetadata } from "../../seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articles } from "../../articles";
import { Publication } from "../../site-shell";
import { JsonLd } from "../../json-ld";
import { articleJsonLd, breadcrumbJsonLd } from "../../seo";
export function generateStaticParams() { return articles.map(({slug}) => ({slug})); }
export async function generateMetadata({ params }: { params: Promise<{slug: string}> }): Promise<Metadata> { const {slug} = await params; const article = articles.find(a => a.slug === slug); return article ? pageMetadata({ title: article.title, description: metaDescription(article.summary), path: `/analysis/${slug}`, type: "article", publishedTime: article.published, authors: [article.author] }) : {}; }

const isInternal = (href: string) => href.startsWith("/") && !href.startsWith("/research/") && !href.startsWith("/analysis/shapecast/");

/** Up to three other pieces: the same kind first (research with research, explainers with explainers), then the rest in index order. */
function relatedTo(slug: string) {
  const current = articles.find(a => a.slug === slug);
  const others = articles.filter(a => a.slug !== slug);
  const explainer = (category?: string) => category === "Explainer" || category === "Model guide";
  const same = others.filter(a => explainer(a.category) === explainer(current?.category));
  const rest = others.filter(a => !same.includes(a));
  return [...same, ...rest].slice(0, 3);
}

/** The dated status callout. A leading "Status, October 16, 2026:" becomes the label. */
function StatusNote({ text }: { text: string }) {
  const split = text.indexOf(": ");
  const hasLabel = /^Status\b/.test(text) && split > 0 && split < 60;
  return <div className="article-status" role="note"><p>{hasLabel ? <><strong>{text.slice(0, split + 1)}</strong> {text.slice(split + 2)}</> : text}</p></div>;
}

export default async function ArticlePage({ params }: { params: Promise<{slug: string}> }) {
  const {slug} = await params;
  const article = articles.find(a => a.slug === slug);
  if (!article) notFound();
  const { relatedTool, evidence } = article;
  return <Publication active="analysis"><JsonLd data={[articleJsonLd(article), breadcrumbJsonLd([["Analysis", "/analysis"], [article.title, `/analysis/${slug}`]])]}/><article className="longform"><Link className="back-link" href="/analysis">← All analysis</Link><header><p className="eyebrow">{article.category}</p><h1>{article.title}</h1><p className="article-deck">{article.summary}</p><div className="byline"><span className="author">By {article.author}</span><span>{article.dateLabel}</span><span>{article.readTime}</span></div>{article.status && <StatusNote text={article.status}/>}</header><div className="article-body">{article.body}{(relatedTool || evidence) && <aside className="article-links" aria-label="Related tool and evidence">{relatedTool && <p>{isInternal(relatedTool.href) ? <Link className="text-link" href={relatedTool.href}>{relatedTool.label} →</Link> : <a className="text-link" href={relatedTool.href}>{relatedTool.label} →</a>}</p>}{evidence && <p className="source-line">Evidence: <a href={evidence.href}>{evidence.label}</a></p>}</aside>}</div><aside className="related-reading"><h2>Keep reading</h2>{relatedTo(slug).map(a => <Link key={a.slug} href={`/analysis/${a.slug}`}>{a.title} <span aria-hidden="true">→</span></Link>)}</aside></article></Publication>;
}
