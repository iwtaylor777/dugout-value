import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata, webPageJsonLd } from "../../seo";
import { JsonLd } from "../../json-ld";
import { Publication } from "../../site-shell";
import { DvWarLeaderboard } from "./leaderboard";

const description =
  "Hitter WAR rebuilt with Dugout Value credit: full credit for contact quality, half of what happens after contact, and half of measured fielding runs. 2024–26, compared with fWAR.";

export const metadata: Metadata = pageMetadata({ title: "DV WAR leaderboard: hitters", description, path: "/tools/dv-war" });

export default function DvWarPage() {
  return (
    <Publication active="tools">
      <JsonLd data={webPageJsonLd({ type: "CollectionPage", title: "DV WAR leaderboard: hitters", description, path: "/tools/dv-war" })} />
      <header className="section-intro">
        <p className="eyebrow">Dugout Value tools</p>
        <h1>DV WAR leaderboard</h1>
        <p>
          Hitter WAR with Dugout Value credit. A hitter keeps full credit for the quality of his contact but only half of what happens after the ball is in play. Fielders get half of their measured fielding runs. Everything else matches FanGraphs WAR, so the difference columns show exactly where the two disagree.
        </p>
      </header>
      <DvWarLeaderboard />
      <div className="dv-war-notes">
        <p>
          <strong>Balls in play</strong> is the change from giving the hitter half, not all, of the gap between what his batted balls produced and what their exit velocity, launch angle, direction and his sprint speed usually produce. A plus means his results ran below his contact quality. <strong>Fielding</strong> is the change from counting half of his fielding runs. Both are in wins, and the league totals match fWAR’s scale.
        </p>
        <p>
          Why these shares: in a test locked before it ran, credit split this way predicted team run scoring in games it wasn’t measured in better than credit based on actual outcomes. It also lined up better with what free-agent hitters were paid. Pitchers aren’t on this board, because the same approach didn’t beat FIP for them. <Link href="/analysis/a-statcast-war">Read the study</Link>.
        </p>
      </div>
    </Publication>
  );
}
