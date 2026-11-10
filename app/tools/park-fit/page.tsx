import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata, webPageJsonLd } from "../../seo";
import { JsonLd } from "../../json-ld";
import { Publication } from "../../site-shell";
import { ParkFit } from "./park-fit";
import "./park-fit.css";

const path = "/tools/park-fit";
const title = "Ballpark fit";
const description = "Replay 2026 contact from 11 hitters across five MLB parks. See which balls change home-run status and how the rest of the batting line moves over 81 home games.";

export const metadata: Metadata = pageMetadata({ title, description, path });

export default function ParkFitPage() {
  return (
    <Publication active="tools">
      <JsonLd data={webPageJsonLd({ type: "WebApplication", title, description, path })} />
      <header className="section-intro roster-tool-intro">
        <p className="eyebrow">2026 contact replay · Research tool</p>
        <h1>{title}</h1>
        <p>Move a hitter’s 81 home games to another park. See which balls clear the fence and what changes in his batting line when the road half stays fixed.</p>
        <nav className="roster-tool-links" aria-label="Related reading">
          <Link href="/analysis/what-a-new-ballpark-changes">How I tested ballpark fit</Link>
          <Link href="/tools/free-agents">Free-agent tracker</Link>
        </nav>
      </header>
      <ParkFit />
    </Publication>
  );
}
