import type { Article } from "./types";
import { AUTHOR } from "./types";
import Link from "next/link";

export const article: Article = {
  slug: "three-statcast-ideas-that-didnt-improve-the-forecast",
  category: "Research note",
  title: "Three Statcast ideas that didn’t improve the forecast",
  summary:
    "Adjusting home-run forecasts for the pitches a hitter swings at made them 0.9% worse. Adding a pitcher’s secondary pitches improved fastball forecasts by 0.08%, inside an interval that spans zero. Spray-adjusted xwOBA made hitter forecasts 0.3% worse. A null on half a season of public data doesn’t prove an idea is zero, and I’ve kept all three out of the trade tools.",
  author: AUTHOR,
  published: "2026-10-16",
  dateLabel: "October 16, 2026",
  readTime: "6 min read",
  evidence: {
    href: "https://github.com/iwtaylor777/dugout-value",
    label: "Site and model code: GitHub repository (research code and results files available on request)",
  },
  body: (
    <>
      <p className="article-lead">
        I tested three ideas this summer that sounded like they should improve a public forecast. None did. Damage Conversion made 2024–25 home-run forecasts 0.87% worse, Arsenal Synergy improved fastball forecasts by 0.08%, and spray-adjusted xwOBA made hitter forecasts 0.30% worse.
      </p>

      <h2>What I found</h2>
      <ul className="findings">
        <li><strong>Damage Conversion failed.</strong> Crediting hitters for hard pulled contact above what their swings “should” produce didn’t help forecast home runs.</li>
        <li><strong>Arsenal Synergy failed its gate.</strong> Knowing a pitcher’s secondaries barely moved a forecast of his fastball’s results.</li>
        <li><strong>Directional xwOBA is good accounting and a bad forecast.</strong> It cut batted-ball error by about 13%, but that gain is a description of what already happened, not a measure of skill.</li>
        <li><strong>One subgroup hint didn’t survive its interval.</strong> Hitters who pull the ball in the air persistently beat xwOBA by only .0025 more than everyone else (−.0047 to +.0097).</li>
      </ul>

      <h2>How each test worked</h2>
      <p>
        Each idea got the same treatment. I froze a written specification on July 23, 2026, before fitting the model. The model used first-half data to forecast the second half, trained on earlier seasons, and was scored once on 2024–25. Intervals are 95% bootstrap intervals clustered by player. RMSE, root mean squared error, punishes big misses most, and lower is better. Each idea also had a pre-set gate it had to clear. They are tests of public half-season data, not of every possible version of the idea.
      </p>

      <h2>1. Damage Conversion: crediting hitters for what their swings produce</h2>
      <p>
        <strong>The idea.</strong> A hitter’s raw pulled-air rate mixes three things: the pitches he was offered, the ones he chose to swing at, and his ability to turn a swing into damage. Damage Conversion Above Expected (DCAE) estimated how often a league-average hitter would turn each swing into hard pulled air contact, given the pitch, and credited the hitter with the difference. Hard pulled air meant a fair ball hit at least 95 mph, at a 10 to 35 degree launch angle, pulled at least 8 degrees.
      </p>
      <p>
        <strong>The test.</strong> Does a hitter’s first-half DCAE improve a forecast of his second-half home runs per plate appearance, beyond a baseline that already knew his home-run rate, xwOBA, wOBA, strikeouts, walks, exit velocity, launch angle, hard-hit rate and sample size? I scored 496 hitter-seasons from 338 hitters in 2024–25. I had opened those seasons earlier for other aggregate metrics, so this wasn’t a first-ever view of them.
      </p>
      <p>
        <strong>The result.</strong> The baseline’s RMSE was 0.01479 home runs per plate appearance. DCAE’s was 0.01492, which is 0.87% worse (interval 2.21% worse to 0.50% better). Against raw pulled-air rate it was 1.02% worse (2.48% worse to 0.49% better). A subgroup chosen on 2023 data, hitters with a 90th-percentile exit velocity of at least 106.0 mph, looked better: 2.67% lower RMSE on 155 hitter-seasons from 110 hitters, with both years improving. But the interval ran from 0.70% worse to 5.88% better, and the best general model scored 0.01688 in those same hitters, against 0.01750 for the specialized one.
      </p>
      <p>
        <strong>What I take from it.</strong> Adjusting for the pitches a hitter chose to swing at removed signal instead of isolating skill. Reaching and pulling the right pitch may be part of the skill, not context to subtract. The power subgroup is a research hint, not a metric.
      </p>

      <h2>2. Arsenal Synergy: does a good curveball make a B+ fastball play better?</h2>
      <p>
        <strong>The idea.</strong> Pitch-pairing tables suggest a fastball plays up when a pitcher has a good secondary to go with it. I wanted to know if that holds when the forecast can’t peek at the same period’s results.
      </p>
      <p>
        <strong>The test.</strong> Forecast second-half fastball run value per 100 fastballs from first-half information. A fastball-only model used 43 inputs. An arsenal-aware model added the quality, usage and physical separation of the pitcher’s other pitches, 224 inputs in all. Both trained on 2017–23 and were scored once on 1,413 pitcher, fastball-family and batter-side cells from 428 pitchers in 2024–25. The gate included a 2% RMSE gain with an interval that excluded zero, and only a pass would trigger the curveball-by-fastball-grade test I actually cared about.
      </p>
      <p>
        <strong>The result.</strong> RMSE went from 2.0216 to 2.0199 runs per 100 fastballs, a 0.08% gain with an interval from 0.79% worse to 0.96% better. It was 0.29% worse in 2024 and 0.48% better in 2025. The gate failed, so the curveball test never ran. The real arsenal beat a matched shuffled arsenal on average (2.0199 against 2.0378), but that interval also crossed zero. After the holdout opened, I tried smaller feature sets. A curveball-only version was 0.16% better, which can’t rescue a frozen result.
      </p>
      <p>
        <strong>What I take from it.</strong> A same-period pairing table is evidence that two pitches appear together, not that one makes the other better. This doesn’t prove the interaction is zero. Any effect in public first-half features is too small or unstable to improve a second-half forecast. Next, I’ll freeze the compact curveball model on 2026 first-half data before importing any second-half pitches, then score it once. That test isn’t frozen yet.
      </p>

      <h2>3. Directional xwOBA: right about contact, wrong about talent</h2>
      <p>
        <strong>The idea.</strong> xwOBA is the wOBA a batted ball’s exit velocity and launch angle usually earn. It ignores which way the ball went, even though pulled and opposite-field contact are valued differently. A direction-aware version, dxwOBA, should be a better read on a hitter. Public work has already shown that ordinary xwOBA misprices some pulled and opposite-field contact, so a descriptive correction alone wasn’t the goal. The useful version would improve a forecast.
      </p>
      <p>
        <strong>The test.</strong> Stage one measured accounting: how well a model that knows exit velocity, launch angle, spray angle, handedness and batted-ball type predicts each batted ball’s outcome, compared with Statcast’s xwOBA. It knew nothing about the batter, pitcher, team, park or fielders. Stage two asked whether adding dxwOBA to a hitter’s first-half profile improves a forecast of his second-half wOBA, on 496 hitter-seasons from 338 hitters in 2024–25.
      </p>
      <p>
        <strong>The result.</strong> Stage one was a large win. On 121,485 batted balls in 2024 and 117,789 in 2025, RMSE fell from 0.4305 to 0.3723 and from 0.4379 to 0.3797, which is 13.5% and 13.3%. Stage two was a miss: the forecast got 0.30% worse (interval 1.06% worse to 0.38% better), and it was slightly worse by both RMSE and mean absolute error in both years.
      </p>
      <p>
        I also tested the obvious subgroup: hitters in the top quartile of pulled-air share in both the prior season and the current first half (31 in 2024, 29 in 2025). They beat their xwOBA by .013 and .002 the next half, but everyone else beat it by about .005, which left an advantage of just .0025 (−.0047 to +.0097). Directional RMSE in the subgroup was 0.37% worse (2.15% worse to 1.50% better).
      </p>
      <p>
        <strong>What I take from it.</strong> The 13% is better accounting for what already happened, partly because spray angle also stands in for where fielders play and where the fences are. It isn’t a skill metric. A hitter’s half-season spray mix doesn’t add enough to a forecast that already knows his actual wOBA, which lets repeatable pull-related production in without a separate spray adjustment. I do plan to keep directional contact as a descriptive layer. Along the way I also found and removed 176,796 duplicated terminal-pitch rows, mostly in 2025, and discarded the preliminary result that used them.
      </p>

      <h2>What these have in common</h2>
      <p>
        All three ideas were plausible, the data were public, and the tests were fair. In each case a strong baseline already carried most of what the new feature added, or what it added was too noisy to use. That is the same lesson the <Link href="/analysis/shapecast-pitch-shape-k-bb">ShapeCast</Link> result teaches from the other side: when something does add information, it adds a little, and ZiPS still wins. If you only publish the ideas that worked, you can’t tell how many were tried.
      </p>
      <p>
        Two follow-ups are new hypotheses, not rescues. One is location-adjusted pulled-air creation: whether a hitter pulls the ball in the air more than the pitches he sees would predict. The other is the 2026 curveball test above. Neither uses these results to claim a win.
      </p>

      <aside className="article-note">
        <strong>Evidence status</strong>
        <p>
          All three tests are retrospective on 2024–25 and were frozen July 23, 2026 before their model fits. None has a prospective 2026 score yet. The full specifications and results files are in my research directory, available on request.
        </p>
      </aside>
    </>
  ),
};
