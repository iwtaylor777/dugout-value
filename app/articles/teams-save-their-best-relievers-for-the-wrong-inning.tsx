import Link from "next/link";
import type { Article } from "./types";
import { AUTHOR } from "./types";

const FIG = "/analysis/teams-save-their-best-relievers-for-the-wrong-inning";
const FILES = "/research/bullpen-leverage-2026-10-30";

export const article: Article = {
  slug: "teams-save-their-best-relievers-for-the-wrong-inning",
  category: "Research",
  title: "Teams save their best relievers for the wrong inning",
  summary:
    "Most of the biggest moments a bullpen faces come before the ninth, but teams' two best relievers faced less than a quarter of them in 2026. Reassigning about 33 innings a year would be worth close to a win per team. Managers don't chase ERA, though they do lean too hard on half a season of results.",
  author: AUTHOR,
  published: "2026-10-30",
  dateLabel: "October 30, 2026",
  readTime: "9 min read",
  relatedTool: { href: "/tools/projections", label: "See the reliever projections behind this" },
  evidence: {
    href: `${FILES}.tar.gz`,
    label: "Plan, code and team-level results (download)",
  },
  body: (
    <>
      <p className="article-lead">
        Every bullpen is built around the same idea: the best reliever pitches the ninth. It feels right, because the ninth is when the game ends. But a game can be lost in the seventh with the bases loaded just as easily as in the ninth, and the seventh doesn’t wait for the closer. I went through every relief appearance from 2021 to 2026 to see where the biggest moments actually happen, who pitches them and what the mismatch costs.
      </p>

      <h2>Measuring a big moment</h2>
      <p>
        The standard tool is leverage index, or LI, which measures how much a single plate appearance can swing the chance of winning compared with an average one. An LI of 1.0 is a typical plate appearance. Leading off the first inning of a tie game is about 0.9. Bottom of the ninth, down a run, bases loaded and two outs is about 11. I built my own version from Statcast’s win-probability changes for every plate appearance from 2015 to 2026, by inning, score, outs and runners. It agrees almost perfectly with FanGraphs’ published numbers: across 148 relievers in 2026, the correlation between my average LI and theirs was .997.
      </p>
      <p>
        To judge who should pitch those moments, I need to know how good each reliever is. Results from the same season are a trap, because a reliever’s ERA over 60 innings is mostly noise. So I used <Link href="/analysis/our-projections-replace-zips">Dugout Value’s preseason projections</Link>, made before each season with only earlier data. A team’s top two relievers are the two with the best projected FIP among those who faced at least 100 batters for it in relief. The results barely change with ZiPS projections instead.
      </p>

      <h2>Where the big moments are</h2>
      <p>
        Call a plate appearance high-leverage when its LI is 2 or more, about twice the stakes of an average one. In 2026, 58% of the high-leverage batters that relievers faced came before the ninth inning: 24% in the eighth, 17% in the seventh and 10% in the sixth. Another 13% came in extra innings, and only 29% in the ninth.
      </p>
      <p>
        Teams’ two best relievers faced 47% of the high-leverage batters in the ninth, but only 23% of the high-leverage batters before it. Relievers ranked sixth or lower on their own team faced 39% of all the high-leverage batters. Meanwhile, 47% of the batters a team’s top two relievers faced came with an LI below 1, less than an average plate appearance: the three-run ninth or the clean inning to stay sharp.
      </p>

      <figure className="article-figure">
        <img
          src={`${FIG}/leverage-by-inning.png`}
          width={1600}
          height={768}
          loading="lazy"
          alt="Paired bars by inning for 2021–26. High-leverage relief batters: 5% in the fifth or earlier, 10% in the sixth, 18% in the seventh, 24% in the eighth, 30% in the ninth and 13% in extra innings. Top two relievers’ batters: 4%, 8%, 18%, 27%, 38% and 4%."
        />
        <figcaption>
          Relief plate appearances, 2021–26 pooled. High leverage is an LI of 2 or more. Top two relievers are each team’s two best by Dugout Value’s preseason FIP projection among those who faced 100+ batters in relief for it.
        </figcaption>
      </figure>

      <p>
        Extra innings hold 13% of the high-leverage batters but get only 4% of the top relievers’ work, mostly because the closer has already pitched the ninth. The pattern hasn’t moved since 2021: the share of high-leverage batters faced before the ninth by the top two relievers has stayed between 19% and 25% every year.
      </p>

      <h2>What it costs</h2>
      <p>
        I estimated the cost two ways, both holding each reliever’s workload fixed. The generous version reshuffles the whole season, giving each team’s highest-leverage batters to its best relievers. That’s worth 1.8 wins per team on average in 2026. It’s an upper bound, because it assumes the manager knew in advance which situations would turn out to be the big ones and that everyone was always available.
      </p>
      <p>
        The modest version swaps only the worst of the mismatches. For each team, I traded the lowest-leverage batters its top two relievers faced for the highest-leverage batters faced by relievers ranked sixth or lower, as many as the two lists allowed. That’s about 140 batters, or 33 innings, per team. The gain averaged 0.8 wins per team in 2026, about 23 wins across the league, from changing who faces about a third of the batters its top two relievers see. San Francisco had the most to gain (1.6 wins) and Milwaukee 1.1.
      </p>
      <p>
        Neither number accounts for everything a manager weighs. Relievers get tired, get hurt and need regular work, matchups by handedness matter, and a reliever used in the seventh can’t also pitch the ninth. A three-run lead in the ninth becomes a one-run lead quickly if the wrong pitcher is out there. I don’t think those reasons explain a gap this large, especially the share of the best relievers’ work that comes in low-leverage spots.
      </p>

      <h2>Managers aren’t chasing ERA</h2>
      <p>
        The usual complaint about bullpen management is that managers react to results. A reliever who gives up a few bloop hits loses his role, and one who strands runners on line drives gets promoted. I checked by splitting each season at July 15 and following 487 relievers who threw at least 15 first-half and 10 second-half innings for the same team. I separated their first-half results into luck (runs allowed minus FIP) and skill (FIP compared with the preseason projection), then asked which one moved their leverage after the break.
      </p>
      <p>
        Managers mostly ignore luck: a reliever whose runs allowed ran a full run above his FIP lost 0.036 of LI in the second half, a small change (interval 0.021 to 0.051) and a sensible one, since that luck didn’t predict his second-half FIP at all. A run of first-half FIP above his projection cost him 0.097, and a run of preseason projection cost him 0.165.
      </p>
      <p>
        The problem is the balance between those last two. Half a season of FIP does carry information, but the preseason projection carries much more: it predicted second-half FIP about three times as strongly. Relative to how well each predicts, managers gave first-half FIP about twice the weight the projection got (1.9 times, interval 1.2 to 3.6). So managers see through ERA but still give three months of results more weight than they deserve next to several seasons of evidence.
      </p>

      <h2>The team view</h2>
      <p>
        To compare bullpens, I placed each team between the worst possible assignment of its own relievers to its own situations, scored 0, and the best, scored 100. The average team landed at 64. Seattle was best in 2026 at 72: Andrés Muñoz, its best projected reliever, faced an average LI of 2.15. The Athletics were worst at 51, with their best projected reliever, Mark Leiter Jr., at 1.15, while Hogan Harris, further down their list, had the highest leverage on the staff at 1.61.
      </p>

      <figure className="article-figure">
        <img
          src={`${FIG}/team-efficiency-2026.png`}
          width={1600}
          height={1312}
          loading="lazy"
          alt="Dot plot of 2026 leverage efficiency by team, from Seattle at 72 down to the Athletics at 51. Milwaukee is fourth at 70 and Tampa Bay is 25th at 59."
        />
        <figcaption>
          Efficiency places each team’s actual value between the worst (0) and best (100) assignment of its relievers to the leverage situations it faced, with preseason Dugout Value projections as talent. A team-season is noisy: the year-to-year correlation is .14.
        </figcaption>
      </figure>

      <p>
        The World Series teams sit far apart, with Milwaukee fourth at 70. Its two best projected relievers, Abner Uribe and closer Trevor Megill, both faced an average LI above 1.7, and Uribe pitched mostly before the ninth, which is how a fireman is supposed to work. Tampa Bay was 25th at 59. Its best projected reliever, Garrett Cleavinger, faced only 12% of his batters in the ninth or later, at an average LI of 1.39, while closer Bryan Baker, projected a little worse, got the biggest spots at 1.80.
      </p>
      <p>
        I wouldn’t read much into one team’s rank. A team’s efficiency in one season barely predicts the next (a correlation of .14 from year to year). Some of that is noise, and some is that bullpens turn over constantly. No team showed a lasting edge from 2021 to 2026. So the useful finding is the league-wide one: nearly every team holds its best arm for the ninth.
      </p>

      <h2>What a team could do</h2>
      <p>
        The fix is a different default: use the best reliever in the first spot of the game with an LI around 2 or higher, whatever the inning, rather than holding him for a save. A three-run lead in the ninth starts at an LI of about 0.8 for a home team and 1.0 for a road team, no higher than an average plate appearance; that is a job for the fifth or sixth reliever. A one-run lead in the seventh with runners on first and second and one out is about 4. And when the closer has to be held, the top setup man should be the one who goes into the seventh or eighth with runners on.
      </p>
      <p>
        There’s one more reason clubs might resist: saves are paid in arbitration, and a reliever who pitches the eighth in the biggest spot of the game won’t collect them. That cost falls on the reliever, and a club that wins an extra game by ignoring it has made a good trade.
      </p>

      <h2>Methods in brief</h2>
      <ul>
        <li><strong>Data:</strong> Statcast pitch data for regular seasons 2015–26. Leverage comes from 2015–26 excluding 2020. Usage is studied for 2021–26, about 77,000 relief plate appearances a season. The plan was written before any result was computed and is in the research files.</li>
        <li><strong>Leverage index:</strong> mean absolute change in win expectancy by inning (1–8, 9, extras), half-inning, score margin (−4 to +4), outs and runners, divided by the overall mean. States with fewer than 200 plate appearances borrow from the same state with innings 1–6 pooled.</li>
        <li><strong>Talent:</strong> Dugout Value preseason FIP projections, with ZiPS as a check for 2023–26. With ZiPS, the top two relievers faced 21% of high-leverage batters before the ninth in 2026 (23% with Dugout Value) and 40% in the ninth or later (also 40%), and the full reshuffle was worth 2.1 wins per team. Relievers without a projection (mostly rookies and position players pitching), about 12% of relief plate appearances, are excluded.</li>
        <li><strong>Value:</strong> a reliever saves (league FIP − projected FIP) ÷ 9 ÷ 4.25 runs per batter, multiplied by LI. Ten runs make a win.</li>
        <li><strong>Luck test:</strong> 903 pitcher-team-seasons, entry LI (the leverage when the reliever entered), weighted by appearances. Runs allowed are those scored while the reliever was pitching, which differs from ERA’s accounting of inherited runners. Intervals resample pitchers.</li>
        <li><strong>Files:</strong> the plan, code and team-level results are in <a href={`${FILES}.tar.gz`}>the research files</a>. Statcast and FanGraphs data and player-level rows aren’t redistributed.</li>
      </ul>
    </>
  ),
};
