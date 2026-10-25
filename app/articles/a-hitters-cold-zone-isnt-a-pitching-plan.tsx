import type { Article } from "./types";
import { AUTHOR } from "./types";

const FIG = "/analysis/attackability";

/** The compact evidence panel shown beside the article on the home page. */
const featurePanel = (
  <div className="evidence-panel">
    <p className="eyebrow">Opponents’ plans vs. the Attackability model · 2024–25</p>
    <h3>Plans lined up with the model.<br />No outcome effect detected.</h3>
    <div className="evidence-result">
      <span>Slope of opponents’ hitter-specific plans on the model’s feasible move</span>
      <strong className="result-better">0.464 <small>95% interval 0.391 to 0.537</small></strong>
      <p>Shuffled-label placebo range: 0.027 to 0.098. 45,254 hitter–pitcher groups.</p>
    </div>
    <div className="evidence-result">
      <span>Effect of that plan on hitters’ run value</span>
      <strong>0.039 <small>95% interval −0.322 to +0.400</small></strong>
      <p>Null (p = .833). The test can’t show the plans cost hitters anything.</p>
    </div>
    <p className="evidence-caption">Retrospective 2024–25 test, not a pristine holdout.<br />Says nothing about trade prices.</p>
  </div>
);

export const article: Article = {
  slug: "a-hitters-cold-zone-isnt-a-pitching-plan",
  category: "Research",
  title: "A hitter’s cold zone isn’t a pitching plan",
  summary:
    "A weak spot only matters if the pitcher on the mound can reach it. In a retrospective 2024–25 test, the part of opponents’ plans aimed at a specific hitter matched about 46% of what my model said each pitcher could reach, against less than 10% when hitters were shuffled. I can’t show those plans cost hitters anything: that test came back null.",
  author: AUTHOR,
  published: "2026-10-16",
  dateLabel: "October 16, 2026",
  readTime: "9 min read",
  status:
    "Updated October 18, 2026: Vargas saw 28 post-freeze pitches in the registered target region, short of the required 75. The registered tests cannot be evaluated. The 2024–25 results below remain retrospective.",
  featured: true,
  featurePanel,
  evidence: {
    href: "https://github.com/iwtaylor777/dugout-value",
    label: "Site and model code: GitHub repository (research code and results files available on request)",
  },
  body: (
    <>
      <p className="article-lead">
        Through July 12, Miguel Vargas’s raw results suggest he had three strike zones. On pitches in the rule-book zone, he produced +1.73 runs per 100 pitches on the inner third and −4.82 on the outer third. Those are raw, unshrunk splits on about 200 pitches per lane (171 inner, 213 outer).
      </p>
      <p>
        Run value here is how much each pitch changed his team’s expected runs. It counts balls, strikes and whiffs, not just balls in play. When he did put outer-third pitches in play, his expected wOBA (xwOBA, the wOBA his exit velocity and launch angle usually earn) was .370, against .527 over the middle and .549 inside. That is only 48 balls in play, so treat it as a hint.
      </p>

      <figure className="article-figure">
        <img
          src={`${FIG}/vargas-horizontal-mechanisms.png`}
          width={1627}
          height={744}
          loading="lazy"
          alt="Two bar charts of Miguel Vargas's 2026 results on pitches in the strike zone through July 12, split into outer, middle and inner thirds. Left: expected wOBA on contact is .370 on the outer third, .527 in the middle and .549 on the inner third. Right: batting run value per 100 pitches is about −4.8 on the outer third, −1.1 in the middle and +1.7 on the inner third."
        />
        <figcaption>
          Vargas, 2026 through July 12, pitches in the rule-book zone. Raw, unshrunk splits on 213 outer, 244 middle and 171 inner pitches, with 48, 85 and 52 balls in play. Lanes are batter-relative: inner means toward his hands.
        </figcaption>
      </figure>

      <p>
        That’s a weakness. It isn’t a plan yet. To use it, a pitcher has to be able to throw there, has to do it without abandoning what makes him good, and has to expect it to pay. Cold-zone charts skip all three steps. This project is about those steps.
      </p>

      <h2>What I found</h2>
      <ul className="findings">
        <li>
          <strong>Hitter-specific location weaknesses are real but small.</strong> The average adjustment is about three-quarters of a run per 100 pitches. Flip a hitter’s map across the plate, or hand him someone else’s, and the forecast gets worse in every season.
        </li>
        <li>
          <strong>Matching the weakness to a pitcher’s repertoire didn’t improve forecasts.</strong> In the 2024–25 holdout it was a coin flip.
        </li>
        <li>
          <strong>Opponents’ plans lined up with the openings anyway.</strong> When the model said a pitcher could gain by shifting his mix a few percentage points, the part of his later plan aimed at that hitter leaned the same way, by about 46% of the predicted amount. The relationship barely moved from 2023 to 2025.
        </li>
        <li>
          <strong>I can’t show those plans made hitters worse.</strong> That test came back null.
        </li>
      </ul>

      <h2>Three ideas, in plain words</h2>
      <p>
        Most hitter heat maps answer one question: what happened when pitches arrived here? Even a well-shrunk map describes the hitter in isolation. It doesn’t say whether a particular pitcher can live there, and the obvious advice, throw everything at the coldest cell, asks him to abandon the repertoire and command that made him a major leaguer. So I separate three things:
      </p>
      <ol>
        <li><strong>Vulnerability:</strong> where, by pitch type and location, this hitter does better or worse than a generic forecast expects.</li>
        <li><strong>Repertoire Coverage:</strong> how much of that weakness a given pitcher already hits with the pitches and locations he actually throws.</li>
        <li><strong>Attackability:</strong> how much more he could get by nudging that mix a few percentage points toward spots he has already shown he can reach.</li>
      </ol>
      <p>
        The nudge is small on purpose. For each pitcher, batter side and pitch family, the model learns location clusters from pitches thrown before June 15, the places he has repeatedly reached, misses included. It can move at most five percentage points into or out of any cluster, ten in total, and a cluster needs 40 prior pitches. It can’t give a four-seam/changeup pitcher a sweeper. It can say: use the elevated fastball target you already have five points more often.
      </p>

      <h2>Hitter-specific location is real, but small</h2>
      <p>
        Pooled across 2023–25, the hitter-specific map lowered forecast error, but only slightly, because pitch-by-pitch run value is mostly noise: about 0.02% less squared error (mean squared error, or MSE, difference −11.90 × 10⁻⁶; 95% interval −24.75 to +0.85). The map was worse than no hitter-location effect in 2023, better in 2024, and clearly better in 2025. The bootstrap puts a 96% chance on the map helping, but the interval still touches zero.
      </p>
      <p>
        The stronger evidence is the falsification. The correctly oriented surface beat its mirror image and its shuffled version in every season, with intervals that exclude zero. A model that only learned “high fastballs are good” wouldn’t care which hitter owned the map.
      </p>
      <figure className="article-figure">
        <img
          src={`${FIG}/surface-falsification.png`}
          width={1447}
          height={835}
          loading="lazy"
          alt="Dot-and-whisker chart of the change in forecast error, by season for 2023, 2024 and 2025, when the hitter-specific surface is compared with no hitter-location effect, a mirrored surface and a shuffled surface. Negative values favor the hitter surface. The no-effect comparison is above zero in 2023 and below zero in 2024 and 2025, with intervals crossing zero in the first two years. The mirrored and shuffled comparisons sit well below zero in all three seasons, with intervals that exclude zero."
        />
        <figcaption>Change in squared forecast error when the hitter’s own surface replaces each comparator. Below zero favors the hitter’s surface. Bars are 95% intervals clustered by hitter.</figcaption>
      </figure>

      <h2>Repertoire Coverage didn’t validate</h2>
      <p>
        Raw Coverage values were too aggressive in every development season. Calibration kept only 36.4% of the raw advantage, and 33.6% once 2023 joined. On the 2023 tuning gate the calibrated version beat the generic forecast, but its interval ran from −3.85 to +1.68 (× 10⁻⁶ MSE), so the gate failed. In the 2024–25 holdout it helped in 2024 and hurt in 2025. Pooled over 692,236 pitches, the difference was −0.13 × 10⁻⁶ (−2.10 to +1.90), and the chance of any improvement was 54.4%.
      </p>
      <figure className="article-figure">
        <img
          src={`${FIG}/coverage-holdout.png`}
          width={1303}
          height={826}
          loading="lazy"
          alt="Dot-and-whisker chart of the change in squared forecast error from adding Repertoire Coverage, for 2024, 2025 and pooled. The 2024 point is slightly below zero, the 2025 point slightly above, and the pooled point sits almost exactly on zero. Every interval spans zero."
        />
        <figcaption>Coverage minus the calibrated generic forecast, MSE × 1,000,000. Below zero favors Coverage. Every interval spans zero.</figcaption>
      </figure>
      <p>
        That’s a null, not a small win. Any tool that shows raw matchup values without shrinkage will make them far too large. And because Coverage didn’t pass, everything below is exploratory: my plan said the downstream result would count as confirmatory only if Coverage validated.
      </p>

      <h2>Opponents’ hitter-specific plans lined up with Attackability</h2>
      <p>
        The 2024–25 sample has 45,254 hitter–pitcher matchup groups and 447,095 later pitches. For each one, the model formed its modest best plan from pre-June 15 inputs only. Then I took the pitcher’s post-cutoff mix against that hitter and subtracted his post-cutoff mix against all same-side hitters, so a pitcher who started throwing more sweepers to everyone got no credit. Both mixes are scored on the hitter’s pre-cutoff map. The slope relates the model’s feasible move to that hitter-specific difference:
      </p>
      <ul>
        <li>2023 tuning year: 0.516</li>
        <li>2024: 0.471</li>
        <li>2025: 0.457</li>
        <li>2024–25 pooled: <strong>0.464</strong> (95% interval 0.391 to 0.537)</li>
      </ul>
      <p>
        So the hitter-specific part of opponents’ later plans equaled about 46% of the model’s feasible first move. Matchups in the top Attackability decile had about ten times the predicted opening of the bottom decile (0.66 against 0.07 runs per 100 plate appearances) and a far larger hitter-specific plan difference afterward (0.26 against 0.01).
      </p>
      <figure className="article-figure">
        <img
          src={`${FIG}/strategy-by-attackability-decile.png`}
          width={1447}
          height={799}
          loading="lazy"
          alt="Line chart by Attackability decile, 1 through 10. The blue line, the feasible gain the model predicted before June 15, climbs from about 0.07 runs per 100 plate appearances in decile 1 to about 0.66 in decile 10. The orange line, the hitter-specific part of opponents' later plans, climbs from about 0.01 to about 0.26 over the same range."
        />
        <figcaption>By decile of predicted Attackability, 2024–25. Both lines in runs per 100 plate appearances.</figcaption>
      </figure>
      <p>
        One objection: predicted and observed plans use the same hitter map, so a shared scale could create a slope by itself. I tested that by shuffling hitters’ Attackability labels within each pitcher-season and batter side 1,000 times. The shuffled slopes ran from 0.027 to 0.098. No shuffled draw matched 0.464 (one-sided permutation p = .001). A little mechanical association exists. It isn’t close to enough.
      </p>
      <p>
        Here is what the result does not show. The test compares how a pitcher attacked this hitter after June 15 with how he attacked everyone else. It never compares that with how he attacked the same hitter <em>before</em> June 15. A long-standing scouting plan, such as everyone already pitching Aaron Judge away from his damage, would produce the same slope with no response to anything. The shuffle can’t rule that out, because shuffling hitters breaks standing plans too. The result is consistent with the model finding real openings. It doesn’t show that pitchers changed course. Matchup by matchup it’s weak, too: 53.8% moved the predicted way (57.0% in the top decile). The slope is driven by magnitude.
      </p>
      <p>
        And the outcome test is null. Regressing hitters’ later run value on the ordinary forecast plus the model-aligned plan difference gives a coefficient of 0.039 (95% interval −0.322 to +0.400, p = .833). The public command-dispersion interaction was also inconclusive: −0.037 (−0.086 to +0.012, p = .135). I’m not burying either. They set the claim: opponents’ plans are consistent with reachable matchup pressure, but I haven’t isolated what that pressure is worth.
      </p>

      <h2>One hit and one miss: Aaron Judge and Jo Adell, 2025</h2>
      <p>
        A rule that never used names picked the cases: hitters in the top 20% of Attackability and top 25% of first-half run value, with at least 600 prior and 350 evaluated later pitches. That left 21 candidate player-seasons out of 420 eligible. The thresholds were my post-hoc choice, so these two are descriptive. No inference depends on them.
      </p>
      <p>
        The strongest case was <strong>Aaron Judge, 2025</strong>. The model found 0.665 runs per 100 plate appearances of feasible first-move pressure. The hitter-specific part of opponents’ later plans equaled 0.501, and 65% of his evaluated pitcher matchups leaned the recommended way. His raw run value fell from 3.66 per 100 pitches before June 15 to 2.06 after. That drop is context, not proof: regression to the mean, health and Judge’s own adjustments are all live. The narrower claim is that a constrained model identified where real pitchers could alter their plans, and those pitchers’ plans against him leaned that way.
      </p>
      <p>
        The informative miss was <strong>Jo Adell, 2025</strong>. His estimated opening was 0.456 runs per 100 plate appearances, but the later plan difference was −0.200. Opponents leaned slightly away from the model, and Adell beat the generic forecast by 1.33 runs per 100 plate appearances. A theoretical opening can lose to scouting the public model can’t see.
      </p>

      <h2>The forecast I froze: Miguel Vargas</h2>
      <p><a href="/research#2026">Download the registration, outcome counts, and scoring code</a>.</p>
      <p className="article-status">
        Checked October 18, 2026. Vargas saw 28 pitches in the registered region after July 16, below the required 75. None of the registered tests is evaluated. The region accounted for 28 of 1,184 later pitches, compared with 25 of 1,619 before the freeze; those counts are descriptive only.
      </p>
      <p>
        The record uses 1,619 Vargas pitches through July 12. The registered primary attack is high-and-away four-seamers. Relative to a Vargas forecast without his personal location surface, that region is worth −1.88 runs per 100 pitches. The map also shows the inner-middle lane as a strength, so “throw more fastballs” isn’t the advice. The location mix is.
      </p>
      <figure className="article-figure">
        <img
          src={`${FIG}/vargas-four-seam-map.png`}
          width={1010}
          height={835}
          loading="lazy"
          alt="A three-by-three heat map of Miguel Vargas's hitter-specific vulnerability against four-seam fastballs through July 12, 2026, in runs per 100 pitches, with the outer, middle and inner lanes across and high, middle and low down. The high-outer cell is the lowest at −1.88, the middle-outer cell is −1.42 and the low-outer cell is −0.93. The inner-middle cell is the highest at +1.47. The remaining cells are between −0.72 and +0.12."
        />
        <figcaption>
          Hitter-specific adjustment against four-seam fastballs, in runs per 100 pitches; negative favors the pitcher. The model fits a continuous location surface, and this 3×3 grid is only a display summary. Cell borders aren’t baseball events: a pitch an inch either side of one lands in a different cell. Read the pattern, not the cell.
        </figcaption>
      </figure>
      <p>
        The test is fixed. After July 16, does the share of high-away four-seamers rise against Vargas relative to his pre-freeze share? Is the rise larger for pitchers whose target clusters reach the region? Is his run value on those pitches worse than on his other pitches, with uncertainty clustered by series? The test needs at least 75 later pitches in the registered pitch type and region before it can be scored, and the 2026 sample did not reach that threshold.
      </p>

      <h2>What this is useful for now</h2>
      <p>
        Attackability is a research-grade scouting flag, not a player-value adjustment. In an advance report it could translate a heat map into pitcher-specific language: which existing target cloud to emphasize. For acquisition work it could flag a hitter whose production invites a predictable second move, then send the analyst back to video and internal scouting. It should <strong>not subtract dollars or WAR</strong> in a trade-value model. Coverage’s gain was null, the gate failed, and the outcome test is null. The trade tools on this site don’t use it.
      </p>
      <p>
        The obvious next step is the lead/lag test I haven’t run: subtract each pitcher’s pre-cutoff mix against the same hitter, and see whether the slope holds. If it does, “changed course” becomes a claim I can make. If it doesn’t, the 0.464 was mostly standing scouting plans. After that comes <em>Adaptive Exposure</em>, how a hitter’s swing decisions and contact quality respond once the plan changes, and a better measure of intended-location execution than public dispersion. Until then the result is modest: a hitter’s vulnerability becomes strategically interesting when a real pitcher can reach it, opponents’ plans lined up with that idea in 2024–25, and whether it changes the scoreboard is unproven.
      </p>

      <details className="article-note">
        <summary>How the test was built</summary>
        <p>
          The target is <code>delta_run_exp</code>, the change in the batting team’s run expectancy across each pitch, as defined in <a href="https://baseballsavant.mlb.com/csv-docs">Baseball Savant’s CSV documentation</a>. Balls, called strikes, whiffs, fouls and balls in play all count. For each evaluation season, June 15 is the decision date. Models use prior seasons and pitches before that date, and everything after it is future data. A hitter needs at least 300 prior pitches and 100 later pitches, decided at the cutoff.
        </p>
        <p>
          The sequence was fixed as 2017–2022 for development, 2023 for one-time calibration, 2024–2025 as a historical holdout, and 2026 as a separate prospective demonstration. But I built the framework iteratively, and the 2024–25 results were visible while I tightened the decomposition and calibration. They are good out-of-time backtests, not a pristine confirmatory holdout. Every population result here is retrospective. The Vargas record was kept separate from the historical analysis. Its post-freeze sample fell below the registered threshold for evaluation.
        </p>
        <p>
          Horizontal location is flipped so positive always means inside to the hitter, and vertical location is normalized between each pitch’s strike-zone bottom and top. The 2026 sample is never pooled with older coordinates: Baseball Savant moved <code>plate_x</code> and <code>plate_z</code> from the front of home plate to its midpoint when MLB adopted the ABS challenge system, documented in the <a href="https://baseballsavant.mlb.com/csv-docs">Statcast field definitions</a> and <a href="https://baseballsavant.mlb.com/changelog/2026-02-19-new-strike-zone-images">Savant’s 2026 changelog</a>. Uncertainty is clustered by hitter-season and pitcher-season where the matchup structure requires both.
        </p>
        <p>
          The historical data come from the MIT-licensed <a href="https://huggingface.co/datasets/Jensen-holm/statcast-era-pitches">Statcast Era Pitches archive</a>, derived from Baseball Savant and checksum-pinned. Duplicate pitch identifiers were removed before modeling, and the source’s 2025 file is complete through September 22, not the final week. The 2026 sample was downloaded directly from Baseball Savant in small date windows and kept separate because of the coordinate change. The frozen Vargas record, post-freeze pitch counts, and scoring code are available in the research files. The historical modeling files remain available on request.
        </p>
      </details>
    </>
  ),
};
