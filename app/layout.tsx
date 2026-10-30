import type { Metadata } from "next";
import "./globals.css";
import "./publication.css";
import "./tool-ux.css";
import { Analytics } from "./analytics";
import { JsonLd } from "./json-ld";
import { siteJsonLd } from "./seo";

const title = "Dugout Value: Baseball research & tools";
const description = "Independent baseball research, clear explanations, and tools for exploring player projections, contracts, and trade value.";
// Site-wide defaults only. Every route sets its own canonical, og:url and Twitter text with pageMetadata() in app/seo.ts, so nothing inherits the home page's URL.
export const metadata: Metadata = {
  metadataBase: new URL("https://www.dugoutvalue.com"),
  title: { default: title, template: "%s | Dugout Value" },
  description,
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: { title, description, siteName: "Dugout Value", type: "website", images: [{ url: "/og.png", width: 1200, height: 630, alt: "Dugout Value: Baseball research & tools" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  authors: [{ name: "Ian Taylor", url: "https://www.dugoutvalue.com/about" }],
  creator: "Ian Taylor",
  publisher: "Dugout Value",
  alternates: { types: { "application/rss+xml": [{ url: "/feed.xml", title: "Dugout Value analysis" }] } },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><JsonLd data={siteJsonLd()}/>{children}<Analytics/></body></html>;
}
