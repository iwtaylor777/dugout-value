import { articles, isExplainer } from "../articles";
import { toolCards } from "../editorial-content";
import { SITE_URL } from "../seo";

export const dynamic = "force-static";

/**
 * /llms.txt: a plain-text guide to the site for language-model tools and answer engines (llmstxt.org format).
 * Built from the same article and tool lists as the pages, so it can't drift from them.
 */
export function GET() {
  const line = (title: string, url: string, note: string) => `- [${title}](${url}): ${note}`;
  const research = articles.filter(a => !isExplainer(a));
  const guides = articles.filter(isExplainer);
  const text = [
    "# Dugout Value",
    "",
    "> Independent baseball research by Ian Taylor, plus free tools for player projections, contracts and trade value. Research pieces state their tests in advance where possible, publish failed tests alongside successes, and link the data and code needed to check them.",
    "",
    "Key conventions: trade values are model estimates of surplus value (projected wins × a price per win, minus salary, discounted), not club valuations. Player inputs are dated; each tool shows its data snapshot date. Results labeled retrospective or exploratory are not confirmatory tests.",
    "",
    "## Research",
    ...research.map(a => line(a.title, `${SITE_URL}/analysis/${a.slug}`, `${a.summary} (${a.dateLabel})`)),
    "",
    "## Model guides",
    ...guides.map(a => line(a.title, `${SITE_URL}/analysis/${a.slug}`, a.summary)),
    "",
    "## Tools",
    ...toolCards.map(t => line(t.title, `${SITE_URL}${t.href}`, t.description)),
    "",
    "## Reference",
    line("Methods & data", `${SITE_URL}/methods`, "Data sources and snapshot dates, how the surplus-value model works, what has been tested and what is missing."),
    line("Research files", `${SITE_URL}/research`, "Downloadable data, forecasts, protocols and replay code for each published test."),
    line("Transaction ledger", `${SITE_URL}/ledger`, "Sourced records of historical trades and contracts with their original terms."),
    line("About", `${SITE_URL}/about`, "Who writes the site and how to report an error."),
    "",
    "## Optional",
    line("RSS feed", `${SITE_URL}/feed.xml`, "Every analysis piece, newest first."),
    line("Sitemap", `${SITE_URL}/sitemap.xml`, "Every public URL."),
    "",
  ].join("\n");
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
