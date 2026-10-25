import type { ReactNode } from "react";

/** One article on the site. Each lives in its own file in app/articles/ and is listed in app/articles/index.ts. */
export type Article = {
  slug: string;                 // URL: /analysis/<slug>
  category: "Research" | "Research note" | "Explainer" | "Model guide";
  title: string;                // sentence case, a claim, no trailing period
  summary: string;              // deck: number behind the title + biggest caveat, 2–3 sentences
  author: string;               // byline name, see AUTHOR below
  published: string;            // ISO date the article went up, e.g. "2026-10-16"
  dateLabel: string;            // human date line, e.g. "October 16, 2026"
  readTime: string;             // e.g. "6 min read"
  status?: string;              // dated status line for prospective tests, shown in a callout under the deck
  featured?: boolean;           // the home page leads with the first featured article
  featurePanel?: ReactNode;     // the evidence panel shown beside the article on the home page
  relatedTool?: { href: string; label: string };
  evidence?: { href: string; label: string };
  body: ReactNode;
};

/** Byline used across the site. Change it here to change it everywhere. */
export const AUTHOR = "Ian Taylor";
