import type { MetadataRoute } from "next";
import { toolCards } from "./editorial-content";
import { articles } from "./articles";
import { SITE_URL } from "./seo";
import ledger from "./data/ledger.json";
import { profiles } from "./players/profiles";

/** Every public route: the pages, each article, and each tool. Add new routes here. */
export default function sitemap(): MetadataRoute.Sitemap {
  // lastModified: the newest article date for the home and analysis index; the data capture date for data-driven pages.
  const newest = articles.map(a => a.published).sort().at(-1);
  const index = (path: string, priority: number, lastModified?: string) => ({ url: `${SITE_URL}${path}`, priority, changeFrequency: "weekly" as const, ...(lastModified ? { lastModified } : {}) });
  const pages = [index("", 1, newest), index("/analysis", 0.9, newest), index("/research", 0.8, newest), index("/tools", 0.8, ledger.capturedAt), index("/methods", 0.6), index("/about", 0.5), index("/ledger", 0.5, ledger.capturedAt), index("/players", 0.5, ledger.capturedAt), { url: `${SITE_URL}/privacy`, priority: 0.2 }];
  const posts = articles.map(a => ({ url: `${SITE_URL}/analysis/${a.slug}`, lastModified: a.published, priority: 0.9, changeFrequency: "monthly" as const }));
  const tools = toolCards.map(t => ({ url: `${SITE_URL}${t.href}`, lastModified: ledger.capturedAt, priority: 0.7 }));
  const records = ledger.records.map(record => ({ url: `${SITE_URL}/ledger/${record.slug}`, lastModified: ledger.capturedAt, priority: 0.4 }));
  const players = profiles.map(profile => ({ url: `${SITE_URL}/players/${profile.id}`, lastModified: ledger.capturedAt, priority: 0.4 }));
  return [...pages, ...posts, ...tools, ...records, ...players];
}
