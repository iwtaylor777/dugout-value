import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata, webPageJsonLd } from "../../seo";
import { JsonLd } from "../../json-ld";
import { Publication } from "../../site-shell";
import { ParkFit } from "./park-fit";
import { parkPlayers } from "./data";
import "./park-fit.css";

const path = "/tools/park-fit";
const title = "Ballpark fit";
const description = `Replay contact from ${parkPlayers.length} free-agent hitters across all 30 MLB home parks. See which balls change home-run status and how the rest of the batting line moves over 81 home games.`;

export const metadata: Metadata = pageMetadata({ title, description, path });

export default function ParkFitPage() {
  return (
    <Publication active="tools">
      <JsonLd data={webPageJsonLd({ type: "WebApplication", title, description, path })} />
      <header className="section-intro roster-tool-intro">
        <p className="eyebrow">2025–26 contact replay · Research tool</p>
        <h1>{title}</h1>
        <p>Replay a hitter’s past contact over 81 home games. Compare his batting line with the usual effect for his batting side and watch the balls that change.</p>
        <nav className="roster-tool-links" aria-label="Related reading">
          <Link href="/analysis/what-a-new-ballpark-changes">How I tested ballpark fit</Link>
          <Link href="/tools/free-agents">Free-agent tracker</Link>
        </nav>
      </header>
      <ParkFit />
    </Publication>
  );
}
