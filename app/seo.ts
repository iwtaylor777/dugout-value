import type { Metadata } from "next";

export const SITE_NAME = "Dugout Value";
export const SITE_URL = "https://www.dugoutvalue.com";
export const DEFAULT_IMAGE = "/og.png";
export const IMAGE_WIDTH = 1200;
export const IMAGE_HEIGHT = 630;
const IMAGE_ALT = "Dugout Value: Baseball research & tools";

type PageMetadataInput = {
  /** Page title without the site suffix. The layout template adds " | Dugout Value". */
  title: string;
  description: string;
  /** Route path starting with "/", for example "/analysis". */
  path: string;
  /** Path of a 1200x630 image. Defaults to /og.png. */
  image?: string;
  type?: "website" | "article";
  /** Articles only. ISO date. */
  publishedTime?: string;
  /** Articles only. */
  authors?: string[];
  /** Set true for pages that should stay out of search results. */
  noindex?: boolean;
  /** Use the title as written, without the " | Dugout Value" suffix. For the home page. */
  absoluteTitle?: boolean;
};

/** Complete per-route metadata so that no route inherits another route's og:url or Twitter text. */
export function pageMetadata({ title, description, path, image = DEFAULT_IMAGE, type = "website", publishedTime, authors, noindex, absoluteTitle }: PageMetadataInput): Metadata {
  const socialTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  const images = [{ url: image, width: IMAGE_WIDTH, height: IMAGE_HEIGHT, alt: IMAGE_ALT }];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    // The RSS link is repeated here because a page's `alternates` replaces the layout's rather than merging with it.
    alternates: { canonical: path, types: { "application/rss+xml": [{ url: "/feed.xml", title: "Dugout Value analysis" }] } },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: type === "article"
      ? { title: socialTitle, description, url: path, siteName: SITE_NAME, type: "article", images, ...(publishedTime ? { publishedTime } : {}), ...(authors?.length ? { authors } : {}) }
      : { title: socialTitle, description, url: path, siteName: SITE_NAME, type: "website", images },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: [image] },
  };
}

/* ---------------------------------------------------------------------------------------------
 * Structured data (schema.org JSON-LD). Search engines and answer engines read these to know
 * who publishes the site, who wrote each piece, when it was published, and how pages relate.
 * Every page renders its own <JsonLd>; the layout adds the site-wide Organization and WebSite.
 * ------------------------------------------------------------------------------------------- */

export const AUTHOR_NAME = "Ian Taylor";
export const REPO_URL = "https://github.com/iwtaylor777/dugout-value";
const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path === "/" ? "" : path}`);

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const AUTHOR_ID = `${SITE_URL}/about#ian-taylor`;

type JsonLdObject = Record<string, unknown>;

/** Site-wide graph: the publisher, the site, and the author. Rendered once in the root layout. */
export function siteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: SITE_NAME,
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: abs("/favicon.svg") },
        founder: { "@id": AUTHOR_ID },
        sameAs: [REPO_URL],
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: SITE_NAME,
        url: SITE_URL,
        description: "Independent baseball research with pre-registered tests, plus tools for player projections, contracts and trade value.",
        publisher: { "@id": ORGANIZATION_ID },
        inLanguage: "en-US",
      },
      {
        "@type": "Person",
        "@id": AUTHOR_ID,
        name: AUTHOR_NAME,
        url: abs("/about"),
        sameAs: [REPO_URL],
        worksFor: { "@id": ORGANIZATION_ID },
      },
    ],
  };
}

/** Breadcrumb trail. `items` are [name, path] pairs after Home. */
export function breadcrumbJsonLd(items: [string, string][]): JsonLdObject {
  const all: [string, string][] = [["Home", "/"], ...items];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) })),
  };
}

/** An analysis piece. Research pieces are typed as reports of a test; explainers as plain articles. */
export function articleJsonLd(a: { slug: string; title: string; summary: string; published: string; modified?: string; category: string; author: string }): JsonLdObject {
  const url = abs(`/analysis/${a.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": a.category.startsWith("Research") ? ["Article", "Report"] : "Article",
    "@id": `${url}#article`,
    headline: a.title,
    description: a.summary,
    abstract: a.summary,
    datePublished: a.published,
    dateModified: a.modified ?? a.published,
    articleSection: a.category,
    author: a.author === AUTHOR_NAME ? { "@id": AUTHOR_ID, "@type": "Person", name: AUTHOR_NAME, url: abs("/about") } : { "@type": "Person", name: a.author },
    publisher: { "@id": ORGANIZATION_ID },
    isPartOf: { "@id": WEBSITE_ID },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: abs(DEFAULT_IMAGE),
    inLanguage: "en-US",
    about: { "@type": "Thing", name: "Baseball analytics" },
  };
}

/** A tool page (the trade builder, projections, rankings, finder). */
export function toolJsonLd(t: { title: string; description: string; path: string }): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${t.title} | ${SITE_NAME}`,
    description: t.description,
    url: abs(t.path),
    applicationCategory: "SportsApplication",
    operatingSystem: "Any (web browser)",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/** A generic page (about, methods, ledger entries, player studies, index pages). */
export function webPageJsonLd(p: { type?: string; title: string; description: string; path: string; datePublished?: string; about?: JsonLdObject }): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": p.type ?? "WebPage",
    name: p.title,
    description: p.description,
    url: abs(p.path),
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": ORGANIZATION_ID },
    ...(p.datePublished ? { datePublished: p.datePublished } : {}),
    ...(p.about ? { about: p.about } : {}),
    inLanguage: "en-US",
  };
}

/** Downloadable research files: data and code for a test, typed as datasets. */
export function datasetJsonLd(d: { name: string; description: string; path: string; files: { url: string; format: string }[]; datePublished?: string }): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: d.name,
    description: d.description,
    url: abs(d.path),
    creator: { "@id": AUTHOR_ID, "@type": "Person", name: AUTHOR_NAME },
    publisher: { "@id": ORGANIZATION_ID },
    isAccessibleForFree: true,
    ...(d.datePublished ? { datePublished: d.datePublished } : {}),
    distribution: d.files.map(f => ({ "@type": "DataDownload", contentUrl: abs(f.url), encodingFormat: f.format })),
  };
}

/**
 * A search-snippet description from a longer deck: whole sentences up to 160 characters, or the first
 * sentence cut at a word boundary. The full deck still appears on the page and in the article's JSON-LD.
 */
export function metaDescription(text: string, max = 160): string {
  // Split only where end punctuation is followed by a space, so "2.6%" and "No. 3" stay whole.
  const sentences = text.trim().split(/(?<=[.!?])\s+/);
  let out = "";
  for (const s of sentences) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > max) break;
    out = next;
  }
  if (out) return out;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}
