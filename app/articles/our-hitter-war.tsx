import Link from "next/link";
import type { Article } from "./types";
import { AUTHOR } from "./types";

export const article: Article = {
  slug: "our-hitter-war",
  category: "Research",
  title: "Our hitter WAR likes Soto more and glove-first stars less",
  summary:
    "Dugout Value WAR gives hitters full credit for their contact but half credit for what happens after it, and half credit for measured fielding. Over 2024–26 that moves a typical regular by about a win, and it tracks run scoring and pay better than fWAR does.",
  author: AUTHOR,
  published: "2026-11-02",
  dateLabel: "November 2, 2026",
  readTime: "6 min read",
  relatedTool: { href: "/tools/dv-war", label: "Open the DV WAR leaderboard" },
  evidence: {
    href: "/research/value-war-2026-10-29.tar.gz",
    label: "Protocol, locks, code and results (download)",
  },
  body: (
    <>
      <p className="article-lead">
        Last week I published <Link href="/analysis/a-statcast-war">a test of a Statcast-built WAR</Link>. The new version measured hitters better than the standard methods and didn’t do the same for pitchers. So I’m putting the hitter half to use. The DV WAR leaderboard now shows every hitter with 300 or more plate appearances in 2024–26 next to his FanGraphs WAR, and the differences are large enough to change how you see some of the best players in baseball.
      </p>

      <h2>What changes</h2>
      <p>
        DV WAR starts from fWAR and changes two things. The first is balls in play. A hitter gets full credit for the quality of his contact, meaning the runs his exit velocity, launch angle, direction and sprint speed usually produce, but only half of the gap between that and what actually happened. Some of that gap is skill, and much of it is the defense and luck. The second is fielding: a player gets half of his measured fielding runs, which is about the share of fielding that carries into the next few seasons in <Link href="/analysis/teams-pay-less-for-defense">my defense study</Link>.
      </p>
      <p>
        Those shares weren’t picked to make anyone look good. They were tuned on 2016–21, locked, and then tested on 2022–26. Credit split this way predicted a team’s run scoring in games it wasn’t measured in better than credit from actual outcomes (.492 against .480, an interval that excludes zero). It also lined up better with what 303 free-agent hitters were paid (.750 against .721), and it was steadier from one season to the next (.53 against .47).
      </p>
      <p>
        The fielding half needs a caveat. A run a center fielder saved this season was a real run, and the defense study found that each run of team fielding cut runs allowed by about 0.8. Halving it is a judgment that half of what the metrics measure won’t follow the player, not a claim that the plays didn’t happen. If you care only about what happened, fWAR’s fielding is the better count.
      </p>

      <h2>Who gains</h2>
      <p>
        Across the 151 hitters with 300 or more plate appearances in each of 2024, 2025 and 2026, DV WAR and fWAR differ by about a win over three years for a typical player. Juan Soto moves the most among stars, from 17.0 fWAR to 19.1 DV WAR. Most of that, 1.5 wins, comes from balls in play: his batted balls produced less than their quality usually earns, and DV WAR gives him back half of the difference. Pete Alonso (10.5 to 11.9), Bryan Reynolds (6.0 to 7.5), Bo Bichette (6.0 to 7.7) and J.P. Crawford (5.6 to 7.6) gain for the same reason. Crawford also gets back half of his below-average fielding.
      </p>
      <p>
        In 2026 alone, the biggest change near the top is Miguel Vargas. He was 5.3 fWAR, and DV WAR has him at 6.4, fourth in baseball, with almost a full win of hard contact that didn’t fall in.
      </p>

      <h2>Who loses</h2>
      <p>
        The players who lose are mostly great defenders and hitters whose results ran ahead of their contact. Pete Crow-Armstrong is still the best player in baseball by DV WAR in 2026, but over three years he drops from 18.6 to 16.3, all of it from fielding. Bobby Witt Jr. drops from 25.5 to 23.5 because fielding costs him 2.3 wins. That still leaves him the leader over the three years, by a smaller margin. Ceddanne Rafaela (9.1 to 7.0), Otto Lopez (10.7 to 8.6) and Cody Bellinger (10.4 to 8.2) lose on both counts. Jackson Chourio (11.4 to 8.8) and Seiya Suzuki (10.6 to 8.8) lose mostly on balls in play, because their results ran well ahead of their contact quality.
      </p>

      <h2>What it doesn’t cover</h2>
      <p>
        There is no pitcher version yet. Giving pitchers credit for the contact they allow helped in some tests and hurt in the one that asks whether credit moves with players who change teams. The version I’ll test next season charges pitchers the way FIP does and keeps this treatment for hitters, and it’s locked before the 2027 season starts. DV WAR is also built on top of fWAR. Batting, baserunning, positional and replacement runs are FanGraphs’, and only the two adjustments above are ours.
      </p>
      <p>
        <Link href="/tools/dv-war">The leaderboard</Link> shows both adjustments for every player and season, so you can see exactly where the two numbers disagree.
      </p>

      <h2>Methods in brief</h2>
      <ul>
        <li><strong>Data:</strong> every 2015–26 regular-season pitch from Baseball Savant, Savant sprint speed, and FanGraphs season leaderboards.</li>
        <li><strong>Balls in play:</strong> each one’s expected run value comes from a gradient-boosted model of exit velocity, launch angle, spray direction, sprint speed, batter side and park, fit within each season. The adjustment is half of the hitter’s total gap between actual and expected run value, re-centered so league totals match fWAR.</li>
        <li><strong>Fielding:</strong> half of FanGraphs fielding runs, with catcher framing kept at full credit.</li>
        <li><strong>Evidence:</strong> the protocol, its amendment, the locks and every holdout result are in <a href="/research/value-war-2026-10-29.tar.gz">the research files</a> for the original study.</li>
      </ul>
    </>
  ),
};
