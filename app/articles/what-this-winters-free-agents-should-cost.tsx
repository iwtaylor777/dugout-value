import Link from "next/link";
import type { Article } from "./types";
import { AUTHOR } from "./types";

const FILES = "/research/fa-predictions-2026-27";

/** Frozen predictions: name, position, 2027 age, years, total and AAV ($M), copied from predictions_frozen.json (model 2026-10-25.1). */
const predictions: [string, string, number, number, number, number, string?][] = [
  ["Tarik Skubal", "SP", 30, 10, 533.6, 53.4, "AAV above any pitcher's record"],
  ["Bo Bichette", "3B/SS/2B", 29, 6, 168.8, 28.1, "Assumes he opts out"],
  ["Teruaki Sato", "3B/OF", 28, 4, 95.2, 23.8, "Posting fee, translated projection"],
  ["Kris Bubic", "SP", 30, 4, 91.4, 22.9],
  ["Trent Grisham", "OF", 31, 4, 86.1, 21.5],
  ["Daulton Varsho", "OF", 31, 4, 76.7, 19.2],
  ["Jazz Chisholm Jr.", "2B/OF", 29, 4, 74.0, 18.5],
  ["Freddy Peralta", "SP", 31, 4, 68.4, 17.1],
  ["Gleyber Torres", "2B", 30, 4, 60.7, 15.2],
  ["Trevor Rogers", "SP", 29, 4, 60.2, 15.1],
  ["Foster Griffin", "RP", 32, 3, 57.9, 19.3, "Projected in relief"],
  ["Dustin May", "RP", 30, 3, 57.7, 19.2, "Projected in relief"],
  ["Brady Singer", "SP", 31, 4, 54.6, 13.6],
  ["Drew Rasmussen", "SP", 32, 4, 53.3, 13.3],
  ["Seiya Suzuki", "DH/OF", 33, 3, 47.3, 15.8],
  ["Adrian Morejon", "RP", 28, 3, 41.9, 14],
  ["Ian Happ", "OF", 33, 3, 40.5, 13.5],
  ["J.P. Crawford", "SS", 32, 3, 35.7, 11.9],
  ["Bryan Abreu", "RP", 30, 3, 33.7, 11.2],
  ["Hunter Harvey", "RP", 32, 3, 33.7, 11.2],
  ["Jack Flaherty", "SP", 32, 2, 28.8, 14.4],
  ["David Peterson", "SP", 32, 2, 28.8, 14.4],
  ["Shane Bieber", "SP", 32, 2, 26.5, 13.2],
  ["Brandon Woodruff", "SP", 34, 2, 26.5, 13.3],
  ["Casey Mize", "SP", 30, 2, 24.2, 12.1],
  ["Ha-Seong Kim", "SS", 32, 2, 23.1, 11.5],
  ["Clay Holmes", "SP", 34, 2, 23.1, 11.6],
  ["Jeff McNeil", "2B/3B/CF", 35, 2, 22.0, 11],
  ["TJ Friedl", "OF", 32, 2, 21.9, 11],
  ["Zac Gallen", "SP", 32, 2, 21.9, 11],
  ["Zack Littell", "SP", 32, 2, 21.9, 11],
];
const money = (m: number) => (m >= 100 ? `$${m.toFixed(0)}M` : `$${m.toFixed(1)}M`);

export const article: Article = {
  slug: "what-this-winters-free-agents-should-cost",
  category: "Research",
  title: "Tarik Skubal is worth $534 million on the open market",
  summary:
    "The trade model prices Tarik Skubal at 10 years and $534 million, and its frozen predictions for the rest of the top free agents will be scored as they sign.",
  author: AUTHOR,
  published: "2026-10-25",
  dateLabel: "October 25, 2026",
  readTime: "7 min read",
  relatedTool: { href: "/tools/rankings", label: "Value rankings: every player priced with model 2026-10-25.1" },
  evidence: {
    href: `${FILES}.tar.gz`,
    label: "Frozen predictions, protocol, input hashes and calibration summary (download)",
  },
  body: (
    <>
      <p className="article-lead">
        Tarik Skubal is the best pitcher to reach free agency in years, and the trade model thinks he’s worth $534 million over 10 years, or $53.4 million a season. That would be the largest annual salary a pitcher has ever signed for by about $10 million, which is one of several places where I expect the market to push back. Below are the model’s prices for the 30 most valuable free agents plus Teruaki Sato, frozen on October 25, before free agency opens, so that every one of them can be checked against the contract he actually signs.
      </p>

      <h2>How the prices work</h2>
      <p>
        The trade model estimates what a player is worth on an open market: his projected wins each season, times a price per win, with extra for star-level seasons, adjusted for inflation and discounted over time. For a free agent, the predicted contract is the one the model would call a fair deal, a flat salary whose discounted value equals the discounted value of his projected seasons. The term comes from a fixed rule: a contract runs as long as the player projects to stay a regular, up to limits that depend on his age, his role and how good he is. Those rules are written down in the protocol and weren’t adjusted player by player.
      </p>
      <p>
        Before freezing anything, I checked the model’s prices against about 760 free-agent contracts of at least $2 million a year signed from 2020 to 2026, and found it was off in opposite directions for different players. It valued hitters and starters about 10% above what they signed for, so the price per win drops from $12 million to $11 million and the star premium from 30% to 20%, settings that match what last winter’s hitters and starters received almost exactly when measured against the projections available at signing. Relievers were underpriced: depending on the sample, the market paid them somewhere between 30% and 100% more per win than the model did, so relievers projected above 0.8 WAR now get a 50% premium. Those changes ship as model 2026-10-25.1 across the site’s tools.
      </p>

      <h2>The predictions</h2>
      <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Free-agent contract predictions"><table><caption>Model 2026-10-25.1 contract predictions, frozen before free agency opened. Age is for the 2027 season.</caption><thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Pos</th><th scope="col">Age</th><th scope="col">Years</th><th scope="col">Total</th><th scope="col">AAV</th><th scope="col">Flag</th></tr></thead><tbody>
        {predictions.map(([name, pos, age, years, total, aav, flag], i) => (
          <tr key={name}><td className="num">{i + 1}</td><th scope="row">{name}</th><td>{pos}</td><td className="num">{age}</td><td className="num">{years}</td><td className="num">{money(total)}</td><td className="num">{money(aav)}</td><td>{flag ?? ""}</td></tr>
        ))}
      </tbody></table></div>

      <h2>Where I expect the market to disagree</h2>
      <p>
        The rule for this exercise is that the model’s number is the prediction, and I only flag a player when there’s a specific reason the market should pay something different. Skubal is the clearest case, because no pitcher has signed for more than $43.3 million a year, the record Max Scherzer and Justin Verlander share, and even Gerrit Cole’s nine-year deal at 29 came in at $36 million a year. Hitters have gone well past that, most recently Kyle Tucker at $60 million a season, so the money exists. I’d still expect Skubal’s annual salary to land below $53.4 million, and the total to get close to $534 million only if a team goes beyond 10 years or defers money.
      </p>
      <p>
        Sato is the most uncertain prediction on the list. He has no major-league projection, so I translated his Nippon Professional Baseball record with a simple rule: his last three seasons’ wRC+, weighted toward the most recent, imply about a 120 wRC+ in the majors and 2.8 WAR next season, rounded down for a strikeout rate near 27%. The model calls that four years and $95.2 million. The team that signs him also owes Hanshin a release fee, 20% of the first $25 million, 17.5% of the next $25 million and 15% above that, which should push his own contract below his value.
      </p>
      <p>
        A few other flags are structural. Bo Bichette’s price assumes he opts out of the two years and $84 million left on his deal, which the model expects because his market value is about twice that. Dustin May and Foster Griffin are projected in relief, so the reliever premium applies to them, and a team that signs either one to start would price him differently. Any player who receives a qualifying offer, which teams must extend within five days of the World Series, should land below the model, because signing him costs a draft pick. I’ll score that flag only for the players who actually receive one.
      </p>

      <h2>Who isn’t here</h2>
      <p>
        Some of the best players with expiring contracts aren’t expected to reach the market, and the protocol decides that from the model rather than from news reports. Atlanta owes Ronald Acuña Jr. a $10 million buyout if it declines his $17 million club option, so keeping him for 2027 costs only $7 million more, far below his value. The same logic keeps Luis Robert Jr. and Sandy Alcantara off the list. Corbin Burnes and Michael King are expected to stay put, because the money left on their deals exceeds what the model thinks the market would pay. I left out Emmanuel Clase because his pending federal case makes his market impossible to model.
      </p>

      <h2>How this gets scored</h2>
      <p>
        Each player is scored once he signs a guaranteed major-league contract, through Opening Day 2027. The main measure is the typical percentage miss on total guaranteed value, with misses on years and AAV reported alongside it. The comparison points are the FanGraphs crowdsourced predictions and MLB Trade Rumors’ annual top-50 forecast, each captured with a date and counted only for players who hadn’t signed yet. Players who don’t reach free agency, or who sign minor-league deals, come off the board, and I’ll say which.
      </p>
      <p>
        The predictions, the protocol and the hashes of every input are in <a href={`${FILES}.tar.gz`}>the research bundle</a>, so anyone can check that nothing moved after the freeze. For about a day after publication, this article used different settings, $10.5 million per win and a 10% star premium, which put Skubal at $486 million. I made that change after checking the model against the largest long-term contracts since 2020, but most of those were signed from 2020 to 2023, and free-agent prices have since risen much faster than the model’s 3% annual inflation: measured against three-year WAR averages, players who signed from 2022 to 2024 got 80% to 85% of the model’s price, while last winter’s class got all of it and the $100 million contracts of the past two winters came in about 16% above it. So I restored the original settings and the original freeze, which is the one that will be scored, and the bundle records both changes with their timestamps. The model itself is the same one behind the site’s <Link href="/tools/rankings">value rankings</Link> and <Link href="/tools/trade">trade builder</Link>.
      </p>

      <h2>Methods in brief</h2>
      <ul>
        <li><strong>Free-agent class:</strong> MLB Trade Rumors’ 2026–27 list as of October 19, 2026, plus Sato.</li>
        <li><strong>Projections:</strong> ZiPS for 2027–28 from the site’s database (refreshed October 18), extended with the site’s aging model.</li>
        <li><strong>Model:</strong> 2026-10-25.1. That is $11 million per WAR, a 20% premium above 2 WAR, 3% inflation and a 10% discount rate, with a 50% reliever premium above 0.8 projected WAR.</li>
        <li><strong>Term:</strong> consecutive seasons projected at 1.0 WAR or more (0.5 for relievers), capped by role, projected WAR and age. Players projected at 4.5 WAR or more can go to 10 years.</li>
        <li><strong>Calibration:</strong> 2020–26 free-agent contracts from FanGraphs’ free-agent tracker. Projections at signing exist only for the 2026 class, so earlier years used a weighted three-year WAR average.</li>
      </ul>
    </>
  ),
};
