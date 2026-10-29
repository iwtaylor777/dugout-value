import Link from "next/link";
import type { Article } from "./types";
import { AUTHOR } from "./types";

const FIG = "/analysis/a-statcast-war";
const FILES = "/research/value-war-2026-10-29";

export const article: Article = {
  slug: "a-statcast-war",
  category: "Research",
  title: "A Statcast-built WAR measures hitters better, but pitchers are harder",
  summary:
    "Credit measured in half a season predicted team run differential in the other half better than either fWAR’s or bWAR’s method, in a test locked before it was run. On the test of whether credit moves with players who change teams, it fell short of fWAR’s method, because it gives pitchers too much credit for the contact they allow.",
  author: AUTHOR,
  published: "2026-10-29",
  dateLabel: "October 29, 2026",
  readTime: "9 min read",
  evidence: {
    href: `${FILES}.tar.gz`,
    label: "Protocol, locks, code and results (download)",
  },
  body: (
    <>
      <p className="article-lead">
        WAR is supposed to tell you how many wins a player was worth, but nobody ever sees a single player’s wins. What we see are team results. So I tested WAR the only way I think it can be tested: if a metric credits the right players, that credit should explain team results it wasn’t built from. I rebuilt the two standard approaches from the same Statcast data, built a third that splits credit differently, and locked the test before running it on the last five seasons. The new version passed the main test and failed the second one, and the reason it failed points at pitchers.
      </p>

      <h2>The problem with checking WAR against wins</h2>
      <p>
        The obvious test is to add up each team’s WAR and see how well it matches the standings. Every version of WAR does fine on that test, and the ones built from runs allowed do best, because they are partly made of the outcome. Baseball-Reference charges a pitcher for the runs that scored while he pitched, so its WAR will always line up with runs allowed in the season it measures, which shows good bookkeeping without showing that the credit went to the right people.
      </p>
      <p>
        Two things can go wrong with credit. It can be noise: a pitcher whose fielders made every play looks great, and next week he won’t. Or it can be real but belong to someone else: a run saved by the defense’s positioning, or by the catcher, ends up on the pitcher’s line. A good WAR has to get both right, so I used two tests.
      </p>

      <h2>Two tests</h2>
      <p>
        <strong>The half-season test</strong> splits every season’s games at random into two halves. Each player’s credit is measured in one half, multiplied by how much he actually played in the other half, and added up by team. The question is how well that predicts each team’s run differential in the half it wasn’t measured in. Noise doesn’t carry over to games it didn’t happen in, so the more of a metric’s credit is real, the better it does. I ran ten different random splits and both directions.
      </p>
      <p>
        That test has a blind spot I didn’t see until I ran it on the development seasons. Within a season, nearly every player stays on his team. Credit that really belongs to his fielders or his team’s positioning still shows up in the other half, because the fielders are still there. So I added a second test before touching the holdout seasons.
      </p>
      <p>
        <strong>The roster-change test</strong> asks whether credit moves with players when they change teams. For each team and each pair of seasons, I took every player’s credit from the first season and multiplied it by his change in playing time with that team: arrivals, departures and bigger or smaller roles. That predicts how much the team should improve or decline, and I compared it with the change in its run differential. Anything that belongs to the team rather than the players stays behind and cancels out.
      </p>

      <h2>How the new WAR splits credit</h2>
      <p>
        I rebuilt both standard methods from Statcast pitch data so all three systems work from the same events. The FIP-based method is fWAR’s approach: a pitcher gets credit for strikeouts, walks and home runs and none for anything else hit into play. The runs-allowed method is bWAR’s approach: a pitcher is charged for everything, minus an adjustment for his team’s defense. Hitters, fielders and catcher framing are the same in both.
      </p>
      <p>
        Dugout Value WAR splits each plate appearance’s runs among the batter, the pitcher, the fielders, the catcher and chance. The shares are the same for every player, and they were tuned on 2016–21 only:
      </p>
      <ul>
        <li><strong>Batters</strong> get full credit for strikeouts, walks and hit-by-pitches, full credit for the quality of their contact (the expected value of the exit velocity, launch angle, direction and their own sprint speed), and half the difference between what happened and what was expected.</li>
        <li><strong>Pitchers</strong> get full credit for strikeouts and walks and for the quality of contact they allow, but none of what happens after contact on balls that stay in the park. On home runs they get half the contact credit and the rest of the result. They also get half the credit for sequencing, the runs that depend on when hits happened.</li>
        <li><strong>Fielders</strong> get half the runs they saved against expectation, which is close to the share of fielding that carries into future seasons in <Link href="/analysis/teams-pay-less-for-defense">my defense study</Link>.</li>
        <li><strong>Catchers</strong> get full credit for framing.</li>
        <li>Everything left over is treated as luck and goes to nobody.</li>
      </ul>
      <p>
        No player is regressed toward average because of a small sample. His WAR is still the sum of what happened in his own plate appearances. What changes is how much of each event is treated as his doing.
      </p>

      <h2>It passed the main test</h2>
      <p>
        On the 2022–26 holdout, Dugout Value WAR’s half-season credit predicted run differential in the other half with a correlation of .697. That compares with .678 for the FIP-based method and .677 for the runs-allowed method. The protocol required the bootstrap 95% interval of each difference to exclude zero, and both did: .001 to .037 against FIP and .009 to .030 against runs allowed. It was better on offense (.492 against .480) and on run prevention (.610 against .577 and .600).
      </p>

      <figure className="article-figure">
        <img
          src={`${FIG}/primary-tests.png`}
          width={1600}
          height={832}
          loading="lazy"
          alt="Dot chart of the two primary tests on the 2022–26 holdout. Half-season test: FIP-based .678, runs-allowed .677, Dugout Value WAR .697. Roster-change test: FIP-based .590, runs-allowed .534, Dugout Value WAR .576."
        />
        <figcaption>
          Correlation between each system’s predicted and actual team run differential on the 2022–26 holdout. All three systems are rebuilt from the same Statcast pitch data. The half-season test averages 10 random splits in both directions over 150 team-seasons; the roster-change test covers 150 team-pairs of consecutive seasons.
        </figcaption>
      </figure>

      <h2>It failed the second one, because of pitchers</h2>
      <p>
        On the roster-change test, Dugout Value WAR scored .576, behind the FIP-based method’s .590 and ahead of the runs-allowed method’s .534. That misses the win rule, and the difference with FIP is well within noise either way.
      </p>
      <p>
        Dugout Value WAR beat the FIP-based method on both halves of the game separately: .441 against .424 on offense and .487 against .471 on run prevention. It lost on the total because the pitchers’ share is too big. Giving pitchers full credit for the contact they allow spreads their numbers further apart than their real differences justify, so when offense and pitching are added together, pitching gets too much weight. Some of what looks like a pitcher limiting hard contact belongs to his park, his catcher or his defense’s positioning, and it doesn’t follow him to a new team.
      </p>
      <p>
        The same pattern shows up in stability. Year to year, Dugout Value WAR per inning for pitchers correlated .39 with itself, against .45 for fWAR. For hitters it was the reverse: .53 against .47.
      </p>

      <h2>Where it clearly helps: hitters</h2>
      <p>
        For hitters, every test of whether credit is real went the new WAR’s way: half-season offense, roster-change offense, next-season offense and year-to-year stability. The cost is bookkeeping. Because hitters keep only half of what happens after contact, their credit adds up to a team’s runs in the same games less tightly (.853 against .879 in the half-season split). I also checked whether each version of WAR lines up with what free agents were paid. Teams see public WAR when they set prices, so this partly measures agreement with the established numbers, which makes it a hard test for a new one. For 303 hitters signed from 2020 to 2026, Dugout Value WAR over the three seasons before signing correlated .750 with the log of their annual salary, against .721 for fWAR. The interval for that gap, .012 to .048, excludes zero. For 443 pitchers it was .661 against .668, a tie.
      </p>
      <p>
        Published fWAR, with its full fielding and baserunning components, was still the best of everything I tested at predicting next season’s wins from this season’s credit (.729, against .711 for a version of Dugout Value WAR built on top of it). Same-season wins were matched best by FanGraphs’ runs-allowed WAR, as expected.
      </p>

      <h2>What’s next</h2>
      <p>
        The obvious fix is to keep the new treatment of hitters and go back to something closer to FIP for pitchers. When I tried that after seeing the results, it scored .691 on the half-season test and .611 on the roster-change test, better than both standard methods on both tests. I can’t claim that, because I chose it after looking at the holdout. Version 2 is being built on the development seasons now and will be locked before the 2027 season, which will be its clean test.
      </p>
      <p>
        The site’s trade and contract numbers still use projected fWAR. Nothing here changes them yet.
      </p>

      <h2>A note on the projections</h2>
      <p>
        The same idea, checking a number against something it wasn’t built to predict, applies to the projection system I’ve been building as an alternative to ZiPS on the site. Its preseason projections, applied to the players who actually played, explained each player’s actual run value as well as or better than ZiPS and Steamer did for 2024–26. For hitters, the correlation with run expectancy per plate appearance was .553 against .524 for ZiPS and .538 for Steamer, an edge over ZiPS that excludes zero. Its projected pitcher WAR also lined up with free-agent pay better than ZiPS’s (.728 against .687 for 187 signings).
      </p>

      <h2>Methods in brief</h2>
      <ul>
        <li><strong>Data:</strong> every regular-season pitch from Baseball Savant for 2015–26 (about 8.5 million), Savant sprint speed, FanGraphs season leaderboards and its free-agent tracker, and MLB standings. Baseball-Reference’s WAR can’t be downloaded here, so its method is rebuilt rather than compared directly.</li>
        <li><strong>Event models:</strong> expected run value on balls in play and called-strike probability, fit by gradient boosting on exactly the games being measured, with cross-fitting. Fielding responsibility comes from Statcast’s hit location, centered within each position. In a 2016 check it correlated about .55 with Savant’s fielding run value, below Outs Above Average, which uses fielder positioning that isn’t public. All three systems use the same fielding.</li>
        <li><strong>Seasons:</strong> development 2016–21, holdout 2022–26, with 2020 excluded as a target. The protocol was locked before anything was built. The roster-change test was added in a dated amendment after a development look and before any holdout computation. The weights were locked by hash before the holdout ran.</li>
        <li><strong>Corrections after the lock:</strong> season-level WAR was re-centered so league totals match fWAR’s scale, and win targets were switched from Statcast-rebuilt standings to official ones. Neither affects the two primary tests. Both are logged in the research files.</li>
        <li><strong>Files:</strong> the protocol, amendment, locks, development log, code and every holdout result are in <a href={`${FILES}.tar.gz`}>the research files</a>. FanGraphs and Statcast data aren’t redistributed.</li>
      </ul>
    </>
  ),
};
