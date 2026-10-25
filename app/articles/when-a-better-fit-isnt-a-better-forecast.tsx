import type { Article } from "./types";
import { AUTHOR } from "./types";

export const article: Article = {
  slug: "when-a-better-fit-isnt-a-better-forecast",
  category: "Research note",
  title: "A midseason fix for ZiPS made next year’s forecasts worse",
  summary:
    "A ridge correction cut rest-of-season error for 2025 hitters by 4.4%, though not by enough to rule out noise. When the job was the following season, it was 3.3% worse than ZiPS alone. The trade tool runs mostly on future seasons, so the correction stayed out.",
  author: AUTHOR,
  published: "2026-10-16",
  dateLabel: "October 16, 2026",
  readTime: "5 min read",
  relatedTool: { href: "/tools/projections", label: "Player projections: see the in-season adjustment on every player" },
  evidence: { href: "/research/projection-backtest.md", label: "Full audit note (plain-text Markdown)" },
  body: (
    <>
      <p className="article-lead">
        ZiPS already knows what a hitter has done this season. I wanted to know whether a model could get more out of those numbers: age, playing time, and changes in walks, strikeouts, power, and contact quality. For the rest of the 2025 season, it looked like it could. For the next season, it couldn’t.
      </p>

      <h2>What I found</h2>
      <ul className="findings">
        <li>
          <strong>For the rest of the same season, the correction looked better.</strong> Error was 4.4% lower across 673 player-checkpoints, but the 95% interval ran from 0.2% worse to 8.8% better, so the gain could be noise.
        </li>
        <li>
          <strong>For the following season, it was worse.</strong> Error was 3.3% higher than published future ZiPS across 504 player-checkpoints.
        </li>
        <li>
          <strong>It stayed out of the trade tool.</strong> The tool uses a smaller, simpler adjustment instead. That one isn’t proven either, and the section below says so.
        </li>
      </ul>

      <h2>How I tested it</h2>
      <p>
        The model was a ridge regression, a standard way to fit many inputs without letting any one of them run wild. It didn’t build its own projection. It only predicted how far to nudge ZiPS up or down, so it couldn’t win by rebuilding a generic forecast and pulling everyone toward average. Even so, the full version sometimes wanted to move a hitter by more than three wins (fWAR, FanGraphs wins above replacement) per 600 plate appearances. That’s a big swing to hang on half a season of data.
      </p>
      <p>
        I set the bar for adopting it before the test. To be adopted, the correction had to cut RMSE by at least 2%, also improve MAE, improve at both 2025 checkpoints, and have a 95% interval that excluded no improvement. I tuned on 2023 and 2024 and didn’t touch the 2025 checkpoints until the final test. Uncertainty was bootstrapped by player, so a hitter who appears at two checkpoints isn’t counted as two people.
      </p>
      <p>
        The two error measures work like this. RMSE, root mean squared error, is the typical size of a miss, with big misses counting the most. MAE, mean absolute error, is the average size of a miss with no extra penalty for big ones. Lower is better for both. A checkpoint is a date during the season, such as June 30 or July 31, when a forecast was made, and a player-checkpoint is one hitter at one of those dates.
      </p>

      <h2>Better in-season, worse next year</h2>
      <p>
        For the rest of the same season, the correction lowered RMSE by 4.42% across 673 player-checkpoints in the 2025 holdout. It helped at both checkpoints, by 5.07% on June 30 and 3.73% on July 31. But the 95% interval ran from 0.22% worse to 8.79% better, and the rule I’d set was that the interval had to exclude zero. It didn’t, so the correction failed the gate. Simpler, more stable versions of the model improved RMSE by only 0.4% to 0.8%.
      </p>
      <p>
        The second test mattered more. The trade tool values years of club control, and with the 2026 regular season over, by default it values 2027 onward. Most of what it needs is next season and beyond. When predicting the following season, the correction increased RMSE by 3.32% and MAE by 6.31% relative to published future ZiPS, across 504 player-checkpoints.
      </p>
      <div className="article-table-wrap" tabIndex={0}>
        <table>
          <caption>Ridge correction against published ZiPS, 2025 holdout</caption>
          <thead>
            <tr>
              <th scope="col">Forecast target</th>
              <th scope="col" className="num">Player-checkpoints</th>
              <th scope="col" className="num">RMSE vs. ZiPS</th>
              <th scope="col">Decision</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Rest of the same season</th>
              <td className="num">673</td>
              <td className="num">4.42% lower</td>
              <td>Failed the gate: interval from 0.22% worse to 8.79% better</td>
            </tr>
            <tr>
              <th scope="row">Following season</th>
              <td className="num">504</td>
              <td className="num">3.32% higher</td>
              <td>Not used</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        The following-season test also compared four ways of carrying this season’s ZiPS changes into the next one. The ridge correction lost by the widest margin.
      </p>
      <div className="article-table-wrap" tabIndex={0}>
        <table>
          <caption>Following-season forecasts against published future ZiPS</caption>
          <thead>
            <tr>
              <th scope="col">Version</th>
              <th scope="col" className="num">RMSE vs. ZiPS</th>
              <th scope="col" className="num">MAE vs. ZiPS</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">85% of the ZiPS change carried forward</th><td className="num">0.30% worse</td><td className="num">0.34% worse</td></tr>
            <tr><th scope="row">50% of the ZiPS change carried forward</th><td className="num">1.34% better</td><td className="num">1.69% better</td></tr>
            <tr><th scope="row">50%, role-aware (the tool’s version)</th><td className="num">1.41% better</td><td className="num">1.82% better</td></tr>
            <tr><th scope="row">Ridge correction</th><td className="num">3.32% worse</td><td className="num">6.31% worse</td></tr>
          </tbody>
        </table>
      </div>

      <h2>What the tool uses instead</h2>
      <p>
        Published future ZiPS remains the anchor. The production adjustment carries half of the change from preseason ZiPS to current rest-of-season ZiPS into the next season, and the remaining signal then fades by 15% each year. For hitters, when the offensive and non-offensive changes point in opposite directions and the non-offensive change is larger, the model gives that non-offensive change half weight. Pitchers who switch between starting and relieving get no custom adjustment.
      </p>
      <p>
        There is one exception. For the 50 players in FanGraphs’ 2026 Trade Value Series, 2027–31 use that series’ published ZiPS as-is, with no Dugout Value adjustment. That group includes Kevin McGonigle, Konnor Griffin and Bobby Witt Jr., so the adjustment above doesn’t apply to them.
      </p>
      <p>
        In the following-season test, the role-aware version lowered RMSE by 1.41% and MAE by 1.82% against future ZiPS. Its player-clustered 95% interval ran from about 0.8% worse to 3.6% better, so it doesn’t prove an improvement, and its edge over the unguarded 50% carry wasn’t statistically decisive. The 50% is a conservative choice, not a demonstrated optimum.
      </p>

      <h2>What this test can’t tell you</h2>
      <p>
        The audit covers hitters and has only one independent following-season target year, 2025. Comparable archived pitcher snapshots weren’t complete enough for the same design. Its playing-time filter excludes players who didn’t reach 100 plate appearances in the target season, so it doesn’t test injury risk or the chance of keeping a major league roster spot.
      </p>
      <p>
        It also says nothing about trade prices, the dollars-per-win assumption, or the width of the trade tool’s value ranges. Those are separate questions and need separate tests.
      </p>

      <h2>What would settle it</h2>
      <p>
        Save projections as they existed on each evaluation date. Lock the test before looking at outcomes. Then repeat it across more seasons and both hitters and pitchers. Until a correction beats ZiPS across several seasons, ZiPS stays in charge.
      </p>

      <aside className="article-note">
        <strong>Evidence status</strong>
        <p>
          This note reports the audit as I ran it on July 21, 2026. The results haven’t been rerun since. The <a href="/research/projection-backtest.md">full audit note (plain-text Markdown)</a> records the design, results, limitations, and the name of the reproduction script. It isn’t a complete reproduction bundle.
        </p>
      </aside>
      <p className="source-line">
        Background: <a href="https://library.fangraphs.com/principles/projections/">FanGraphs on projections</a> and <a href="https://blogs.fangraphs.com/introducing-fangraphs-depth-charts-and-standings/">the Depth Charts methodology</a>.
      </p>
    </>
  ),
};
