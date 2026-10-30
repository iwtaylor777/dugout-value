import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata, webPageJsonLd } from "../../seo";
import { JsonLd } from "../../json-ld";
import { Publication } from "../../site-shell";
import { DvWarLeaderboard } from "./leaderboard";

const description = "Compare DV WAR with fWAR for 2024–26. A contact-quality adjustment changes batting credit; fielding, framing, baserunning, positional and replacement runs retain full credit.";
export const metadata: Metadata = pageMetadata({ title: "DV WAR leaderboard: hitters", description, path: "/tools/dv-war" });
export default function DvWarPage() {
  return <Publication active="tools">
    <JsonLd data={webPageJsonLd({ type: "CollectionPage", title: "DV WAR leaderboard: hitters", description, path: "/tools/dv-war" })} />
    <header className="section-intro"><p className="eyebrow">Dugout Value tools</p><h1>DV WAR leaderboard</h1><p>I start with FanGraphs WAR and adjust batting credit for contact quality. Fielding, catcher framing, baserunning, positional and replacement runs retain full credit. The table shows how the batting adjustment changes each player’s value.</p></header>
    <DvWarLeaderboard />
    <div className="dv-war-notes">
      <p><strong>Balls in play</strong> is half of expected minus actual contact runs, converted to wins. Expected value uses exit velocity, launch angle, direction, sprint speed, handedness and park. A positive adjustment means contact quality ran ahead of results, relative to the league. The adjustment is centered per PA across all hitters before the 300-PA cutoff, preserving the full league’s fWAR total. Displayed numbers are rounded.</p>
      <p>In retrospective 2022–26 tests, this batting adjustment with standard fielding and pitching lowered next-season team run-differential error by 2.9% versus fWAR, with actual playing time held fixed. The roster-turnover comparison was inconclusive. These tests support a useful batting signal; they do not establish a superior measure of every player’s past contribution. This board shows completed-season value, separately from the forecasts in the trade tools. <Link href="/analysis/a-statcast-war">Read the methods and comparisons</Link>.</p>
    </div>
  </Publication>;
}
