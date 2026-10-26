import Link from "next/link";
import type { Article } from "./types";
import { AUTHOR } from "./types";

const FILES = "/research/fa-predictions-2026-27";

/**
 * Frozen predictions (Amendment 4, model 2026-10-25.1): name, position, 2027 age,
 * 2026 fWAR (null if under the update threshold), years, total and AAV ($M), flag.
 * Copied from predictions_frozen.json.
 */
const predictions: [string, string, number, number | null, number, number, number, string?][] = [
  ["Tarik Skubal", "SP", 30, 5.2, 10, 506.1, 50.6, "AAV above any pitcher's record"],
  ["Jazz Chisholm Jr.", "2B", 29, 3.5, 4, 97.7, 24.4],
  ["Kris Bubic", "SP", 30, 1.0, 4, 81.7, 20.4],
  ["Teruaki Sato", "3B", 28, null, 4, 80.0, 20.0, "Posting fee, translated projection"],
  ["Trevor Rogers", "SP", 29, 4.0, 4, 75.9, 19.0],
  ["Randy Arozarena", "LF", 32, 5.5, 4, 74.2, 18.6],
  ["Seiya Suzuki", "RF", 33, 4.5, 4, 68.6, 17.1],
  ["Adrian Morejon", "RP", 28, 2.8, 3, 59.5, 19.8],
  ["Freddy Peralta", "SP", 31, 1.9, 4, 57.6, 14.4],
  ["Sandy Alcantara", "SP", 32, 3.2, 4, 53.3, 13.3, "Assumes his option is declined"],
  ["Trent Grisham", "CF", 31, 0.7, 4, 52.0, 13.0],
  ["Luis Arraez", "2B", 30, 4.1, 4, 51.9, 13.0],
  ["Jack Flaherty", "SP", 32, 1.3, 4, 48.6, 12.1],
  ["José Suarez", "RP", 29, 0.6, 3, 47.2, 15.7],
  ["Ian Happ", "LF", 33, 2.6, 3, 37.0, 12.3],
  ["Hunter Harvey", "RP", 32, null, 3, 33.7, 11.2, "Projection not updated for 2026"],
  ["Casey Mize", "SP", 30, 2.3, 2, 28.8, 14.4],
  ["Daulton Varsho", "CF", 31, 0.8, 2, 28.8, 14.4],
  ["Brandon Woodruff", "SP", 34, 1.2, 2, 28.8, 14.4],
  ["Gleyber Torres", "2B", 30, 1.0, 2, 27.7, 13.9],
  ["David Peterson", "SP", 32, 1.7, 2, 27.7, 13.8],
  ["Ryan Jeffers", "C", 30, 2.5, 2, 25.4, 12.7],
  ["David Bednar", "RP", 33, 1.9, 3, 24.0, 8.0],
  ["Brandon Lowe", "2B", 33, 4.9, 2, 23.1, 11.6],
  ["Dustin May", "SP", 30, 2.8, 2, 23.0, 11.5],
  ["Foster Griffin", "SP", 32, 2.6, 2, 21.9, 10.9],
  ["Michael Soroka", "SP", 30, 2.7, 2, 21.9, 10.9],
  ["Clay Holmes", "SP", 34, 1.8, 2, 20.8, 10.4, "Assumes he opts out"],
  ["Patrick Sandoval", "SP", 31, 1.3, 2, 19.6, 9.8],
  ["Brady Singer", "SP", 31, 0.1, 2, 19.6, 9.8],
  ["Tyler Stephenson", "C", 31, 1.3, 2, 19.6, 9.8],
];
const money = (m: number) => (m >= 100 ? `$${m.toFixed(0)}M` : `$${m.toFixed(1)}M`);

export const article: Article = {
  slug: "what-this-winters-free-agents-should-cost",
  category: "Research",
  title: "Tarik Skubal is worth $506 million on the open market",
  summary:
    "The trade model prices Tarik Skubal at 10 years and $506 million, and its frozen predictions for the rest of the top free agents will be scored as they sign.",
  author: AUTHOR,
  published: "2026-10-25",
  dateLabel: "October 25, 2026",
  readTime: "9 min read",
  relatedTool: { href: "/tools/rankings", label: "Value rankings: every player priced with the same model and projections" },
  evidence: {
    href: `${FILES}.tar.gz`,
    label: "Frozen predictions, protocol and amendments, input hashes and calibration (download)",
  },
  body: (
    <>
      <p className="article-lead">
        Tarik Skubal is the best pitcher to reach free agency in years, and the trade model thinks he’s worth $506 million over 10 years, or $50.6 million a season. That would be the largest annual salary a pitcher has ever signed for by about $7 million, which is one of several places where I expect the market to push back. Below are the model’s prices for the 30 most valuable free agents plus Teruaki Sato, frozen before free agency opens so that every one of them can be checked against the contract he actually signs.
      </p>

      <h2>How the prices work</h2>
      <p>
        The trade model estimates what a player is worth on an open market: his projected wins each season, times a price per win, with extra for star-level seasons, adjusted for inflation and discounted over time. For a free agent, the predicted contract is the one the model would call a fair deal, a flat salary whose discounted value equals the discounted value of his projected seasons. The term comes from a fixed rule: a contract runs as long as the player projects to stay a regular, up to limits that depend on his age, his role and how good he is. Those rules are written down in the protocol and weren’t adjusted player by player.
      </p>
      <p>
        The projections start from ZiPS, updated for the 2026 season. Spring ZiPS couldn’t know that Randy Arozarena would put up 5.5 WAR or that Daulton Varsho would manage 0.8, so each player’s 2027 projection blends a regressed, age-adjusted three-season WAR rate with the part of ZiPS’s view that goes beyond it. I fit that blend on how well each source predicted 2026, and it gives ZiPS’s extra information about 60% of its weight. Pitchers’ roles also follow their 2026 usage, which is why Dustin May and Foster Griffin, who made 31 starts each, are priced as starters.
      </p>
      <p>
        Before freezing anything, I checked the model’s prices against about 760 free-agent contracts of at least $2 million a year signed from 2020 to 2026. It valued last winter’s hitters and starters about 10% above what they signed for, measured against the projections available at signing, so the price per win drops from $12 million to $11 million and the star premium from 30% to 20%. Relievers were the opposite problem: depending on the sample, the market paid them somewhere between 30% and 100% more per win than the model did, so relievers projected above 0.8 WAR now get a 50% premium. Those changes ship as model 2026-10-25.1 across the site’s tools.
      </p>
      <p>
        Hitters whose value comes from their gloves do sign for less than their WAR suggests, but that discount matches how much less reliably fielding carries forward, and projections already account for it, as I explain in <Link href="/analysis/teams-pay-less-for-defense">a separate piece on how teams price defense</Link>. So these predictions price projected fielding at full credit, like everything else.
      </p>

      <h2>The predictions</h2>
      <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Free-agent contract predictions"><table><caption>Contract predictions, frozen before free agency opened (Amendment 4). Age is for the 2027 season; 2026 fWAR is from FanGraphs.</caption><thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Pos</th><th scope="col">Age</th><th scope="col">2026 fWAR</th><th scope="col">Years</th><th scope="col">Total</th><th scope="col">AAV</th><th scope="col">Flag</th></tr></thead><tbody>
        {predictions.map(([name, pos, age, war26, years, total, aav, flag], i) => (
          <tr key={name}><td className="num">{i + 1}</td><th scope="row">{name}</th><td>{pos}</td><td className="num">{age}</td><td className="num">{war26 === null ? "—" : war26.toFixed(1)}</td><td className="num">{years}</td><td className="num">{money(total)}</td><td className="num">{money(aav)}</td><td>{flag ?? ""}</td></tr>
        ))}
      </tbody></table></div>

      <h2>Where I expect the market to disagree</h2>
      <p>
        The rule for this exercise is that the model’s number is the prediction, and I only flag a player when there’s a specific reason the market should pay something different. Skubal is the clearest case, because no pitcher has signed for more than $43.3 million a year, the record Max Scherzer and Justin Verlander share, and even Gerrit Cole’s nine-year deal at 29 came in at $36 million a year. Hitters have gone well past that, most recently Kyle Tucker at $60 million a season, so the money exists. I’d still expect Skubal’s annual salary to land below $50.6 million, and the total to get close to $506 million only if a team goes beyond 10 years or defers money.
      </p>
      <p>
        Sato is the most uncertain prediction on the list. He has no major-league projection, so I translated his Nippon Professional Baseball record using the six Japanese hitters who have come over since 2020. Their first two seasons in the majors kept about 17% of their NPB edge over league average: Seiya Suzuki went from a weighted 180 wRC+ to 123, Munetaka Murakami from 183 to 129, and Shogo Akiyama from 148 to 63. Sato’s 181 translates to about a 114 wRC+ and 2.5 WAR next season, which the model calls four years and $80 million. The team that signs him also owes Hanshin a release fee, 20% of the first $25 million, 17.5% of the next $25 million and 15% above that, which should push his own contract below his value.
      </p>
      <p>
        A few other flags are structural. Sandy Alcantara’s price assumes Miami declines his $21 million option, and Clay Holmes’s assumes he opts out of the $12 million left on his deal, which the model expects by a narrow margin. Hunter Harvey barely pitched in 2026, so his projection is still spring ZiPS and doesn’t reflect the lost season. Any player who receives a qualifying offer, which teams must extend within five days of the World Series, should land below the model, because signing him costs a draft pick. I’ll score that flag only for the players who actually receive one.
      </p>

      <h2>Who isn’t here</h2>
      <p>
        Some of the best players with expiring contracts aren’t expected to reach the market, and the protocol decides that from the model rather than from news reports. Atlanta owes Ronald Acuña Jr. a $10 million buyout if it declines his $17 million club option, so keeping him for 2027 costs only $7 million more, far below his value. The same logic keeps Drew Rasmussen, Garrett Whitlock and Nick Pivetta off the list. Bo Bichette can opt out of the two years and $84 million left on his deal, but after a 1.9-WAR season his market value for those two years is about $45 million, so the model expects him to stay. Corbin Burnes, Michael King, Tatsuya Imai and Luis Severino are expected to stay put for the same reason. I left out Emmanuel Clase because his pending federal case makes his market impossible to model.
      </p>

      <h2>How this gets scored</h2>
      <p>
        Each player is scored once he signs a guaranteed major-league contract, through Opening Day 2027. The main measure is the typical percentage miss on total guaranteed value, with misses on years and AAV reported alongside it. The comparison points are the FanGraphs crowdsourced predictions and MLB Trade Rumors’ annual top-50 forecast, each captured with a date and counted only for players who hadn’t signed yet. Players who don’t reach free agency, or who sign minor-league deals, come off the board, and I’ll say which.
      </p>
      <p>
        The predictions, the protocol and the hashes of every input are in <a href={`${FILES}.tar.gz`}>the research bundle</a>, so anyone can check that nothing moved after the freeze. The model itself is the same one behind the site’s <Link href="/tools/rankings">value rankings</Link> and <Link href="/tools/trade">trade builder</Link>, which now use the same 2026-updated projections.
      </p>

      <h2>How this list changed before the market opened</h2>
      <p>
        This is the fourth set of numbers this article has carried, and every change came before free agency opened and before any signing. The first version, frozen on October 25, priced Skubal at $534 million. That evening I lowered the price per win to $10.5 million and the star premium to 10%, which put him at $486 million, after checking the model against the largest long-term contracts since 2020. I restored the original settings the next morning, because most of those contracts were signed from 2020 to 2023 and free-agent prices have since risen much faster than the model’s 3% inflation: players who signed from 2022 to 2024 got 80% to 85% of the model’s price, while last winter’s class got all of it.
      </p>
      <p>
        Later on October 26, checking players who looked mispriced turned up a bigger problem. The projections behind the first version never saw the 2026 season, because the site’s in-season adjustment stopped when the season ended, so Arozarena was projected for 1.6 WAR after a 5.5-WAR season and Varsho for 2.5 after 0.8. Fixing that, along with the starters who had been tagged as relievers, a rule that compared Bichette’s opt-out across different numbers of years and the Sato translation, changed most of the list. That version also gave hitters only half credit for projected fielding, which I removed the same afternoon after <Link href="/analysis/teams-pay-less-for-defense">a closer look</Link> showed it double-counted a discount projections already make. The amendments, their timestamps and every earlier version are in the bundle, and these are the predictions that will be scored.
      </p>

      <h2>Methods in brief</h2>
      <ul>
        <li><strong>Free-agent class:</strong> MLB Trade Rumors’ 2026–27 list as of October 19, 2026, plus Sato.</li>
        <li><strong>Projections:</strong> ZiPS for 2027–28 from the site’s database, updated for 2026 by a blend fit on 2015–26 FanGraphs data, then extended with the site’s aging model. Players with under 100 PA or 20 innings in 2026, and the 50 players in FanGraphs’ Trade Value Series, keep their ZiPS.</li>
        <li><strong>Model:</strong> 2026-10-25.1. That is $11 million per WAR, a 20% premium above 2 WAR, 3% inflation and a 10% discount rate, with a 50% reliever premium above 0.8 projected WAR.</li>
        <li><strong>Term:</strong> consecutive seasons projected at 1.0 WAR or more (0.5 for relievers), capped by role, projected WAR and age. Players projected at 4.5 WAR or more can go to 10 years.</li>
        <li><strong>Options and opt-outs:</strong> a club option is exercised if the player’s 2027 value exceeds its net cost; a player opts out if his market value over the years left beats the money left.</li>
        <li><strong>Calibration:</strong> 2020–26 free-agent contracts from FanGraphs’ free-agent tracker. Projections at signing exist only for the 2026 class, so earlier years used a weighted three-year WAR average.</li>
      </ul>
    </>
  ),
};
