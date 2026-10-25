import Link from "next/link";
import type { Article } from "./types";
import { AUTHOR } from "./types";
import { tradeLink } from "./trade-link";

// Every figure below is from the July 31, 2026 snapshot at the site's default settings
// (valuationView "offseason", timingPreference 10), as listed in context/MODEL-NUMBERS.md.
// The no-discount figures ($574.2M, $8.3M) use timingPreference 0 with the same offseason view.

export const article: Article = {
  slug: "what-trade-value-measures",
  category: "Explainer",
  title: "Why Kevin McGonigle is worth 21 times Aaron Judge in trade",
  summary:
    "At the October 17 default settings (the offseason view, with July 31, 2026 data), the trade model puts McGonigle at $382.4 million of surplus value and Judge at $18.2 million. Judge is projected to be the better player in 2027, 5.8 fWAR to 5.4. The gap is salary and time: McGonigle is paid $150.0 million over eight seasons, Judge $200.0 million over five. These are model numbers, not asking prices.",
  author: AUTHOR,
  published: "2026-10-16",
  dateLabel: "October 16, 2026",
  readTime: "6 min read",
  relatedTool: {
    href: tradeLink("NYY", ["mlb-592450"], "DET", ["mlb-805808"]),
    label: "Put Judge and McGonigle on opposite sides in the trade builder",
  },
  body: (
    <>
      <p className="article-lead">
        In the trade model, Aaron Judge is worth $18.2 million and Kevin McGonigle is worth $382.4 million. Judge is projected to out-produce him next year, 5.8 fWAR (FanGraphs wins above replacement) to 5.4 in 2027. The model isn’t ranking players. It’s measuring surplus value: the wins a player is projected to produce, priced at what wins cost in free agency, minus what his team will pay him, added up over the years it controls him.
      </p>
      <p>
        Every number in this piece uses July 31, 2026 data in the Offseason view (2027 on), the default. Projections through 2031 for Judge and McGonigle are ZiPS from FanGraphs’ 2026 Trade Value Series. These figures use model 2026-10-17.1, the October 17 defaults of $12 million per win and a 30% star premium. The current tools use model 2026-10-25.1, so they will show different numbers.
      </p>

      <h2>A fair contract is worth almost nothing</h2>
      <p>
        The model prices a win at $12 million. It takes 0.5 wins off each regular player’s forecast first, the roster-spot allowance, because a team could get some wins from that spot anyway. It charges 30% more for each win past the first two, and it raises the price 3% a year. Judge’s 5.8 wins in 2027 come out at $77.7 million. His salary is $40.0 million, so the season leaves $37.7 million before discounting and $34.3 million after.
      </p>
      <p>
        The trouble is the rest of the deal. Judge is 34, and ZiPS has him sliding from 5.8 fWAR in 2027 to 1.4 in 2031. The salary doesn’t move.
      </p>
      <div className="article-table-wrap" tabIndex={0}>
        <table>
          <caption>Aaron Judge, 2027–31 (July 31, 2026 data, October 17 default settings)</caption>
          <thead>
            <tr>
              <th scope="col">Season</th>
              <th scope="col" className="num">fWAR</th>
              <th scope="col" className="num">Value of the wins</th>
              <th scope="col" className="num">Salary</th>
              <th scope="col" className="num">Surplus value</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">2027</th><td className="num">5.8</td><td className="num">$77.7M</td><td className="num">$40.0M</td><td className="num">$34.3M</td></tr>
            <tr><th scope="row">2028</th><td className="num">4.4</td><td className="num">$56.9M</td><td className="num">$40.0M</td><td className="num">$14.0M</td></tr>
            <tr><th scope="row">2029</th><td className="num">3.2</td><td className="num">$38.2M</td><td className="num">$40.0M</td><td className="num">−$1.4M</td></tr>
            <tr><th scope="row">2030</th><td className="num">2.2</td><td className="num">$23.0M</td><td className="num">$40.0M</td><td className="num">−$11.6M</td></tr>
            <tr><th scope="row">2031</th><td className="num">1.4</td><td className="num">$12.5M</td><td className="num">$40.0M</td><td className="num">−$17.1M</td></tr>
            <tr><th scope="row">Total</th><td className="num">17.0</td><td className="num"></td><td className="num">$200.0M</td><td className="num">$18.2M</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        The first two seasons are worth $48.3 million to his team. The last three cost it $30.1 million. What’s left is $18.2 million. Judge is still a positive asset by this math. He just isn’t a bargain, and a trade is about what a player is worth beyond his price.
      </p>
      <p>
        Francisco Lindor is the cleaner version. He projects for 13.5 fWAR from 2027 through 2031 and is paid $31.9 million a year, $159.5 million in all. The model values him at $1.0 million. Otto Lopez projects for less than half as many wins, 6.3 through 2029, but the Marlins control him on salaries that total $33.0 million, and the model values him at $23.9 million. Lindor is the better player. Lopez is the better trade asset.
      </p>

      <h2>A cheap contract is worth a fortune</h2>
      <p>
        McGonigle is a 2026 rookie. His contract pays him $2.75 million in 2027, rising to $24.75 million from 2032 through 2034, which is $150.0 million over eight seasons. The model projects him between 5.4 and 6.4 fWAR in every one of them. In 2030, for example, his projected 6.4 wins are worth $95.5 million on the open market and cost his team $22.75 million.
      </p>
      <div className="article-table-wrap" tabIndex={0}>
        <table>
          <caption>Kevin McGonigle, 2027–34 (July 31, 2026 data, October 17 default settings)</caption>
          <thead>
            <tr>
              <th scope="col">Season</th>
              <th scope="col" className="num">fWAR</th>
              <th scope="col" className="num">Value of the wins</th>
              <th scope="col" className="num">Salary</th>
              <th scope="col" className="num">Surplus value</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">2027</th><td className="num">5.4</td><td className="num">$71.3M</td><td className="num">$2.75M</td><td className="num">$62.3M</td></tr>
            <tr><th scope="row">2028</th><td className="num">5.9</td><td className="num">$81.7M</td><td className="num">$8.75M</td><td className="num">$60.3M</td></tr>
            <tr><th scope="row">2029</th><td className="num">6.2</td><td className="num">$89.3M</td><td className="num">$17.75M</td><td className="num">$53.8M</td></tr>
            <tr><th scope="row">2030</th><td className="num">6.4</td><td className="num">$95.5M</td><td className="num">$22.75M</td><td className="num">$49.7M</td></tr>
            <tr><th scope="row">2031</th><td className="num">6.3</td><td className="num">$96.5M</td><td className="num">$23.75M</td><td className="num">$45.2M</td></tr>
            <tr><th scope="row">2032*</th><td className="num">6.2</td><td className="num">$97.6M</td><td className="num">$24.75M</td><td className="num">$41.1M</td></tr>
            <tr><th scope="row">2033*</th><td className="num">6.0</td><td className="num">$96.7M</td><td className="num">$24.75M</td><td className="num">$36.9M</td></tr>
            <tr><th scope="row">2034*</th><td className="num">5.8</td><td className="num">$95.6M</td><td className="num">$24.75M</td><td className="num">$33.1M</td></tr>
            <tr><th scope="row">Total</th><td className="num">48.2</td><td className="num"></td><td className="num">$150.0M</td><td className="num">$382.4M</td></tr>
          </tbody>
        </table>
      </div>
      <p className="source-line">* Beyond the last published ZiPS season (2031), so the projection comes from the site’s own aging curve.</p>
      <p>
        That asterisk matters. $111.1 million of McGonigle’s $382.4 million, 29.0%, comes from the three seasons the model has to extrapolate. The tool marks those rows so you can see them.
      </p>

      <h2>The 10% discount</h2>
      <p>
        A win in 2034 isn’t worth as much as a win in 2027. The model divides each season’s surplus by 1.10 for every year past 2026, so 2027 is divided by 1.10 and 2034 by 2.14. That’s the rate FanGraphs uses in its own valuations, set against a 3% yearly rise in what a win costs.
      </p>
      <p>
        The discount hits McGonigle hardest, because his value is spread over eight seasons. Without it, he’d be worth $574.2 million. It helps Judge, because his losses come at the end of the deal and get shrunk too. Without the discount, he’d be worth $8.3 million. Earlier versions of this site didn’t discount at all, and the <Link href="/methods#model">methods page</Link> shows what that did to the board.
      </p>

      <h2>Why the top of the board is young players on long, cheap control</h2>
      <p>
        Put the pieces together and the leaders are easy to predict. A player ranks high when he is projected to be good, is paid little, and stays under team control for years. The top four on the board are McGonigle ($382.4 million), Pete Crow-Armstrong ($298.6 million), Konnor Griffin ($278.6 million) and JJ Wetherholt ($266.0 million). All four are controlled through 2032 or later. McGonigle, Griffin and Wetherholt are projected for 48.2, 38.8 and 35.9 fWAR on total salaries of $150.0, $137.6 and $112.5 million.
      </p>
      <p>
        FanGraphs’ own Trade Value list has the same four players at 3 through 6, behind Shohei Ohtani and Bobby Witt Jr. The model and the list agree about McGonigle and disagree about Judge, whom FanGraphs ranks 22nd and the model ranks 397th of the 2,330 players it ranks. FanGraphs’ write-up for Judge also flags the last years of his deal as the costly ones. The <Link href="/methods#fangraphs">methods page</Link> lays out the six biggest disagreements and what drives each.
      </p>

      <h2>Why it isn’t an asking price</h2>
      <p>
        A club may need wins now, prefer a particular skill, face payroll limits, or value a roster spot differently. A no-trade clause can stop a deal even when the arithmetic works. Surplus value tells you what a player’s contract is worth against the market under one set of assumptions. It doesn’t tell you what either club would accept, and the $12-million price of a win is an assumption I chose, not something I measured.
      </p>
      <p>
        Read the number as a way to inspect a trade. Find which assumptions drive it, change the ones you disagree with, and see whether the conclusion survives.
      </p>

      <aside className="article-note">
        <strong>Reading the board</strong>
        <p>
          The value rankings order surplus value under the settings you choose. They aren’t a ranking of talent, a current market, or a list of available players. Players whose contracts expire after 2026 carry no value in the default view, because their teams have no control after this season. Every built-in player comes from the July 31, 2026 snapshot.
        </p>
      </aside>
    </>
  ),
};
