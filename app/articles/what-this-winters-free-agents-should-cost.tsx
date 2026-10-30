import Link from "next/link";
import type { Article } from "./types";
import { AUTHOR } from "./types";
import forecast from "../../public/research/fa-predictions-2026-27/predictions_frozen.json";

const FILES = "/research/fa-predictions-2026-27";
const predictions = forecast.predictions;
const money = (m: number) => m >= 100 ? `$${m.toFixed(0)}M` : `$${m.toFixed(1)}M`;

export const article: Article = {
  slug: "what-this-winters-free-agents-should-cost",
  category: "Research",
  title: "Tarik Skubal is worth $386 million on the open market",
  summary: "My current projections price Tarik Skubal at 10 years and $386 million. Here are the contract estimates for the top 30 modeled MLB free agents, plus Teruaki Sato, recorded for comparison with the deals they sign.",
  author: AUTHOR,
  published: "2026-10-25",
  dateLabel: "October 25, 2026",
  status: "Estimates as of October 29, 2026, using Dugout Value projections through the completed 2026 season. Revised the same evening: Skubal’s term is set to 10 years by hand, and Jake Bauers is noted as a likely qualifying-offer acceptance.",
  readTime: "7 min read",
  relatedTool: { href: "/tools/projections", label: "Explore the player forecasts behind the prices" },
  evidence: { href: `${FILES}.tar.gz`, label: "Dated predictions, scoring rules and input checksums (download)" },
  body: (
    <>
      <p className="article-lead">I estimate Tarik Skubal’s open-market value at 10 years and $386 million, or $38.6 million a season. That price starts from 5.34 projected WAR in 2027 and follows his expected production through the contract. Below are my estimates for the top 30 modeled major-league free agents, plus Teruaki Sato. I have recorded the numbers so I can compare them with the contracts these players subsequently sign.</p>

      <h2>What the price means</h2>
      <p>I price the production a player is projected to deliver, then solve for the flat annual salary with the same discounted value. The model starts at $11 million per win, after a roster-spot allowance, and pays 20% more for net wins above two in a season. Prices rise 3% a year, and future seasons are discounted at 10%. Relievers projected above 0.8 WAR receive a 50% premium, reflecting how the market has priced their wins.</p>
      <p>The contract length comes from a fixed rule. A hitter or starter remains eligible while he projects for at least one WAR a season; a reliever needs half a win. Caps depend on age, role and next-year WAR, with up to 10 years for players projected at 4.5 WAR or better. I apply the same age, role and projected-WAR rules to every player.</p>
      <p>These are estimates of a fair price under the model, not a claim that clubs will agree. A team can pay for a different view of the player, a roster need, a shorter competitive window or a contract structure the model does not represent.</p>

      <h2>The forecasts use the completed 2026 season</h2>
      <p>The estimates use <Link href="/analysis/our-projections-replace-zips">DV Projections</Link>, my projection system built from public data through 2026. The ZiPS forecasts stored in the database were published earlier and do not contain the same completed-season information. I use the current DV forecasts where the model has enough MLB history; Sato gets a separate translation from his Japanese record.</p>
      <p>The models combine a player’s results with contact quality, plate discipline, pitching traits, age and history. WAR rate and workload are estimated separately. For years two through five, separate horizon models are blended with a historical aging curve, then smoothed. Later seasons follow fixed age and workload curves from that five-year forecast. A full-season valuation workload is used for pricing; it does not assume I can predict precisely which seasons a player will miss through injury.</p>
      <p>The long-range path matters particularly for Skubal. He projects for 5.34 WAR in 2027, 3.23 in 2031, 1.37 in 2035 and 0.89 in 2036. The term rule stops at nine years, when he drops below one win, which gives $367 million. That is the one term I’ve set by hand: the top of the market has given aces longer deals than the rule allows, so I’m predicting 10 years. The 10th season is priced from the same forecast, so it adds only about $19 million. For everyone else the rule stands: it gives Jazz Chisholm Jr. four years and $89.4 million, Freddy Peralta four years and $74.4 million, and Ryan Jeffers four years and $62.4 million.</p>

      <h2>The predictions</h2>
      <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Free-agent contract estimates"><table><caption>Estimates recorded October 29, 2026. Dollars are millions; age is for 2027. The 2026 WAR column is FanGraphs WAR, not the forecast used to price the contract.</caption><thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Pos</th><th scope="col">Age</th><th scope="col">2026 WAR</th><th scope="col">2027 forecast</th><th scope="col">Years</th><th scope="col">Total</th><th scope="col">AAV</th></tr></thead><tbody>
        {predictions.map(p => <tr key={p.player}><td className="num">{p.rank}</td><th scope="row">{p.player}</th><td>{p.position}</td><td className="num">{p.age_2027}</td><td className="num">{p.war_2026 === null ? "—" : p.war_2026.toFixed(1)}</td><td className="num">{p.war_2027.toFixed(2)}</td><td className="num">{p.years}</td><td className="num">{money(p.total_musd)}</td><td className="num">{money(p.aav_musd)}</td></tr>)}
      </tbody></table></div>

      <h2>Where the uncertainty is largest</h2>
      <p>Adrian Morejon’s four years and $91.1 million is the clearest place I expect the market to come in below the model. His forecast is 1.77 WAR next season, and the reliever premium makes those wins expensive. A club may value that production less if it sees him as a setup man rather than a closer. That is a flag on the numeric prediction, not a manual discount to it.</p>
      <p>Sato is the least certain projection. I translated his NPB performance using the observed transition of six Japanese hitters to MLB, a small comparison group. The result is about 2.5 WAR next season and four years at $20 million a year. The signing team also owes Hanshin a posting fee, so I expect Sato’s own contract to fall below the model’s valuation of his production.</p>
      <p>A qualifying offer can also depress a player’s offers because of the draft compensation attached to signing him. I apply that directional flag only to players who actually receive an offer and are subject to compensation. It does not change the table’s numbers.</p>

      <h2>Who reaches the market?</h2>
      <p>The list starts from the dated free-agent class and uses contract decisions to determine who is expected to become available. A club exercises an option when the player’s projected value exceeds the option’s cost net of the buyout. A player is expected to opt out when the modeled value over the years he would give up exceeds the money remaining.</p>
      <p>That keeps Ronald Acuña Jr., Drew Rasmussen, Nick Pivetta and Garrett Whitlock off the list, along with Sandy Alcantara on his $21 million option. It also has Bo Bichette and Clay Holmes staying with their contracts. Actual decisions take priority over those assumptions: <a href="https://www.mlb.com/amp/news/michael-king-free-agent-2027.html">MLB reported Michael King’s opt-out</a>, so he is included at four years and $69.4 million. Jake Bauers isn’t on the list either. After his 3.6-WAR season I expect Milwaukee to make him a qualifying offer and him to accept it.</p>
      <p>The table ranks the 30 highest modeled totals among players expected to reach the market, with Sato added separately. Players without a usable projection are listed as unmodeled in the research files; they are not silently assigned a zero-dollar forecast.</p>

      <h2>How I checked the prices</h2>
      <p>I set the price scale and role premiums using 2020–26 free-agent contracts, before producing these estimates. That is calibration to past market pay, not proof that the same price is right for every player or that a club will buy the same aging path. I have kept those pricing settings fixed for this class rather than adjusting them to make individual contracts look more plausible.</p>
      <p>The projection tests answer a different question. DV’s hitter wOBA forecasts were competitive with preseason ZiPS and Steamer, and its pitcher FIP forecasts improved on ZiPS. In an additional test of total season WAR, including players who never appeared, DV with its expected workloads had lower error than ZiPS and was close to Steamer. The fuller workloads used here are for valuation and were more optimistic than realized season totals. Those distinctions matter when turning a baseball forecast into a price.</p>

      <h2>How I will score the predictions</h2>
      <p>I will score each player’s guaranteed MLB contract through Opening Day 2027. The main measure is mean absolute log error on total guaranteed value, with errors in years and annual salary alongside it. I will also compare with dated FanGraphs crowdsourced forecasts and MLB Trade Rumors’ predictions on players covered by every forecast, counting only predictions captured before the relevant signing.</p>
      <p>Players who stay under contract, retire, sign minor-league deals or otherwise do not enter the scored market will be reported separately. Directional flags are scored separately from the numeric estimates. The <a href={`${FILES}.tar.gz`}>research download</a> contains the dated table, scoring rules, code and input checksums, with earlier dated estimates retained for reference.</p>

      <h2>Methods in brief</h2>
      <ul>
        <li><strong>Class:</strong> MLB Trade Rumors’ October 19, 2026 free-agent list, with King’s reported opt-out included; the top 30 modeled totals plus Sato.</li>
        <li><strong>Forecasts:</strong> DV data through 2026, five-year rate and workload paths, then age-based extensions. Sato uses the separately estimated NPB translation.</li>
        <li><strong>Pricing:</strong> $11 million per net WAR, 20% premium above two net wins, 3% annual inflation and 10% discounting; a 50% reliever premium above 0.8 projected WAR. Roster allowances are 0.5 WAR for hitters and starters and 0.2 for relievers.</li>
        <li><strong>Contract:</strong> flat annual salary with the same present value as projected production; the published term, age and role rules apply to every player except Skubal, whose term is set to 10 years by hand. Posting fees and qualifying-offer compensation are not deducted from the quoted prices.</li>
      </ul>
    </>
  ),
};
