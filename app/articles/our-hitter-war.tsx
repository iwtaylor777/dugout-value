import Link from "next/link";
import type { Article } from "./types";
import { AUTHOR } from "./types";
import data from "../data/dv-war-hitters.json";
const row = (name: string) => data.seasons["2026"].find(r => r.name === name)!;
export const article: Article = {
  slug: "our-hitter-war", category: "Research", title: "What contact quality changes in hitter WAR",
  summary: "My hitter WAR adjusts batting credit for contact quality and retains full fielding credit. The leaderboard shows the difference from fWAR for 2024–26, alongside the limits of the historical validation.",
  author: AUTHOR, published: "2026-11-02", dateLabel: "November 2, 2026", readTime: "4 min read",
  relatedTool: { href: "/tools/dv-war", label: "Open the DV WAR leaderboard" },
  evidence: { href: "/research/value-war-contact-2026-10-29.tar.gz", label: "Methods, code and results (download)" },
  body: <>
    <p className="article-lead">I use a contact adjustment to give a second view of hitter value. DV WAR starts with FanGraphs WAR, changes batting credit, and retains full credit for fielding, catcher framing, baserunning, position and replacement value. The <Link href="/tools/dv-war">leaderboard</Link> shows hitters with at least 300 PA in 2024–26, next to their fWAR and the batting adjustment behind every difference.</p>
    <h2>One adjustment</h2>
    <p>Each batted ball gets an expected run value from its exit velocity, launch angle, direction, the hitter’s sprint speed, handedness and park. A hitter receives that expected value plus half the gap between expectation and outcome. Walks, hit-by-pitches and strikeouts retain their outcome credit.</p>
    <p>Expressed as a change to fWAR, it is half of expected minus actual contact runs, converted to wins. The adjustment is centered per PA across the full league before the leaderboard’s cutoff, preserving the full league’s fWAR total. A player gains when his contact quality ran ahead of his results, relative to the league.</p>
    <h2>Who moves</h2>
    <p>In 2026, Miguel Vargas rises from {row("Miguel Vargas").fwar.toFixed(1)} fWAR to {row("Miguel Vargas").dvwar.toFixed(1)} DV WAR. Bobby Witt Jr. moves from {row("Bobby Witt Jr.").fwar.toFixed(1)} to {row("Bobby Witt Jr.").dvwar.toFixed(1)}. Their fielding credit is unchanged; the difference comes entirely from contact.</p>
    <p>Ceddanne Rafaela goes from {row("Ceddanne Rafaela").fwar.toFixed(1)} to {row("Ceddanne Rafaela").dvwar.toFixed(1)}, and Jackson Chourio from {row("Jackson Chourio").fwar.toFixed(1)} to {row("Jackson Chourio").dvwar.toFixed(1)}. Their outcomes ran ahead of the contact model’s expectation. That is a model-based reassignment of batting credit, not proof that those outcomes were entirely luck.</p>
    <h2>What was validated</h2>
    <p>With actual next-season playing time held fixed, the batting adjustment plus standard fielding and pitching reduced team run-differential error by 2.9% versus fWAR across the 2022–26 target seasons. Correlation improved from .7265 to .7442. The roster-turnover comparison was inconclusive. The <Link href="/analysis/a-statcast-war">methods article</Link> gives the uncertainty intervals and explains why those team tests do not establish that every individual WAR estimate is correct.</p>
    <p>These are retrospective tests on previously examined seasons. Salary and stability results from the original broader model do not validate this exact formula. The leaderboard is an alternative view of completed-season value, separate from the forecasts used in the trade tools.</p>
    <h2>Why fielding stays whole</h2>
    <p>A run saved this season can have value even if it does not repeat next season. Fielding measurements are uncertain, but their persistence does not establish a fixed discount on past runs saved. I retain the published fielding and framing components and isolate the batting change so readers can judge what it adds.</p>
    <p>Pitcher WAR also remains unchanged. DV WAR is built on fWAR, and the <Link href="/tools/dv-war">table</Link> keeps both numbers visible.</p>
  </>,
};
