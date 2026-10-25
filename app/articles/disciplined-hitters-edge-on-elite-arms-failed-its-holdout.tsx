import Link from "next/link";
import type { Article } from "./types";
import { AUTHOR } from "./types";

const FIG = "/analysis/decision-skill-elite-pitching";
const FILES = "/research/paq-elite-pitching-2026-10-24";

export const article: Article = {
  slug: "disciplined-hitters-edge-on-elite-arms-failed-its-holdout",
  category: "Research",
  title: "Disciplined hitters’ edge on elite arms failed its holdout",
  summary:
    "From 2022 to 2026, each standard deviation of swing-decision skill was worth about 5 extra wOBA points against the hardest-to-hit pitchers, most of them relievers. A test I registered before downloading the data, on the 2021 regular season and six postseasons, came back at −1.4 points (95% interval −7.5 to +4.6). The decision skill is real. This payoff isn’t established.",
  author: AUTHOR,
  published: "2026-10-24",
  dateLabel: "October 24, 2026",
  readTime: "8 min read",
  status:
    "Status, October 24, 2026: The holdout test failed its pre-registered pass rule. Under the rules I set in advance, that counts as evidence against the effect at the size I expected. An independent check reproduced every number. The 2026 postseason is included through games of October 23.",
  evidence: {
    href: `${FILES}.tar.gz`,
    label: "Protocols, locks, results and both independent verifications (download)",
  },
  body: (
    <>
      <p className="article-lead">
        For five straight seasons, the numbers said the same thing. Hitters who make good swing decisions hold up better against the nastiest pitchers in baseball than hitters who don’t. Then I tested the claim on data I hadn’t looked at, under rules I wrote down before downloading it. It didn’t hold up.
      </p>
      <p>
        This is the story of a finding that was consistent, plausible and robust to every check I could think of, and that still failed its holdout. I think the failure is more useful than the finding would have been.
      </p>

      <h2>What I found</h2>
      <ul className="findings">
        <li>
          <strong>Swing-decision skill is a stable skill.</strong> Half a season of a hitter’s decisions predicts the other half with a reliability of 0.84 at 300 plate appearances, about the same as chase rate and strikeout rate. wOBA manages 0.2 to 0.3 on the same test.
        </li>
        <li>
          <strong>In 2022–26 it seemed to pay off against elite pitchers.</strong> Each standard deviation of decision skill was worth about 5 extra wOBA points against the hardest-to-hit 20% of pitchers, beyond its value against everyone else. The effect was positive in all five seasons.
        </li>
        <li>
          <strong>The holdout didn’t confirm it.</strong> In the 2021 regular season plus the 2021–26 postseasons, the estimate was −1.4 wOBA points, with a 95% interval of −7.5 to +4.6. That interval rules out the size I expected. It doesn’t rule out a small positive effect.
        </li>
        <li>
          <strong>Decision skill still doesn’t forecast much.</strong> In the original study, it didn’t earn hitters better pitches, it didn’t predict better contact, and it didn’t improve a wOBA forecast that already knows strikeout, walk, swing and contact rates.
        </li>
      </ul>

      <h2>Measuring decisions</h2>
      <p>
        The measure comes from a pre-registered study of plate-appearance quality, which I locked on October 23. Every pitch is graded in runs against a reference: what the league does with the same pitch, in the same location, in the same count.
      </p>
      <p>
        Take a pitch the league swings at 70% of the time, where swinging is worth 0.03 runs more than taking. A hitter who swings gets credit for the 30% of the decision the league tends to get wrong: 0.3 × 0.03 = 0.009 runs. A hitter who takes is charged the other 70%. Summed over a season, that’s his decision value. It counts a disciplined take and an aggressive swing at a hittable strike the same way, and it ignores what happens after contact.
      </p>
      <p>
        The spread is real money. One standard deviation among regulars is about 0.32 runs per 100 pitches, or roughly 7.5 runs over a full season of decisions.
      </p>

      <h2>The pattern in 2022–26</h2>
      <p>
        The original study asked five questions, and most came back null. The exception was a question about elite pitching. I defined “elite” in advance as the 20% of pitchers whose stuff was hardest to swing at profitably the season before. In the 2025 and 2026 test seasons, decision skill was worth about 6.6 extra wOBA points per standard deviation against those pitchers (95% interval 3.5 to 9.6). It cleared the study’s multiple-testing correction.
      </p>
      <p>
        I then went looking for what drove it. That second round was exploratory: about 80 specifications on seasons I’d already used, which is exactly how false findings get made. It also made the pattern look sharper.
      </p>

      <figure className="article-figure">
        <img
          src={`${FIG}/decision-edge-by-pitcher-decile.png`}
          width={1600}
          height={736}
          loading="lazy"
          alt="Bar chart of the extra wOBA that one standard deviation of swing-decision skill was worth, by pitcher decile, 2022–26. The two hardest-to-hit deciles show about +6.1 and +5.6 wOBA points with intervals above zero. Deciles 3 through 10 range from about −1.5 to +2.8 points, with intervals that include zero."
        />
        <figcaption>
          Exploratory, 2022–26 regular seasons. Each bar is the extra value of one standard deviation of pre-game decision skill against pitchers in that decile, relative to the model’s expectation. Deciles are based on the prior season’s swing hittability allowed. The dashed line is the elite cut registered in advance.
        </figcaption>
      </figure>

      <ul>
        <li>
          <strong>It looked like a step, not a slope.</strong> Decision skill was worth about 6 points against the two hardest-to-hit deciles and about zero against the other eight.
        </li>
        <li>
          <strong>It looked like a bullpen effect.</strong> Four in five of those pitchers were relievers, averaging 95.4 mph with a 30% whiff rate and a 10.3% walk rate. Rank starters only against other starters, and the edge disappeared.
        </li>
        <li>
          <strong>It looked like more than chase rate.</strong> O-Swing% on its own showed about 70% of the effect. With both in the same model, decision skill kept its full size and chase rate dropped to zero. The missing piece was staying aggressive on hittable strikes.
        </li>
        <li>
          <strong>The runs looked like they came from contact.</strong> Against those pitchers, the bottom third of hitters by decision skill lost about 21 wOBA points against their own baselines, and the top third lost about 10. About 60% of that gap was quality of contact, about 20% walks and about 13% strikeouts. The better-deciding hitters didn’t get better pitches; they did more with the same ones.
        </li>
      </ul>
      <p>
        It was a tidy story: elite relievers punish a bad swing decision harder, so the hitters who make fewer of them hold up. It survived dropping 2026, the first season with the automated strike zone. It survived controlling for hitter quality in deciles, fixed effects for every hitter-season and pitcher-season, and switching from expected to actual wOBA. None of that is the same as being true.
      </p>

      <h2>The holdout</h2>
      <p>
        Every season I had examined was now used up. Two pieces of data remained that no analysis of this question had touched.
      </p>
      <ul>
        <li>
          <strong>The 2021 regular season.</strong> The study scored its pitches, but nobody had fit the elite-pitching model on it. Its elite list comes from the 2020 season, which hadn’t been downloaded.
        </li>
        <li>
          <strong>Every postseason from 2021 to 2026.</strong> The study had filtered postseason games out. The 2026 postseason is still going, so I registered a cutoff: games through October 23.
        </li>
      </ul>
      <p>
        I wrote the test down and recorded the file’s checksum at 4:39 p.m. ET on October 24, before downloading either dataset. The protocol fixed the model, the sample, the pass rule and how I’d interpret each outcome. For postseason games, it froze every input at the end of that regular season, so no postseason pitch could feed the predictors. It also stated the power in advance: about a coin flip. A real effect could fail this test.
      </p>

      <figure className="article-figure">
        <img
          src={`${FIG}/holdout-forest.png`}
          width={1600}
          height={896}
          loading="lazy"
          alt="Dot-and-interval chart of the extra wOBA per standard deviation of decision skill against elite pitchers. The 2022 to 2026 regular seasons are all positive, from +2.2 to +7.1 points, pooled at +5.0. In the pre-registered holdout, the 2021 regular season is −3.1, the 2021–26 postseasons +1.5, and the pooled holdout −1.4 with an interval from about −7.5 to +4.6."
        />
        <figcaption>
          Each row is the extra value of one standard deviation of decision skill against elite pitchers, in wOBA points, with a 95% interval. Standard errors are clustered by hitter and pitcher. The blue rows are the seasons where the effect was found; 2025–26 was the original pre-registered test. The orange rows are the holdout.
        </figcaption>
      </figure>

      <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Holdout results"><table><caption>Pre-registered holdout results, wOBA points per SD of decision skill against elite pitchers</caption><thead><tr><th scope="col">Sample</th><th scope="col">Estimate</th><th scope="col">95% interval</th><th scope="col">Plate appearances</th></tr></thead><tbody>
        <tr><th scope="row">2021 regular season</th><td className="num">−3.1</td><td className="num">−10.5 to +4.2</td><td className="num">106,559</td></tr>
        <tr><th scope="row">2021–26 postseasons</th><td className="num">+1.5</td><td className="num">−9.5 to +12.4</td><td className="num">16,900</td></tr>
        <tr><th scope="row">Pooled holdout</th><td className="num">−1.4</td><td className="num">−7.5 to +4.6</td><td className="num">123,459</td></tr>
        <tr><th scope="row">Relievers only (registered secondary)</th><td className="num">−2.8</td><td className="num">−10.8 to +5.3</td><td className="num">41,214</td></tr>
      </tbody></table></div>

      <p>
        A pass needed three things: a pooled one-sided p-value under 0.025, a positive estimate in the 2021 block and a positive estimate in the postseason block. The test failed the first two. The pooled p-value was 0.68. The relievers-only version, the place the exploratory work said the effect lived, was negative too.
      </p>
      <p>
        A separate verification pass, independent of the code that produced the result, rebuilt the test from scratch and reproduced every number. It confirmed that the protocol was followed, that the postseason game counts match the public record and that no postseason information leaked into the inputs.
      </p>

      <h2>How to read a failure</h2>
      <p>
        The pre-registered rules say a pooled estimate at or below zero counts as evidence against the effect at the planned size. That’s the verdict. Three things put it in context, and none of them rescues the finding.
      </p>
      <ul>
        <li>
          <strong>The test was weaker than planned.</strong> Power to detect a 5-point effect came out at 37%, not the 52% I projected, mostly because the 2021 estimate was noisier than expected. A failure at 37% power is not a refutation. But the point estimate is negative, not a weak positive, and the interval excludes the size the earlier seasons pointed to.
        </li>
        <li>
          <strong>2021 is about a two-standard-error outlier.</strong> Its estimate differs from the 2022–26 pool with a two-sided p of 0.04. Across all six seasons, though, the variation is not significant (p = 0.29). So 2021 could be the unlucky season. It could also be the honest one.
        </li>
        <li>
          <strong>The short 2020 season isn’t the explanation.</strong> I worried that a 60-game season made a poor elite list. Every variant built from 2020 came out negative, and so did a version built from 2022. Defining elite from 2021 itself gave about +0.8 points: still near zero, and that version uses the same season’s outcomes, which the registered test avoided on purpose.
        </li>
      </ul>
      <p>
        The bigger lesson is about the 2022–26 picture. The original 2025–26 test passed, and that pass was real. Everything after it was me looking at the same seasons from more angles: the step at the top 20%, the bullpen effect, the contact story. Every angle made the effect look more specific, which is what an effect looks like when you go looking for it. The holdout is the only clean read I have beyond the original test, and it says the payoff is smaller than I thought, or isn’t there.
      </p>

      <h2>What’s still true</h2>
      <p>
        The decision measure itself held up throughout. It’s among the most reliable things you can measure about a hitter: 0.84 split-half reliability at 300 PA, and stable year to year. It isn’t just chase rate renamed, either. After removing chase, zone-swing and contact rates, it keeps a reliability of 0.6 to 0.7.
      </p>
      <p>
        What hasn’t held up is any payoff beyond what the usual numbers see. Good decisions didn’t earn better pitches, didn’t predict better contact and didn’t sharpen a wOBA forecast that already knows a hitter’s strikeout, walk, swing and contact rates. And now the one place it seemed to matter more, against elite arms, didn’t survive a clean test.
      </p>
      <p>
        That makes decision value a good way to describe how a hitter works an at-bat, and not yet a way to predict what he’ll do.
      </p>

      <h2>What’s next</h2>
      <p>
        The next clean test is the 2027 regular season. If the effect is real at the size the earlier seasons suggested, a full season gives roughly even odds of seeing it. Pooled with this holdout, it should give a much clearer answer.
      </p>

      <h2>Methods in brief</h2>
      <ul>
        <li>
          <strong>Data:</strong> Statcast pitch-level data from Baseball Savant, 2020–2026. The 2020 data was used only to build the 2021 elite list.
        </li>
        <li>
          <strong>Decision skill:</strong> P1, swing-decision value against a league reference, in runs per 100 pitches. Pre-game values are shrunk toward zero with a ballast of 1,000 pitches. One SD is 0.154.
        </li>
        <li>
          <strong>Elite pitchers:</strong> the bottom 20% by prior-season mean swing hittability, among pitchers with at least 300 pitches. For the postseason, the same season’s regular season is used.
        </li>
        <li>
          <strong>Model:</strong> a PA’s xwOBA minus a log5 expectation built from shrunk hitter xwOBA and pitcher xwOBA allowed. Controls are handedness, times through the order, starter or reliever, park, and hitter xwOBA × elite. Standard errors are clustered by hitter and pitcher. One run per PA is 1,250 wOBA points.
        </li>
        <li>
          <strong>What’s published:</strong> both protocols with their checksums, the implementation decisions, the results and both independent verifications are in <a href={`${FILES}.tar.gz`}>the research bundle</a>. The original study’s reliability results are summarized in its <a href={`${FILES}/original-study/REPORT.md`}>results report</a>.
        </li>
        <li>
          <strong>Individual hitters aren’t named.</strong> A hitter’s own “vs elite” split had a reliability of 0.02 to 0.2, which is mostly noise.
        </li>
      </ul>
      <p className="source-line">
        Related: <Link href="/analysis/three-statcast-ideas-that-didnt-improve-the-forecast">Three Statcast ideas that didn’t improve the forecast</Link>.
      </p>
    </>
  ),
};
