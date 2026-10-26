import type { Article } from "./types";
import { AUTHOR } from "./types";

// Figures: context/MODEL-NUMBERS.md section 3 (default example trade) and the range widths
// computed from valuePlayer at the NEW defaults (timingPreference 10, valuationView "offseason").
// Rodríguez mlb-677594 on his default "fallback" contract path; Skenes mlb-694973.

export const article: Article = {
  slug: "how-to-read-value-ranges",
  category: "Model guide",
  title: "Overlapping ranges don’t make a trade fair",
  summary:
    "At the October 17 default settings (the offseason view, with July 31, 2026 data), Paul Skenes comes out $4.2 million ahead of Julio Rodríguez in the trade builder, 3.9% of the larger side, and their ranges share $34.3 million of possible values. Neither number settles the deal. The ranges are fixed allowances, not confidence intervals, and they ignore a player’s age and experience.",
  author: AUTHOR,
  published: "2026-10-16",
  dateLabel: "October 16, 2026",
  readTime: "5 min read",
  relatedTool: { href: "/tools/trade", label: "Open the Rodríguez–Skenes trade and change the settings yourself" },
  body: (
    <>
      <p className="article-lead">
        Put Julio Rodríguez on one side of the trade builder and Paul Skenes on the other. At the midpoint, Skenes is worth $107.9 million and Rodríguez $103.7 million, so Pittsburgh gives up $4.2 million more than Seattle, 3.9% of the larger side. Their ranges, $87.0–128.7 million for Skenes and $86.1–121.3 million for Rodríguez, overlap from $87.0 million to $121.3 million. It’s tempting to call that a fair trade. The ranges can’t carry that much weight.
      </p>
      <p>
        The numbers here use July 31, 2026 data in the Offseason view (2027 on). These figures use model 2026-10-17.1, the October 17 defaults of $12 million per win and a 30% star premium. The current tools use model 2026-10-25.1, so they will show different numbers.
      </p>

      <h2>What the ranges are</h2>
      <p>
        They aren’t probability intervals, and nothing was measured to produce them. Each range is the midpoint plus or minus an allowance set by rule. The base is 10%. A healthy hitter adds 3.5 points and a pitcher adds 6. A player on the injured list adds more. Value that sits years in the future adds up to 15 points. The total never exceeds 45%. For prospects the allowance comes from scouting risk, years until arrival, and an extra charge for pitchers. Rodríguez’s allowance works out to about 17% and Skenes’s to about 19%.
      </p>
      <p>
        Nobody has checked how often a player’s real value lands inside these ranges. They are fixed allowances the model adds to its own estimate, not a spread it learned from outcomes.
      </p>

      <h2>What they ignore</h2>
      <p>
        Width depends on role, injury status, and how far out the value sits. It doesn’t depend on age, major league experience, or how much data the projection rests on. Kevin McGonigle is a 2026 rookie and Rodríguez is 25. Both are healthy hitters with the same base allowance. McGonigle’s range is ±20.8% and Rodríguez’s is ±17.0% only because more of McGonigle’s value is years away. A recent call-up gets a range that is too narrow for how little is known about him.
      </p>
      <p>
        Injuries do move the width. Konnor Griffin was on the 60-day injured list on July 31 with a torn finger tendon, which adds 8 points to his allowance. His range is about ±25%, against about ±20% for JJ Wetherholt, who is healthy and controlled for the same years. The injury widens the range without cutting the midpoint. Check the projection’s playing time before you edit it, and check the date: an injury in the July snapshot says nothing about his health today.
      </p>

      <h2>Read the midpoint first</h2>
      <p>
        The midpoint gap is the model’s actual answer. Under the October 17 default assumptions, Pittsburgh gives up $4.2 million more than Seattle. At $12 million a win, that’s about a third of a win. Overlapping ranges don’t erase that gap, and they don’t confirm it either. They tell you it’s small enough that the next step is checking which assumptions produce it.
      </p>

      <h2>Change an assumption that matters</h2>
      <p>
        Drop the price of a win from $12 million to $10 million and see whether Skenes still comes out ahead. He does, and he stays ahead under every other setting I tried.
      </p>
      <div className="article-table-wrap" tabIndex={0}>
        <table>
          <caption>Rodríguez for Skenes under different settings (July 31, 2026 data)</caption>
          <thead>
            <tr>
              <th scope="col">Setting</th>
              <th scope="col" className="num">Rodríguez</th>
              <th scope="col" className="num">Skenes</th>
              <th scope="col" className="num">Pittsburgh gives up more by</th>
              <th scope="col" className="num">Share of larger side</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">October 17 default: $12M a win, 30% star premium, 10% discount, 2027 on</th><td className="num">$103.7M</td><td className="num">$107.9M</td><td className="num">$4.2M</td><td className="num">3.9%</td></tr>
            <tr><th scope="row">$10M a win</th><td className="num">$78.0M</td><td className="num">$84.0M</td><td className="num">$6.0M</td><td className="num">7.2%</td></tr>
            <tr><th scope="row">No star premium</th><td className="num">$82.8M</td><td className="num">$89.5M</td><td className="num">$6.7M</td><td className="num">7.5%</td></tr>
            <tr><th scope="row">Win-now: 20% discount a year</th><td className="num">$87.9M</td><td className="num">$92.0M</td><td className="num">$4.1M</td><td className="num">4.5%</td></tr>
            <tr><th scope="row">No discount</th><td className="num">$125.0M</td><td className="num">$129.1M</td><td className="num">$4.2M</td><td className="num">3.2%</td></tr>
            <tr><th scope="row">July 31 deadline view (counts the rest of 2026)</th><td className="num">$119.3M</td><td className="num">$130.9M</td><td className="num">$11.7M</td><td className="num">8.9%</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Nothing in the table flips the order. A cheaper win or no star premium widens the gap to $6.0 million or $6.7 million, 7.2% or 7.5% of the larger side. A win-now discount barely moves it. The only setting that moves it a lot is the July 31 deadline view, which counts rest-of-2026 wins that have already been played.
      </p>
      <p>
        A projection can flip it. Raise Rodríguez’s 2027 forecast from 4.8 fWAR (FanGraphs wins above replacement) to 5.1 and he comes out $0.2 million ahead of Skenes. A 0.3-win change in one season is the whole margin. Skenes’s salaries in this trade are also estimates of future arbitration awards, so that’s another input worth changing. If small, plausible edits reverse the order, the result is sensitive to those inputs. If they don’t, you’ve learned something about this trade, and nothing about whether either club would agree to it.
      </p>

      <h2>What would make them real intervals</h2>
      <p>
        A future version should define an outcome to predict, save its forecasts before that outcome is known, and check how often the stated intervals contain it. It should report those results by player group, including age and years of service, which are exactly what the current widths leave out. Until then, treat the ranges as a stress test, not a probability.
      </p>
    </>
  ),
};
