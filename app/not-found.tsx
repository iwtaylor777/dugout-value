import type { Metadata } from "next";
import Link from "next/link";
import { Publication } from "./site-shell";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return <Publication>
    <title>Page not found | Dugout Value</title>
    <section className="section-intro not-found">
      <p className="eyebrow">404</p>
      <h1>That page isn’t here.</h1>
      <p>The link may be old, or the page may have moved.</p>
      <p className="not-found-links"><Link className="solid-link" href="/analysis">Read the analysis <span aria-hidden="true">→</span></Link><Link className="text-link" href="/tools">Open the tools →</Link></p>
    </section>
  </Publication>;
}
