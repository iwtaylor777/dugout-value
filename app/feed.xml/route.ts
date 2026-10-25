import { articles } from "../articles";
import { SITE_NAME, SITE_URL } from "../seo";

export const dynamic = "force-static";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** RSS 2.0 feed of every analysis piece, newest first. Linked from the layout's <head>. */
export function GET() {
  const items = [...articles].sort((a, b) => b.published.localeCompare(a.published)).map(a => {
    const url = `${SITE_URL}/analysis/${a.slug}`;
    return `<item><title>${esc(a.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${new Date(`${a.published}T12:00:00Z`).toUTCString()}</pubDate><category>${esc(a.category)}</category><dc:creator>${esc(a.author)}</dc:creator><description>${esc(a.summary)}</description></item>`;
  }).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>${SITE_NAME}</title><link>${SITE_URL}</link><description>Independent baseball research with pre-registered tests, plus tools for projections, contracts and trade value.</description><language>en-us</language><atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
