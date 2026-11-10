import Link from "next/link";
import { AUTHOR, type Article } from "./types";
import data from "../data/park-fit.json";

const suzuki = data.players.find(player => player.id === "673548")!;
const validation = data.validation;
const improvement = (100 * (1 - validation.sprayLogLoss / validation.genericLogLoss)).toFixed(1);
const fmt = (n: number) => Math.abs(n) < .05 ? "—" : `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;

export const article: Article = {
  slug: "what-a-new-ballpark-changes",
  category: "Research",
  title: "What a new ballpark changes for a hitter",
  summary: "Seiya Suzuki’s 2026 contact loses almost three home runs in a Fenway replay, but gains nearly as many doubles. I built a tool to see how the same batted balls change a hitter’s line across five parks.",
  author: AUTHOR,
  published: "2026-11-10",
  dateLabel: "November 10, 2026",
  readTime: "5 min read",
  relatedTool: { href: "/tools/park-fit", label: "Try the ballpark fit tool" },
  body: <>
    <p className="article-lead">On May 26, Seiya Suzuki hit a fly ball to left field in Pittsburgh. Jhostynxon Garcia caught it. At Fenway, the same ball clears the Green Monster in Statcast’s replay. I wanted to know what happens to the rest of Suzuki’s contact over 81 home games, including the home runs a new park takes away. <a href="https://baseballsavant.mlb.com/sporty-videos?playId=d1ea7d41-ab3c-32f3-aa4d-22fdc820feaa">Watch the flyout and see the park-by-park ruling.</a></p>

    <h2>A ball can lose a home run and still be a hit</h2>
    <p>Baseball Savant checks where a tracked ball crosses the wall in each park. Its standard view replays the observed trajectory against the fences. The adjusted view accounts for differences in carry as well. I use those adjusted home-run flags and estimate the rest of the batting line from similar contact at each destination. <a href="https://baseballsavant.mlb.com/leaderboard/home-runs">Baseball Savant Home Run Tracker.</a></p>
    <p>If a ball stays in play, I estimate its chances of becoming a single, double, triple or non-hit. Exit velocity and launch angle tell me how the ball was struck. Spray direction tells me which part of the field it reached. The model also uses the batter’s side, the pitcher’s throwing hand and the ballpark. A 105 mph drive to left field and a 105 mph drive to right can run into very different fences and outfield gaps.</p>

    <h2>Suzuki at Fenway, Wrigley and three other parks</h2>
    <p>For a 600-PA season, I replay 300 PA at the chosen park using Suzuki’s full 2026 contact profile. The other 300 use his observed 2026 road rates in every scenario. I hold his walk and strikeout rates fixed within each half. The run column values the change in hit types using the 2025 linear weights. <a href="https://www.fangraphs.com/tools/guts?type=cn">FanGraphs Guts.</a></p>
    <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Seiya Suzuki park replays">
      <table>
        <caption>Suzuki’s 600-PA replay. Changes in batting runs and doubles are relative to Wrigley Field.</caption>
        <thead><tr><th scope="col">Home park</th><th scope="col">AVG / OBP / SLG</th><th scope="col" className="num">HR</th><th scope="col" className="num">Δ 2B</th><th scope="col" className="num">Δ Runs</th></tr></thead>
        <tbody>{data.parks.map(park => {
          const line = suzuki.parks[park.id as keyof typeof suzuki.parks];
          const wrigley = suzuki.parks.chc;
          return <tr key={park.id}><th scope="row">{park.name}</th><td>{[line.avg, line.obp, line.slg].map(n => n.toFixed(3).slice(1)).join(" / ")}</td><td className="num">{line.hits[3].toFixed(1)}</td><td className="num">{fmt(line.hits[1] - wrigley.hits[1])}</td><td className="num">{fmt(line.contactValue - wrigley.contactValue)}</td></tr>;
        })}</tbody>
      </table>
    </div>
    <p>Fenway costs Suzuki about 2.8 home runs and adds 2.7 doubles and 3.4 singles. Those changes nearly cancel out in batting runs. On his full 2026 sample, six actual homers stay in play at Fenway. The model assigns roughly three non-hits and two doubles to those six balls. It gives each ball a set of probabilities, since clearing a fence and getting past a fielder are separate questions.</p>
    <p>Cincinnati and Wrigley give Suzuki the same home-run total, but three balls go out only in Cincinnati and three go out only at Wrigley. The hitter matters, too. Compared with Wrigley, Yankee Stadium adds about half a homer for Brandon Lowe and takes away 3.3 for Suzuki on the same 600-PA scale. The <Link href="/tools/park-fit">Ballpark fit tool</Link> shows the switches and the rest of the batting line for all {data.players.length} hitters.</p>

    <h2>What I tested</h2>
    <p>I fit the contact model on 2023–25 data, choosing how strongly to shrink the park estimates on the 2025 sample before scoring 2026. The comparison model already knew the ball’s measurements and allowed each park to affect left- and right-handed hitters differently. On {validation.testContact.toLocaleString("en-US")} tracked batted balls across the five parks in 2026, letting the park effect vary with contact type reduced log loss from {validation.genericLogLoss.toFixed(4)} to {validation.sprayLogLoss.toFixed(4)}, an improvement of {improvement}%. This tests how well the probabilities describe outcomes once I know how the ball was hit.</p>
    <p>I’d use the replay to ask better free-agent questions. Which gains come from a few balls near the fence? Which gaps turn the hitter’s usual contact into extra bases? If a move is worth only a run or two in the replay, a club’s playing-time and defensive fit can matter much more. The next test is to predict the first season after a move using only contact from before the move, then compare with an ordinary park factor.</p>
  </>,
};
