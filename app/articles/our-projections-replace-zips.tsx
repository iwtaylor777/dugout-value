import Link from "next/link";
import type { Article } from "./types";
import { AUTHOR } from "./types";

const FIG = "/analysis/our-projections-replace-zips";
const FILES = "/research/dv-projections-2026-10-29";

export const article: Article = {
  slug: "our-projections-replace-zips",
  category: "Research",
  title: "Introducing DV Projections, which match or beat ZiPS",
  summary:
    "On a locked 2025–26 holdout, Dugout Value projections tied ZiPS and Steamer for hitters and beat ZiPS for pitchers, and they line up with run value and free-agent pay at least as well. They also regress long-range forecasts harder than a standard aging curve, which lowers the value of many young players.",
  author: AUTHOR,
  published: "2026-10-29",
  dateLabel: "October 29, 2026",
  readTime: "11 min read",
  relatedTool: { href: "/tools/projections", label: "See the projections" },
  evidence: {
    href: `${FILES}.tar.gz`,
    label: "Protocols, locks, results and code (download)",
  },
  body: (
    <>
      <p className="article-lead">
        Until now, every value on this site started from ZiPS. That meant waiting for FanGraphs to publish new projections before a winter signing or a trade could be scored. I built a projection system to replace it, tested it against ZiPS and Steamer on two seasons it had never seen, and checked whether its numbers line up with things they weren’t built to predict. It held up, so the tools now use it by default, with ZiPS one click away.
      </p>

      <h2>How it works</h2>
      <p>
        The model starts from what a player has done in his last five seasons (three for pitchers), but it reads more than the results. For hitters, the inputs include the Statcast measures behind each season: expected wOBA, exit velocity, barrel and hard-hit rates, launch angle, plus plate discipline (chase rate, contact rate on pitches in the zone, swinging strikes), batted-ball mix, speed, age and position. For pitchers, they include strikeout, walk and home run rates, velocity, the quality of contact allowed, called strikes plus whiffs, and FanGraphs’ pitch-quality grades for stuff and command. Every input is set relative to that season’s league average, so changes in the run environment, like the 2023 rule changes, don’t show up as changes in the player.
      </p>
      <p>
        The main design choice is how to handle small samples. A traditional system weights the last three seasons in a fixed ratio and pulls every player toward average by a fixed amount. That treats all statistics the same, even though a hitter’s strikeout rate means something after a month and his batting average on balls in play barely means anything after a season. For hitters, this model is given each statistic three ways, pulled toward average lightly, moderately and heavily (as if 60, 250 or 1,000 plate appearances of league-average play were added), and it learns which version predicts best for each one. For pitchers, it sees each of the last three seasons on its own and a 3-2-1 weighted average, and it learns how much to trust each.
      </p>
      <p>
        Hitters also get up to three seasons of minor-league stats at AAA, AA and Class A from MLB’s own data, each compared with the average at that level and paired with the player’s age there. That matters most for players with short big-league records. Two different models then read the same inputs, and their predictions are averaged: a gradient-boosted tree model, which can find interactions such as a profile that ages differently from another, and a ridge regression, which is steadier with thin data. For hitters, the models predict wOBA and the other rates directly. For pitchers, they predict strikeouts, walks and home runs per inning separately and combine them into FIP, averaged with a model that predicts FIP directly.
      </p>
      <p>
        WAR comes from its own model, which reads the same inputs plus each player’s past fielding, baserunning and positional runs. Playing time comes from another one. Every model for a given season is fit only on seasons that came before it, so a 2025 projection never sees 2025.
      </p>

      <h2>The holdout</h2>
      <p>
        I wrote the rules before scoring anything: develop on 2023 and 2024, lock the code by hash, then score 2025 and 2026 once. ZiPS and Steamer are the preseason versions FanGraphs published, read from archived copies of its projection pages. On the primary measures, the model tied both systems for hitters and beat ZiPS for pitchers.
      </p>
      <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Holdout results">
        <table>
          <caption>Holdout error, 2025–26 pooled (lower is better)</caption>
          <thead>
            <tr><th scope="col">Measure</th><th scope="col">Dugout Value</th><th scope="col">ZiPS</th><th scope="col">Steamer</th></tr>
          </thead>
          <tbody>
            <tr><td>Hitters, wOBA (624 players)</td><td>.0287</td><td>.0288</td><td>.0288</td></tr>
            <tr><td>Hitters, WAR per 600 PA</td><td>1.63</td><td>1.72</td><td>1.63</td></tr>
            <tr><td>Pitchers, FIP (685 players)</td><td>.727</td><td>.763</td><td>.731</td></tr>
            <tr><td>Pitchers, ERA</td><td>1.027</td><td>1.070</td><td>1.013</td></tr>
            <tr><td>Pitchers, WAR per 180 IP</td><td>1.57</td><td>1.66</td><td>1.70</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        The hitter wOBA result is a tie, and Steamer was slightly better in 2026 alone. The model still trails ZiPS on hitter strikeout rate, which is the obvious place to improve.
      </p>

      <h2>Do the projections mean anything beyond themselves?</h2>
      <p>
        A projection system can get good at predicting its own statistic without that statistic capturing value, so I checked two things the projections weren’t built to predict. The first is run value: each hitter’s projected wOBA against his actual runs above average per plate appearance, measured from the base-out situation rather than from wOBA’s weights. Across 952 hitter-seasons in 2024–26, the correlation was .553 for Dugout Value, .524 for ZiPS and .538 for Steamer. The edge over ZiPS has a bootstrap 95% interval of .005 to .053. For pitchers the point estimates went the same way, but the intervals overlap.
      </p>
      <p>
        The second is pay. Projected WAR at signing lines up with free agents’ annual salaries better for Dugout Value than for ZiPS among pitchers (.728 against .687 for 187 signings, interval .004 to .081), and about the same for hitters. These checks are exploratory, added after the first team-level tests turned out too weak to separate the systems.
      </p>

      <h2>A flaw I fixed before switching</h2>
      <p>
        Putting the projections on the site exposed a problem the holdout had averaged over. The model that projects a hitter’s WAR rate only saw offensive statistics, so it couldn’t tell a Gold Glove center fielder from an average one. In the top fifth of hitters by prior-year fielding, it projected about half a win per 600 plate appearances too low. Adding each player’s fielding, baserunning and positional runs as inputs removed that bias and lowered the error in all four seasons I could test, to 1.54 in 2025 and 1.64 in 2026, against 1.66 and 1.80 for ZiPS. I chose the fix on 2023–24 data. The 2025–26 numbers reuse seasons the first version had already been scored on, so they confirm the fix rather than test it fresh.
      </p>

      <h2>Every player gets his own aging path</h2>
      <p>
        Contracts run for years, so the tools need more than next season. The usual approach takes a one-year projection and applies a standard aging curve. Instead, I fit a separate model for each year ahead, two through five, so the shape of a player’s decline or improvement depends on his age and his profile. In backtests on 2024–26 seasons, the separate models had lower error than the one-year-plus-curve approach in all 17 comparisons. The averages by distance are in the chart.
      </p>

      <figure className="article-figure">
        <img
          src={`${FIG}/aging-backtest.png`}
          width={1600}
          height={672}
          loading="lazy"
          alt="Two line charts of error in projected WAR rate by years ahead. Hitters: separate models 1.72, 1.76, 1.73 and 1.77 at two to five years, against 1.81, 1.92, 1.90 and 2.00 for a one-year projection plus a standard aging curve. Pitchers: 1.68, 1.77, 1.95 and 1.92 against 1.72, 1.86, 2.10 and 2.01."
        />
        <figcaption>
          Playing-time-weighted RMSE of WAR per 600 PA (hitters, 200+ PA) or per 180 IP (pitchers, 40+ IP), averaged over the target seasons available at each distance from 2024 to 2026. Exploratory.
        </figcaption>
      </figure>

      <p>
        The separate models regress harder at long range than an aging curve does, and that is where most of the site’s values change. A young star’s fifth season ahead is projected closer to average than a standard aging curve would put it, and the backtests say that is right on average: at every distance, the models’ forecasts were, if anything, not regressed enough. I don’t have archived multi-year ZiPS to test against directly. Because surplus value for a cheap, controlled young player comes mostly from those later seasons, many of them lose value. Across the 1,127 players with Dugout Value projections and a contract on the board, total surplus is 36% lower than under ZiPS, even though projected 2027 WAR is nearly the same on average (1.11 against 1.15).
      </p>

      <h2>Playing time and the price of a win</h2>
      <p>
        The trade model prices a full season. So each projected rate is multiplied by a full season of playing time: the larger of the model’s expected playing time and the player’s healthy workload, the average of his two largest totals in 2024–26. A pitcher coming off an injury year still gets a starter’s innings, which matches how ZiPS projects playing time and how the price of a win was calibrated. Each later season trims the workload by the site’s usual rate for the player’s role and age.
      </p>
      <p>
        The $11 million per win the site charges was fit to past contracts using projections like ZiPS. Refit on 304 free-agent contracts from 2021 to 2026, using these projections as they would have looked at each signing, the best fit is $10.5 million with the usual 20% star premium, and $11 million fits almost as well. So the price stays where it is. One caveat cuts the other way: in the 2026 class, contracts lined up much more closely with FanGraphs’ projections than with these (log error .10 against .21 across 36 deals). Teams appear to price off projections like the public ones, and FanGraphs’ numbers there were probably recorded after the signings, when playing time already reflected the new contract.
      </p>

      <h2>What changes on the site</h2>
      <ul>
        <li>The trade builder, finder, rankings and projections all use Dugout Value projections by default. A Projections menu on each one switches back to ZiPS, and shared trade links remember the choice. Links saved before today still open with ZiPS.</li>
        <li>The projections table shows each player’s rate and playing time behind every number, for example 6.1 WAR per 600 PA × 698 PA.</li>
        <li>Players without 100 PA or 20 innings in 2024–26, including prospects and international signings, still use ZiPS. So do any seasons you edit by hand.</li>
        <li>This winter’s frozen <Link href="/analysis/what-this-winters-free-agents-should-cost">free-agent predictions</Link> were made with ZiPS and stay as they were.</li>
      </ul>
      <p>
        The clean test is still ahead. I’ll freeze these projections before 2027 and score them against ZiPS and Steamer after the season, along with the version of <Link href="/analysis/a-statcast-war">our WAR</Link> that comes out of the current round of work.
      </p>

      <h2>Methods in brief</h2>
      <ul>
        <li><strong>Data:</strong> FanGraphs season leaderboards for 2010–26 and MLB statsapi minor-league statistics for 2013–26. ZiPS and Steamer come from archived preseason FanGraphs pages for 2023–26; Steamer pitchers for 2023 have no archive.</li>
        <li><strong>Scored players:</strong> hitters with 100+ PA and pitchers with 20+ IP in the prior three seasons, judged on seasons with 200+ PA or 40+ IP, weighted by playing time, and limited to players every system projected.</li>
        <li><strong>Locks:</strong> the protocol was locked October 27, 2026 at 23:50 UTC and model v1 at 00:08 UTC the next day, before the holdout was scored. The validation protocol was locked at 00:18 UTC and its amendment at 00:25 UTC.</li>
        <li><strong>Site version:</strong> v1.1, which adds fielding, baserunning and positional inputs to the hitter WAR-rate model, and horizon models for two to five years ahead blended 70/30 with the one-year projection plus a standard aging curve, then smoothed to a straight-line trend for each player.</li>
        <li><strong>Files:</strong> protocols, locks, aggregate results and code are in <a href={`${FILES}.tar.gz`}>the research files</a>. FanGraphs data and per-player results built from it aren’t redistributed.</li>
      </ul>
    </>
  ),
};
