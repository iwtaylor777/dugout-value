import Link from "next/link";
import data from "../../public/research/transactions-2026-11-18.json";
import { AUTHOR, type Article } from "./types";
import { tradeLink } from "./trade-link";

const players = data.players;
const money = (value: number) => `$${value.toFixed(1)} million`;
const tradeRows = [
  { name: "Maikel Garcia", club: "Seattle" },
  { name: "James McArthur", club: "Seattle" },
  { name: "Bryce Miller", club: "Kansas City" },
  { name: "Logan Evans", club: "Kansas City" },
  { name: "José A. Ferrer", club: "Kansas City" },
] as const;
const loadedTrade = tradeLink("SEA", ["mlb-682243", "mlb-688138", "mlb-678606"], "KCR", ["mlb-672580", "mlb-663704"]);

export const article: Article = {
  slug: "seattle-gets-the-edge-in-the-garcia-miller-trade",
  category: "Analysis",
  title: "Seattle gets the edge in the García–Miller trade",
  summary: "The two packages project for almost identical 2027 WAR. García’s contract and the concentration of value give Seattle the advantage. Plus, what I make of the Gray and May contracts, Boston’s catcher swap and the Angels’ bet on Jace Jung.",
  author: AUTHOR,
  published: "2026-11-18",
  dateLabel: "November 18, 2026",
  readTime: "6 min read",
  featured: true,
  featurePanel: <div className="evidence-panel">
    <p className="eyebrow">García–Miller trade · November 18</p>
    <h3>Nearly equal 2027 WAR.<br />An edge in value for Seattle.</h3>
    <div className="evidence-result"><span>Seattle’s covered return</span><strong className="result-better">${data.trade.SeattleKnown.toFixed(1)}M</strong><p>{data.trade.Seattle_2027_WAR.toFixed(2)} projected WAR in 2027</p></div>
    <div className="evidence-result"><span>Kansas City’s covered return</span><strong>${data.trade.KansasCity.toFixed(1)}M</strong><p>{data.trade.KansasCity_2027_WAR.toFixed(2)} projected WAR in 2027</p></div>
    <p className="evidence-caption">Present-value surplus under DV’s default settings. Seattle also receives L.P. Langevin, who is outside model coverage.</p>
  </div>,
  relatedTool: { href: "/tools/gm", label: "Build your team in GM mode" },
  evidence: { href: "/research/transactions-2026-11-18.json", label: "November 18 projections and valuation calculations" },
  body: <>
    <p className="article-lead">Add up the player forecasts in Wednesday’s Seattle–Kansas City trade and you get an almost perfect tie. The Mariners receive {data.trade.Seattle_2027_WAR.toFixed(2)} projected WAR for next season. The Royals receive {data.trade.KansasCity_2027_WAR.toFixed(2)}. I still prefer Seattle’s side, because Maikel García puts most of that production in one lineup spot, at a favorable salary, with several years of control.</p>
    <p>That distinction runs through a busy day of moves. The size of a contract tells us relatively little until we know how many seasons it buys. A catcher’s forecast means something different when he is backing up Adley Rutschman. And a player available for cash can be a good acquisition with a fairly ordinary projection.</p>

    <h2>Seattle buys the best player in the deal</h2>
    <p>The Mariners acquired García, James McArthur and L.P. Langevin for Bryce Miller, Logan Evans and José Ferrer. <a href="https://www.mlb.com/royals/news/bryce-miller-royals-mariners-trade">MLB.com’s trade report.</a></p>
    <p>Here is how the covered players look under DV’s default settings. Surplus value subtracts projected salaries from the value of the production and discounts future seasons. The dollar figures cover each player’s remaining control.</p>
    <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Mariners and Royals trade projections">
      <table>
        <caption>DV projections and present-value surplus, November 18, 2026</caption>
        <thead><tr><th scope="col">Player</th><th scope="col">New club</th><th scope="col" className="num">2027 WAR</th><th scope="col" className="num">Surplus value</th></tr></thead>
        <tbody>{tradeRows.map(row => {
          const player = players[row.name];
          return <tr key={row.name}><th scope="row">{row.name}</th><td>{row.club}</td><td className="num">{player.war["2027"].toFixed(2)}</td><td className="num">${player.surplus.toFixed(1)}M</td></tr>;
        })}</tbody>
      </table>
    </div>
    <p>Seattle gets about <strong>{money(data.trade.SeattleKnown)}</strong> in covered value against <strong>{money(data.trade.KansasCity)}</strong> going to Kansas City. Langevin falls outside my model’s coverage, so Seattle’s total leaves him unpriced.</p>
    <p>García’s projection is a useful reminder of how a good third baseman can create value. DV forecasts a .261/.321/.387 line, a 99 wRC+, positive baserunning and above-average defense. Put that together over 646 plate appearances and he comes out at 3.07 WAR. His modeled salary is $7.2 million next season and $10.3 million the following year. Those early years account for much of the contract’s appeal.</p>
    <p>There is also a cost to spreading production across three roster spots. The valuation model allows for the ordinary production a team can find in a roster spot before pricing the remaining WAR. Miller’s 2.18 WAR, Evans’s 0.60 and Ferrer’s 0.80 therefore buy less than the same total concentrated in a better player. Actual roster gains also depend on whom those pitchers displace.</p>
    <p>I can see Kansas City’s argument. A better version of Miller would make this trade look different, and Evans offers inexpensive years of control. My forecast has Miller around a 4.1 ERA over 150 innings. Kansas City needs a stronger return from him, or more from Evans, to make up the gap. I would take García’s combination of production, salary and control.</p>
    <p><Link href={loadedTrade}>Compare the five covered players in the trade builder.</Link></p>

    <h2>Gray’s premium is larger than May’s</h2>
    <p>Minnesota signed Sonny Gray for two years and $55 million. Chicago announced Dustin May’s three-year, $52.5 million contract after Tuesday’s agreement. <a href="https://abc7news.com/post/mlb-free-agency-tracker-2026-27-offseason-trades-moves/20000238/">ESPN’s transaction tracker.</a></p>
    <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Starting-pitcher contract comparisons">
      <table>
        <caption>Projected production and DV value over the reported contract term</caption>
        <thead><tr><th scope="col">Pitcher</th><th scope="col" className="num">Years</th><th scope="col" className="num">Total WAR</th><th scope="col" className="num">DV value</th><th scope="col" className="num">Guarantee</th></tr></thead>
        <tbody>{(["Sonny Gray", "Dustin May"] as const).map(name => {
          const contract = data.contracts[name];
          return <tr key={name}><th scope="row">{name}</th><td className="num">{contract.years}</td><td className="num">{contract.war.toFixed(2)}</td><td className="num">${contract.dvValue.toFixed(1)}M</td><td className="num">${contract.guarantee.toFixed(1)}M</td></tr>;
        })}</tbody>
      </table>
    </div>
    <p>Gray’s deal is about 30% above my estimate. DV projects 2.61 WAR in 2027 and 2.04 in 2028, with a 3.91 ERA next season. Minnesota is paying for a stronger outcome, which is an understandable position to take on a pitcher it knows well. I am less comfortable with the price.</p>
    <p>The reported opt-out after 2027 adds to Gray’s side of the bargain. A strong season could send him back to the market, while a poor one leaves Minnesota responsible for the second year. The $42.4 million production estimate precedes that option value. <a href="https://www.sportsnet.ca/mlb/article/twins-sign-sonny-gray-to-two-year-contract/">Gray’s reported opt-out.</a></p>
    <p>May is closer to a fair purchase. DV values his projected 5.52 WAR over three years at $46.9 million, leaving a $5.6 million premium. That is roughly $1.9 million a year. A club with a rotation opening can reasonably pay that much for the player it wants.</p>
    <p>The third year matters to the comparison. My two-year value for May is $31.5 million. Comparing $52.5 million with that figure would make the deal look much more expensive, while leaving out an entire season Chicago bought. Over the same three years, the disagreement is fairly small.</p>

    <h2>Boston improves the backup catcher spot</h2>
    <p>The Red Sox acquired Nick Fortes for Angel Roa and designated Connor Wong for assignment. <a href="https://www.mlb.com/rays/news/nick-fortes-red-sox-rays-trade">Boston’s catcher moves.</a></p>
    <p>The offensive projections barely differ. Fortes has an 81 wRC+ forecast, Wong a 79. Defense creates most of the separation. At 200 plate appearances apiece, their projected WAR comes to about 0.56 and 0.03. At 250, it is 0.70 and 0.03.</p>
    <p>That makes Fortes roughly a half-win to two-thirds-of-a-win upgrade at a plausible backup workload. Rutschman’s presence limits the available playing time, but a team can still improve meaningfully around an established starter. I like the fit. Roa is outside my model’s coverage, leaving the prospect cost as the part of the deal I cannot price.</p>

    <h2>A reasonable bet on Jung</h2>
    <p>The Angels acquired Jace Jung for undisclosed cash. <a href="https://sports.yahoo.com/articles/tigers-deal-former-first-round-195726821.html">Jung’s move to Los Angeles.</a></p>
    <p>DV projects a 99 wRC+ and 1.05 WAR in 377 plate appearances. That would be useful production from a player earning close to the minimum. He needs an opportunity to establish himself, and an inexpensive acquisition gives the Angels room to find out.</p>
    <p>I put less weight on his displayed $9.7 million trade value, which still blends the performance forecast with his older prospect grade. Using the performance projection alone produces about $5 million in surplus. Either estimate gives me a reason to take a small bet. His projection is enough to make the acquisition interesting without requiring a return to his former prospect standing.</p>
    <p className="dc-note">Calculations use DV Projections v1.5 and the default valuation settings as of November 18. Workloads follow the full-season valuation assumptions. Arbitration salaries are estimates. Dollar values depend on those assumptions and carry more uncertainty than their decimal places suggest. <Link href="/tools/free-agents">Compare the free-agent contracts</Link> or <Link href="/tools/gm">try the updated rosters in GM mode</Link>.</p>
  </>,
};
