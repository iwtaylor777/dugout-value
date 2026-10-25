import type { MetadataRoute } from "next";
import { SITE_URL } from "./seo";

/**
 * Everything is public, including to search and answer-engine crawlers (Googlebot, Bingbot, OAI-SearchBot,
 * ChatGPT-User, PerplexityBot, Claude-SearchBot and the rest): one allow-all rule covers them. The sitemap lists
 * every route; /llms.txt is a plain-text guide to the site for language-model tools.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
