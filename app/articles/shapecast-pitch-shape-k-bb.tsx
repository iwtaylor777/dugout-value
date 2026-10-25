import Link from "next/link";
import type { Article } from "./types";
import { AUTHOR } from "./types";

export const article: Article = {
  slug: "shapecast-pitch-shape-k-bb",
  category: "Research",
  title: "Pitch shape knows something a first half doesn’t",
  summary:
    "Add public Statcast pitch traits to 16 first-half statistics and second-half K-BB% forecasts get 2.6% better (95% interval 0.4% to 4.8%). But the smaller version I committed to in advance failed its own test, and this model’s RMSE was 4.6% higher than ZiPS.",
  author: AUTHOR,
  published: "2026-10-16",
  dateLabel: "October 16, 2026",
  readTime: "10 min read",
  status:
    "Updated October 18, 2026: 284 of the 387 frozen forecasts met the scoring threshold. ShapeCast’s error was 1.3% lower than the baseline; the 95% interval spans 1.9% worse to 4.1% better. The result does not establish an advantage.",
  evidence: {
    href: "/analysis/shapecast/prospective_2026_predictions.csv",
    label: "Frozen 2026 forecast, 387 pitchers (CSV)",
  },
  body: (
    <>
      <p className="article-lead">
        Across 576 pitcher-halves in 2024 and 2025, adding public Statcast pitch traits cut the error of a second-half K-BB% forecast by 2.6%, on top of 16 first-half statistics that already described the pitcher’s results. K-BB% is strikeout rate minus walk rate, the quickest one-number read on whether a pitcher is winning at-bats. It isn’t a lot, but in this historical test it was real. I call the model ShapeCast.
      </p>
      <p>
        The comparison model already knew each pitcher’s first-half strikeout and walk rates, whiffs, called strikes, chases, zone rate, contact rate, the quality of contact he allowed, and his role. ShapeCast adds what his pitches looked like: velocity, movement, release point, extension, location and usage for each pitch family. Error is RMSE, root mean squared error, which punishes big misses most.
      </p>
      <p>
        One caveat up front: the model reported here is the full public-shape model from the original study design. Its edge over the results model was a secondary comparison, first seen after the holdout was opened. A smaller 36-input version that I had committed to in advance as ShapeCast improved RMSE by only 1.67% and failed its pre-set gate.
      </p>

      <h2>What I found</h2>
      <ul className="findings">
        <li>
          <strong>Pitch shape adds a little.</strong> RMSE fell 2.6% (95% interval 0.4% to 4.8%). The gain showed up in both seasons (4.1% in 2024, 0.9% in 2025) and for both starter-like and reliever-like pitchers.
        </li>
        <li>
          <strong>The 36-input version missed its threshold.</strong> The 36-input version’s interval ran from −0.5% to +3.7%, and it did worse in 2025. The 61-input model behind the 2.6% wasn’t the headline test.
        </li>
        <li>
          <strong>ZiPS still wins.</strong> On 273 pitchers over the rest of 2025, ShapeCast’s RMSE was 4.6% higher than archived ZiPS. The one-season interval for ShapeCast’s improvement over ZiPS, −10.7% to +1.2%, doesn’t rule out parity and doesn’t support it.
        </li>
        <li>
          <strong>A 75/25 blend with ZiPS beat ZiPS on FIP.</strong> The blend was 2.8% better for 2025 rest-of-season FIP (1.5% to 4.0%), mostly through home runs. That is one season, and most of the gain comes from current results, not pitch shape.
        </li>
        <li>
          <strong>The pitch-quality residual added error.</strong> A pitch-quality residual I call Deception Above Expected made the forecast 0.5% worse.
        </li>
      </ul>

      <p>
        None of this is a new idea. FanGraphs’ <a href="https://library.fangraphs.com/pitching/pitchingbot-pitch-modeling-primer/">PitchingBot primer</a> argued that pitch-quality grades may improve an ERA estimator, and <a href="https://blogs.fangraphs.com/introducing-the-bat-x-for-pitchers-and-the-batcast-stuff-model/">THE BATcast</a> now blends a multi-model stuff system into THE BAT X for pitchers. What’s new here is narrower: a K-BB component built only on public Statcast data, with a frozen time split, uncertainty clustered by pitcher, and code I’ll share on request.
      </p>

      <h2>How I tested it</h2>
      <p>
        I used regular-season Statcast pitches to forecast each pitcher’s second-half K-BB%. “First half” means through June 30. A pitcher needed at least 100 first-half batters faced and 200 first-half swings, plus 75 second-half batters faced so a rate could be scored. Hyperparameters, the model’s tuning settings, were chosen once on 2023 using models fit to 2021–22. The final model was then refit on 2021–23 and scored once on 2024–25.
      </p>
      <p>
        The comparison model isn’t a naive leaderboard. It has 16 inputs: batters faced, K%, BB%, K-BB%, whiff%, called-plus-whiff strike rate (CSW%), zone%, chase%, called-strike%, contact%, expected wOBA on contact allowed, pitcher run value per 100 pitches, the share of batters faced the second and third time through the order, pitches per appearance, and which hand he throws with. It used only the current season’s first half. Like ShapeCast, it saw no prior seasons.
      </p>
      <p>
        ShapeCast adds 45 inputs: for four-seamers, sinkers, cutters, breaking balls and offspeed pitches, each family’s usage, velocity, horizontal and vertical movement, extension, two release-point coordinates, and average horizontal and vertical location. That makes 61 in all. There’s no pitcher identity and no future information.
      </p>

      <h2>The result</h2>
      <div className="article-table-wrap">
        <table>
          <caption>Second-half K-BB% forecast error, 576 pitcher-halves from 419 pitchers</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Results only (RMSE)</th>
              <th scope="col">With pitch shape (RMSE)</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">2024–25</th><td>0.05338</td><td>0.05198</td><td>2.63% better</td></tr>
            <tr><th scope="row">2024</th><td>0.05416</td><td>0.05193</td><td>4.10% better</td></tr>
            <tr><th scope="row">2025</th><td>0.05249</td><td>0.05203</td><td>0.86% better</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Mean absolute error improved 3.3% pooled, and both error measures improved in both years. Starter-like pitchers improved 2.55% by RMSE and reliever-like pitchers 2.72%. The pitcher-clustered 95% interval for the pooled gain ran from 0.44% to 4.76% better. Clustering matters because repeated cells from the same pitcher can’t be treated as independent evidence.
      </p>
      <p>
        A different cutoff gave a smaller number. Moving the cutoff to July 15 shrank the gain to 1.66% (interval −0.64% to 3.89%) on 562 pitcher-seasons. It still won in both years, so it passes the supportive gate I set, but it isn’t decisive on its own.
      </p>

      <h2>A consistency check, and what it can’t show</h2>
      <p>
        A consistency check replaced each pitcher’s actual arsenal with a matched pitcher’s entire 45-variable shape block. Donors were matched by season, hand, starter or reliever role, baseline projection quintile and workload tercile. That keeps realistic values and missing-pitch patterns but breaks the link between a pitcher and his pitches.
      </p>
      <p>
        The shuffled model’s RMSE was 0.05489, worse than both the real shape model (0.05198) and the results-only model (0.05338). Real shapes were 5.30% better than shuffled shapes, with an interval of 2.91% to 7.78%, in both seasons and both roles. The model leans on the real pitcher-to-arsenal link: scrambled arsenals made it worse than having no shape data at all. The evidence that shape adds information is the out-of-sample gain above, not this check.
      </p>
      <aside className="article-note">
        <strong>Why the check is weaker than it looks</strong>
        <p>I shuffled shapes only at test time. The model was trained on real shapes, so a model fed another pitcher’s arsenal will get worse even if shape only stands in for information the results already carry. The test measures reliance on shape, not incremental information. Refitting on shuffled training data would be a stronger version, and it needs no new data. I haven’t run it.</p>
      </aside>

      <h2>ZiPS still beats it</h2>
      <p>
        ShapeCast isn’t a projection system. It doesn’t predict injuries, survival, role, innings, ERA, WAR or aging. I compared it with <a href="https://www.fangraphs.com/projections">ZiPS</a>, Dan Szymborski’s system at FanGraphs, using an Internet Archive capture of rest-of-season ZiPS from 00:25 ET on June 24, 2025. To avoid a timing advantage, ShapeCast used data only through June 23, and both forecasts were scored on the same 273 pitchers through the end of the season.
      </p>
      <div className="article-table-wrap">
        <table>
          <caption>K-BB% forecast error, 273 pitchers, June 24 through the end of 2025</caption>
          <thead>
            <tr><th scope="col">Forecast</th><th scope="col">RMSE</th><th scope="col">MAE</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">Results only</th><td>0.05375</td><td>0.04148</td></tr>
            <tr><th scope="row">ShapeCast</th><td>0.05345</td><td>0.04168</td></tr>
            <tr><th scope="row">Archived ZiPS</th><td>0.05109</td><td>0.03938</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        ShapeCast’s RMSE was 4.60% higher than ZiPS, and ShapeCast’s edge over my own results-only model shrank to 0.56%. The interval for ShapeCast’s improvement over ZiPS was −10.75% to +1.24%. One season can’t prove a permanent gap, but it does reject any claim that ShapeCast has matched ZiPS. The likeliest reason is simple: ZiPS sees years of history, and both of my models see half a season. I haven’t tested that.
      </p>

      <h2>A 75/25 blend with ZiPS beat ZiPS on FIP</h2>
      <p>
        If pitch shape can’t replace ZiPS, can public data correct it? I froze FIP, fielding independent pitching, an ERA estimator built from strikeouts, walks and home runs, as a fresh endpoint before importing its outcomes. A 75/25 blend of ZiPS and current-season public data beat ZiPS alone for 2025 rest-of-season FIP by 2.80% (1.54–3.99%), mostly through HR/9. On 279 pitchers, RMSE fell from 1.0169 to 0.9884 and mean absolute error from 0.7717 to 0.7477. The public side of the blend used first-half results, plate-discipline statistics, run estimators and pitch shape.
      </p>
      <p>
        The caveats matter as much as the number:
      </p>
      <ul>
        <li><strong>One target season.</strong> The test is 2025 only, and the interval comes from bootstrapping pitchers, not seasons.</li>
        <li><strong>One blend weight.</strong> The 25% weight was chosen on 281 pitchers in 2024 and applied unchanged to 2025. It was never tuned on 2025, but it is still one weight tested once.</li>
        <li><strong>Mostly not pitch shape.</strong> A blend using results and process statistics alone was 2.72% better than ZiPS. The shape-specific increment was about 0.14%, with an interval from roughly 0.66% worse to 0.96% better. The frozen version also carried 45 prior-year arsenal-change inputs, which a later check found didn’t help.</li>
        <li><strong>The home-run claim is a breakdown, not a headline.</strong> Home-run rate (HR/9) forecast error was 2.32% lower (1.18% to 3.46%). Strikeouts per nine looked better by 3.20% but the interval, −0.58% to 6.94%, includes zero, and walks per nine were 0.96% worse. A results-only blend did as well on HR/9, so this isn’t a pitch-shape result.</li>
        <li><strong>Other targets didn’t clear zero.</strong> K-BB% (1.6%) and ERA (1.2%) also improved at the point estimate, but their intervals included zero. I’m not claiming a next-season version either: its interval, −2.3% to +8.9%, included zero, and its archive was truncated.</li>
      </ul>
      <p>
        So the supportable statement is small: a public in-season overlay made a strong ZiPS forecast of FIP a little better in one season. It isn’t a standalone win over ZiPS, and it isn’t a pitch-shape result.
      </p>

      <h2>What didn’t work</h2>
      <p>
        I began with a more ambitious idea, Deception Above Expected (DeX). A model that knew nothing about the pitcher estimated the whiff probability of every swing from pitch type, movement, velocity, release, location, count and handedness. Pitchers were credited for actual whiffs above that expectation. Added to the shape model, the residual made pooled RMSE 0.49% worse, with an interval from 2.16% worse to 1.15% better. Observable pitch shape was predictive. Outperformance relative to it wasn’t stable enough to help.
      </p>

      <h2>The 2026 forecast I froze</h2>
      <p className="article-status">
        Scored October 18, 2026. Of 387 frozen forecasts, 284 met the required 75 post-break batters faced. Weighted RMSE was 5.46 K-BB percentage points for ShapeCast and 5.53 for the baseline. The 1.3% improvement has a 95% interval from −1.9% to +4.1%.
      </p>
      <p>
        A 387-pitcher rest-of-2026 forecast was frozen in my repository on July 23, using data through July 12 (protocol hash 22a78c36…). It was not publicly time-stamped. Some post-break games had already been played when I froze it, so it is blind to my data, not to the calendar: no post-break pitches were in my workspace. The frozen file is linked at the end of this article.
      </p>
      <p>
        In 2026 Statcast moved the spot where it measures pitch location, so I rebuilt each 2026 pitch’s location at the old spot before forecasting. The same method reproduces 2024–25 locations to within about 0.003 feet (median), and 99.1% of 2026 trajectories were valid. The primary test is RMSE among pitchers with at least 75 post-break batters faced.
      </p>
      <div className="article-table-wrap">
        <table>
          <caption>Frozen July 23, 2026. Not yet scored. The ten largest positive and ten largest negative ShapeCast adjustments to the 16-input baseline, rest-of-2026 K-BB%.</caption>
          <thead>
            <tr>
              <th scope="col">Pitcher</th>
              <th scope="col">Role</th>
              <th scope="col">K-BB% through July 12</th>
              <th scope="col">Baseline forecast</th>
              <th scope="col">ShapeCast forecast</th>
              <th scope="col">Adjustment (points)</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="rowgroup" colSpan={6}>Largest positive adjustments</th></tr>
            <tr><th scope="row">Devin Williams</th><td>Reliever-like</td><td>17.3%</td><td>16.6%</td><td>21.8%</td><td>+5.2</td></tr>
            <tr><th scope="row">Michael Petersen</th><td>Reliever-like</td><td>20.6%</td><td>17.6%</td><td>22.4%</td><td>+4.8</td></tr>
            <tr><th scope="row">José Alvarado</th><td>Reliever-like</td><td>21.6%</td><td>16.3%</td><td>21.0%</td><td>+4.7</td></tr>
            <tr><th scope="row">Garrett Crochet</th><td>Starter-like</td><td>18.8%</td><td>13.6%</td><td>18.2%</td><td>+4.6</td></tr>
            <tr><th scope="row">Jacob Misiorowski</th><td>Starter-like</td><td>33.2%</td><td>24.9%</td><td>28.7%</td><td>+3.8</td></tr>
            <tr><th scope="row">Chase Burns</th><td>Starter-like</td><td>19.6%</td><td>18.4%</td><td>22.1%</td><td>+3.7</td></tr>
            <tr><th scope="row">Grant Taylor</th><td>Reliever-like</td><td>25.3%</td><td>21.1%</td><td>24.6%</td><td>+3.6</td></tr>
            <tr><th scope="row">Spencer Miles</th><td>Reliever-like</td><td>15.5%</td><td>14.8%</td><td>18.3%</td><td>+3.5</td></tr>
            <tr><th scope="row">Spencer Arrighetti</th><td>Starter-like</td><td>10.4%</td><td>11.0%</td><td>14.3%</td><td>+3.3</td></tr>
            <tr><th scope="row">Simeon Woods Richardson</th><td>Starter-like</td><td>−0.4%</td><td>8.2%</td><td>11.4%</td><td>+3.2</td></tr>
          </tbody>
          <tbody>
            <tr><th scope="rowgroup" colSpan={6}>Largest negative adjustments</th></tr>
            <tr><th scope="row">Cole Ragans</th><td>Starter-like</td><td>14.5%</td><td>16.6%</td><td>12.6%</td><td>−4.0</td></tr>
            <tr><th scope="row">Brent Headrick</th><td>Reliever-like</td><td>19.3%</td><td>22.7%</td><td>18.8%</td><td>−3.9</td></tr>
            <tr><th scope="row">Tatsuya Imai</th><td>Starter-like</td><td>12.9%</td><td>14.4%</td><td>10.8%</td><td>−3.6</td></tr>
            <tr><th scope="row">Tyler Rogers</th><td>Reliever-like</td><td>7.2%</td><td>13.0%</td><td>9.6%</td><td>−3.4</td></tr>
            <tr><th scope="row">Lake Bachar</th><td>Reliever-like</td><td>17.5%</td><td>19.3%</td><td>16.2%</td><td>−3.1</td></tr>
            <tr><th scope="row">Brooks Raley</th><td>Reliever-like</td><td>16.2%</td><td>16.7%</td><td>13.7%</td><td>−3.0</td></tr>
            <tr><th scope="row">Clay Holmes</th><td>Starter-like</td><td>12.6%</td><td>14.3%</td><td>11.4%</td><td>−2.9</td></tr>
            <tr><th scope="row">Spencer Strider</th><td>Starter-like</td><td>15.8%</td><td>19.4%</td><td>16.6%</td><td>−2.8</td></tr>
            <tr><th scope="row">Max Fried</th><td>Starter-like</td><td>12.9%</td><td>16.2%</td><td>13.4%</td><td>−2.8</td></tr>
            <tr><th scope="row">Carlos Rodón</th><td>Starter-like</td><td>13.3%</td><td>16.3%</td><td>13.6%</td><td>−2.7</td></tr>
          </tbody>
        </table>
      </div>
      <p className="source-line">
        Adjustment = ShapeCast forecast minus the baseline forecast, in K-BB percentage points. Values are rounded here; the CSV has full precision for all 387 pitchers. These are the model’s corrections to its own baseline, not rankings of the pitchers. The whole list is scored by RMSE.
      </p>

      <p><Link href="/analysis/shapecast-2026-forecast-results">Read the 2026 scoring results</Link>, including eligibility, bias, and downloadable reproduction files.</p>
      <h2>What I take from it</h2>
      <p>
        If you’re forecasting a pitcher’s strikeout-minus-walk rate from public data, his first-half results don’t tell you everything. What his pitches look like still adds something. It isn’t much, and it isn’t enough to beat ZiPS. The 2026 forecasts have now been scored. Their smaller measured gain, with an interval that includes no improvement, leaves the prospective evidence inconclusive.
      </p>
      <p>
        ShapeCast isn’t used in the trade tools or the projections table.
      </p>
    </>
  ),
};
