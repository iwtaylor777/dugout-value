import Link from "next/link";
import data from "../data/park-fit.json";
import suzuki from "../../public/data/park-fit/2026-673548.json";
import { compare, parksFor, rangeLabel, signed } from "../tools/park-fit/data";
import { AUTHOR, type Article } from "./types";

const parks = parksFor(2026);
const index = (id: string) => parks.findIndex(park => park.id === id);
const wrigley = index("chc");
const comparisons = Object.values(data.examples).flatMap(player => {
  const home = index(player.home);
  return player.runs.filter((_, i) => i !== home).map(runs => runs - player.runs[home]);
});
const underFive = comparisons.filter(runs => Math.abs(runs) < 5).length;
const fenway = compare(suzuki, "adjusted", wrigley, index("bos"));
const newYork = compare(suzuki, "adjusted", wrigley, index("nyy"));
const standardNY = compare(suzuki, "standard", wrigley, index("nyy"));
const study = data.study;
const example = "https://baseballsavant.mlb.com/sporty-videos?playId=01565f18-15cc-31ae-90c9-888646383e85";
const boston = index("bos");
const originalPlayers = data.players.filter(player => player.id in data.examples);
const fenwayRows = originalPlayers.map(player => {
  const result = data.examples[player.id as keyof typeof data.examples];
  return { ...player, delta: result.runs[boston] - result.runs[index(result.home)], range: result.fenwayRange };
}).sort((a, b) => b.delta - a.delta);
const extent = Math.ceil(Math.max(...fenwayRows.flatMap(row => row.range.map(Math.abs))));
const position = (runs: number) => `${50 + runs / extent * 50}%`;

export const article: Article = {
  slug: "what-a-new-ballpark-changes",
  category: "Research",
  title: "Most ballpark changes in this replay were worth fewer than five runs",
  summary: `Across ${comparisons.length} comparisons, ${underFive} changed a hitter’s season by fewer than five batting runs in either direction. Looking at individual balls shows how a park can change the batting line even when it barely changes the value.`,
  author: AUTHOR,
  published: "2026-11-10",
  dateLabel: "November 10, 2026",
  readTime: "5 min read",
  relatedTool: { href: "/tools/park-fit", label: "Try Ballpark Fit" },
  evidence: { href: "/research/park-fit-20261110/validation.json", label: "Held-out results and calibration by park, batting side and spray direction" },
  body: <>
    <p className="article-lead">Move 81 of Seiya Suzuki’s games from Wrigley to Fenway and the replay takes away about three homers. It also gives him about four extra doubles and four extra singles. That works out to roughly {signed(fenway.runs)} batting runs, with a sample range from {rangeLabel(fenway.range)}. Among the {originalPlayers.length} hitters I looked at, {underFive} of {comparisons.length} comparisons with their actual home park came in under five runs in either direction.</p>

    <h2>Fenway can take a homer and give back a hit</h2>
    <p>Suzuki hit a 113 mph double on June 12. Statcast’s adjusted replay has it clearing the fence at Wrigley and staying in play at Fenway. At Cincinnati and Wrigley, Suzuki’s total home-run count comes out the same. Three balls clear only one park and three clear only the other. The individual plays tell you more than the net count. <a href={example}>Watch the June 12 double on Savant.</a></p>
    <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Seiya Suzuki changes by ballpark">
      <table>
        <caption>Suzuki at 600 PA. Each column shows the change from Wrigley, with the road half held fixed.</caption>
        <thead><tr><th scope="col">Home park</th>{["1B", "2B", "3B", "HR", "Runs", "95% sample range"].map(label => <th key={label} scope="col" className="num">{label}</th>)}</tr></thead>
        <tbody>{["bos", "nyy", "cin", "sf", "col"].map(id => {
          const destination = index(id);
          const row = compare(suzuki, "adjusted", wrigley, destination);
          return <tr key={id}><th scope="row">{parks[destination].name}</th>{row.hits.map((n, i) => <td key={i} className="num">{signed(n, 1)}</td>)}<td className="num">{signed(row.runs)}</td><td className="num">{rangeLabel(row.range)}</td></tr>;
        })}</tbody>
      </table>
    </div>
    <p>Five batting runs at 600 PA is about <strong>10 points of wOBA</strong> or <strong>half a batting win</strong>. Those are two ways to express the same batting difference. A change in WAR also depends on league and park context, fielding, baserunning, position and replacement level. <a href="https://www.fangraphs.com/tools/guts?type=cn">FanGraphs run weights and runs per win.</a></p>
    <figure className="park-fit-article-figure">
      <figcaption><strong>What Fenway changes for each hitter</strong><small>Batting runs versus his 2026 home park at 600 PA. Lines show the 95% game-sample range, with the fitted model and carry held fixed.</small></figcaption>
      <ul>{fenwayRows.map(row => <li key={row.id}>
        <span>{row.name}</span>
        <span className="park-fit-article-interval" aria-hidden="true">
          <i style={{ left: position(row.range[0]), right: position(-row.range[1]) }} />
          <b style={{ left: position(row.delta) }} />
        </span>
        <span className="park-fit-article-value"><strong>{signed(row.delta)}</strong><small>{rangeLabel(row.range)}</small></span>
      </li>)}</ul>
    </figure>

    <h2>Carry and handedness change the comparison</h2>
    <p>At Yankee Stadium, Suzuki’s replay loses {Math.abs(newYork.hits[3]).toFixed(1)} expected home runs versus Wrigley with Savant’s adjusted carry and {Math.abs(standardNY.hits[3]).toFixed(1)} with the observed trajectories. That’s a net loss of seven balls in one view and one ball in the other before scaling to the home half of a season. The <Link href="/tools/park-fit?p=673548&year=2026&from=chc&to=nyy&pa=600">Yankee Stadium comparison</Link> shows both. <a href="https://baseballsavant.mlb.com/leaderboard/home-runs">Savant’s standard and adjusted views.</a></p>
    <p>A park may help left-handed hitters as a group. I compare each replay with the effect on league-average contact with the same batting-side mix. For Suzuki at Fenway, the benchmark is about {signed(fenway.generic)} runs, leaving {signed(fenway.extra)} runs beyond that benchmark. Resampling his games puts that extra effect between {rangeLabel(fenway.extraRange)} runs. The sample leaves room for an effect in either direction.</p>

    <h2>The wall model helped on contact. The mover test was harder.</h2>
    <p>I replay 300 home PA from the selected season’s contact profile and keep the other 300 at the hitter’s observed road rates. The tool shows his actual line separately. Savant supplies the home-run calls. For the balls that stay in, I estimate the mix of hits and outs using expected carry, spray direction and the park’s wall measurements. I estimate the local park adjustments using visiting defenses to reduce the influence of the regular home fielders. For this article I fit through the selected year and leave the original {originalPlayers.length} hitters out of the fit. The public dimensions give five fence points per park, so the outlines in the tool are approximate. <a href="https://baseballsavant.mlb.com/leaderboard/statcast-park-factors?type=dimensions&amp;year=2026">Savant park dimensions.</a></p>
    <p>On {study.nonHr.n.toLocaleString("en-US")} held-out balls that stayed in play in 2026, the wall model’s probability error fell from {study.nonHr.loss.hand.toFixed(4)} to {study.nonHr.loss.wall_visitor.toFixed(4)} in log loss. The near-fence sample also improved. That test uses the measured contact and checks the resulting hit type. I then tested {study.movers.n} actual moves from 2024–26 using only prior contact to estimate the change in home-minus-road wOBA. The batting-side benchmark missed by about {Math.round(study.movers.rmse.hand * 1000)} wOBA points on the RMSE scale. The two-year wall model missed by about {Math.round(study.movers.rmse.two_year_wall * 1000)}. I use the batting-side benchmark as the first estimate and the replay to find plays worth examining.</p>
  </>,
};
