import type { Metadata } from "next";
import { pageMetadata } from "../../seo";
import { notFound } from "next/navigation";
import TradeWorkspace from "../../trade-workspace";
import { Publication } from "../../site-shell";
import { JsonLd } from "../../json-ld";
import { breadcrumbJsonLd, toolJsonLd } from "../../seo";
const views = { trade: { tab: "trade", title: "Trade builder", description: "Build trades using player projections, salaries, and contract years." }, finder: { tab: "discover", title: "Trade finder", description: "Explore roster needs and potential offers using the reviewed roster and projection data." }, projections: { tab: "projections", title: "Player projections", description: "Explore fWAR projections and their sources." }, rankings: { tab: "rankings", title: "Value rankings", description: "Compare projected player value after salary, with adjustable win prices and discount rates." } } as const;
function viewFor(tool: string) { return views[tool as keyof typeof views]; }
export function generateStaticParams() { return Object.keys(views).map(tool => ({tool})); }
export async function generateMetadata({ params }: { params: Promise<{tool: string}> }): Promise<Metadata> { const {tool} = await params; const view = viewFor(tool); return view ? pageMetadata({ title: view.title, description: view.description, path: `/tools/${tool}` }) : {}; }
export default async function ToolPage({ params }: { params: Promise<{tool: string}> }) { const {tool} = await params; const view = viewFor(tool); if (!view) notFound(); return <Publication active="tools"><JsonLd data={[toolJsonLd({ title: view.title, description: view.description, path: `/tools/${tool}` }), breadcrumbJsonLd([["Tools", "/tools"], [view.title, `/tools/${tool}`]])]}/><TradeWorkspace initialTab={view.tab}/></Publication>; }
