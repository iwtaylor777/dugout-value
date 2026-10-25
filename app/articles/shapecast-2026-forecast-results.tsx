import Link from "next/link";
import scores from "../../public/research/2026-forecast-results/forecast_scores.json";
import type { Article } from "./types";
import { AUTHOR } from "./types";

const metrics = scores.shape.metrics;
const points = (value: number) => (value * 100).toFixed(2);

export const article: Article = {
  slug: "shapecast-2026-forecast-results",
  category: "Research note",
  title: "ShapeCast’s 2026 forecasts finished close to the baseline",
  summary: "Pitch shape reduced forecast error by 1.3% across 284 eligible pitchers. The uncertainty interval includes no improvement, and ShapeCast overestimated K-BB% more than the comparison model did.",
  author: AUTHOR,
  published: "2026-10-18",
  dateLabel: "October 18, 2026",
  readTime: "4 min read",
  evidence: { href: "/research#2026", label: "Forecasts, outcomes, and reproduction files" },
  body: <>
    <p className="article-lead">In July, I saved forecasts for 387 pitchers. The version that used pitch shape finished with 1.3% less error than the version built from first-half results alone. That difference is small enough that this test cannot distinguish an advantage from sampling variation.</p>
    <p>The forecasts covered July 16 through September 27, 2026. A pitcher needed at least 75 batters faced in that period to qualify, as specified in the original protocol. Of the 387 pitchers, 284 qualified, accounting for 51,937 batters faced. The other 103 remain in the downloadable results with their eligibility flags; they do not enter the summary statistics.</p>
    <h2>The comparison</h2>
    <p>The baseline uses 16 first-half statistics. ShapeCast adds 45 pitch characteristics. Both predict K-BB%, strikeout rate minus unintentional walk rate, using the event definitions in the original research. Each pitcher’s squared error is weighted by the number of batters he faced in the scoring period.</p>
    <div className="article-table-wrap" tabIndex={0} role="region" aria-label="2026 forecast errors"><table><caption>2026 scoring results, in K-BB percentage points</caption><thead><tr><th scope="col">Metric</th><th scope="col">Results baseline</th><th scope="col">ShapeCast</th></tr></thead><tbody>
      <tr><th scope="row">Root mean squared error</th><td>{points(metrics.baseline.rmse)}</td><td>{points(metrics.shapecast.rmse)}</td></tr>
      <tr><th scope="row">Mean absolute error</th><td>{points(metrics.baseline.mae)}</td><td>{points(metrics.shapecast.mae)}</td></tr>
      <tr><th scope="row">Average forecast minus result</th><td>+{points(metrics.baseline.bias)}</td><td>+{points(metrics.shapecast.bias)}</td></tr>
    </tbody></table></div>
    <p>The 95% bootstrap interval runs from ShapeCast having 1.9% more error to 4.1% less error. It comes from 10,000 resamples of pitchers, retaining batters-faced weights within each resample. The point estimate favors ShapeCast, but the interval crosses zero.</p>
    <p>There is also a calibration problem worth following. ShapeCast overestimated K-BB% by 0.96 percentage points on average, compared with 0.58 for the baseline. Its average absolute error was lower overall, but slightly higher among starter-like pitchers. The full results include both role groups and forecast deciles.</p>
    <h2>What was fixed before scoring</h2>
    <p>The forecast file and protocol were saved July 23, using pitches through July 12. Some target-period games had already happened by then, though their data had not been imported into the research workspace. The protocol calls this “workspace-blind prospective.” That is a weaker timing claim than a forecast published before the target period began.</p>
    <p>The saved predictions, eligibility threshold, and model parameters were not revised for this scoring pass. Outcome data came from Baseball Savant in dated chunks. The download manifest records the source requests and checksums; the scoring files retain every frozen pitcher.</p>
    <h2>What this changes</h2>
    <p>The <Link href="/analysis/shapecast-pitch-shape-k-bb">historical test</Link> found a larger gain. This later sample gives less reason to expect that gain to persist. It also provides no 2026 comparison with ZiPS or Steamer: the comparator here is the research model’s own results baseline.</p>
    <p>ShapeCast remains outside the trade model. The next evaluation needs another forecast saved before its target period, with the model specification fixed and its calibration checked on earlier data.</p>
    <p><Link href="/research#2026">Download the forecast, outcome counts, and replay script</Link>. The same release records the Vargas test’s insufficient sample: 28 pitches in its registered region against a minimum of 75.</p>
  </>,
};
