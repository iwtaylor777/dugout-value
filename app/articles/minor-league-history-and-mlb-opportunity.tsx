import Link from "next/link";
import report from "../../public/research/playing-time-opportunity-2026-10-21/results.json";
import type { Article } from "./types";
import { AUTHOR } from "./types";

const scores = report.scores;
const one = (x: number) => x.toFixed(1);
const four = (x: number) => x.toFixed(4);
const methods = [
  { key: "mlb", label: "Fitted MLB history" },
  { key: "roster", label: "+ Active-roster status" },
  { key: "minors", label: "+ AA and AAA history" },
] as const;
const rookies = scores.groups.no_prior_mlb;
const minorGain = scores.workload.comparisons.minors_vs_roster;
const probabilityGain = scores.probability.comparisons.minors_vs_roster;

export const article: Article = {
  slug: "minor-league-history-and-mlb-opportunity",
  category: "Research note",
  title: "Minor-league history helps forecast who gets MLB time",
  summary: "In a 612-hitter development sample, adding Double-A and Triple-A workloads improves the probability forecast. Depth Charts still predicts total plate appearances more accurately.",
  author: AUTHOR,
  published: "2026-10-21",
  dateLabel: "October 21, 2026",
  readTime: "6 min read",
  evidence: { href: "/research#playing-time-opportunity", label: "Player forecasts, fitted model, and replay code" },
  body: <>
    <p className="article-lead">A player without a major-league track record can still be close to a major-league job. The <Link href="/analysis/prior-seasons-and-projection-baselines">previous workload baseline</Link> handled those players poorly: missing MLB seasons pulled their forecasts toward zero. Minor-league playing time offers some information about what that blank record leaves out.</p>
    <p>I tested a simple model that asks two questions: Will this hitter receive any MLB plate appearances from June 1 through the end of the season? If he does, how many? Adding dated roster status and minor-league workloads improves the probability estimates in this sample. The gains in total PA accuracy are smaller, and the full model still trails Depth Charts.</p>

    <h2>A June-to-June comparison</h2>
    <p>The model learns from 584 hitters’ June-through-September 2024 outcomes, using information through May 31. It then forecasts 612 hitters over the corresponding part of 2025. All 77 players with no later MLB PA remain in the evaluation. For an established major leaguer, the probability means getting any further MLB time; it is not specifically a debut or promotion forecast.</p>
    <p>I fitted three versions in advance of scoring 2025. The first uses current and prior-season MLB workload. The second adds whether the player was on an MLB active roster. The third adds current and prior-season PA at Double-A and Triple-A. It does not use minor-league batting performance, prospect grades or injury diagnoses.</p>
    <p>Each version estimates both the chance of playing and workload conditional on playing. Multiplying those estimates gives expected PA. The same fixed regularization limits the size of the fitted coefficients, and every scaling value comes from 2024. No settings were chosen by trying alternatives on the 2025 results.</p>

    <h2>Better probabilities, smaller workload gains</h2>
    <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Playing-time and probability forecast errors"><table style={{ minWidth: 650 }}>
      <caption>June 2025 forecasts, all 612 hitters; lower scores are better</caption>
      <thead><tr><th scope="col" style={{ minWidth: 200 }}>Forecast</th><th scope="col">PA RMSE</th><th scope="col">PA mean absolute error</th><th scope="col">Brier score</th></tr></thead>
      <tbody>
        <tr><th scope="row">Previous historical blend</th><td>{one(scores.workload.metrics.multiyear.rmse)}</td><td>{one(scores.workload.metrics.multiyear.mae)}</td><td>—</td></tr>
        {methods.map(({ key, label }) => <tr key={key}><th scope="row">{label}</th><td>{one(scores.workload.metrics[key].rmse)}</td><td>{one(scores.workload.metrics[key].mae)}</td><td>{four(scores.probability.metrics[key].brier)}</td></tr>)}
        <tr><th scope="row">Archived Depth Charts</th><td>{one(scores.workload.metrics.archived.rmse)}</td><td>{one(scores.workload.metrics.archived.mae)}</td><td>—</td></tr>
      </tbody>
    </table></div>
    <p>RMSE gives large workload misses extra weight. Brier score measures squared probability error: a confident prediction of playing is penalized heavily when the hitter receives no PA. A forecast giving everyone the 2024 playing rate scores {four(scores.probability.metrics.constant.brier)}. Depth Charts’ PA column does not provide an event probability, so it has no Brier score here.</p>
    <p>Adding roster status lowers PA RMSE by {one(scores.workload.comparisons.roster_vs_mlb.rmse_reduction_pct)}%. Adding AA and AAA history lowers it by another {one(minorGain.rmse_reduction_pct)}%, but that second gain is uncertain: its 95% interval runs from {one(-minorGain.interval95_pct[0])}% worse to {one(minorGain.interval95_pct[1])}% better. The probability improvement is clearer within this sample. Brier score falls by {four(probabilityGain.brier_improvement)}, with an interval of {four(probabilityGain.interval95[0])} to {four(probabilityGain.interval95[1])}.</p>
    <p>The fitted MLB-only model already beats the earlier historical blend. Its entire advantage cannot be credited to minor-league information. Even after both additions, the full model’s PA RMSE is {one(-scores.workload.comparisons.minors_vs_archived.rmse_reduction_pct)}% higher than Depth Charts’.</p>

    <h2>Players without recent MLB history</h2>
    <p>The group that motivated this test contains {rookies.n} hitters with no MLB PA in the preceding three seasons. Adding minor-league workloads reduces their average underprediction from {one(-rookies.bias.roster)} PA to {one(-rookies.bias.minors)}. Their PA RMSE falls from {one(rookies.workload.roster.rmse)} to {one(rookies.workload.minors.rmse)}, though Depth Charts still does better at {one(rookies.workload.archived.rmse)}.</p>
    <p>Roman Anthony shows both the improvement and the remaining problem. At the cutoff, he had 237 Triple-A PA in 2025 and none in MLB. The full model assigned him roughly a 75% chance of later MLB time, but only 74 expected PA. He received 303; Depth Charts had forecast 225. Recognizing that he might arrive was easier than estimating how much he would play.</p>
    <p>Probability calibration also needs more than one encouraging average. Among 55 hitters assigned probabilities between 50% and 60%, the average forecast was 56%, while 65% later played. The download reports every probability bin and its player count, including the small groups where the observed fractions are especially noisy.</p>

    <h2>What this test can establish</h2>
    <p>This is development work on seasons already examined in earlier research. Training uses the players listed in an April 2024 archive, with their inputs reconstructed for June. Evaluation uses a June 2025 list. A May arrival missing from the April list cannot enter training, so the two candidate populations are not identical.</p>
    <p>The dated rosters and minor-league totals were retrieved retrospectively. Sampled date-range totals match individual game logs, and official feeds place every May 31 play before the study’s decision times. There is still a timing difference with Depth Charts: one Triple-A game ended 24 minutes after its projection loaded. Ten evaluation hitters had 60 PA in that game before the archive was captured. Our model may therefore have a small information advantage in that comparison.</p>
    <p>The 95% intervals resample 2025 players while holding the 2024 fit fixed. They do not capture the uncertainty of learning from a different season. A missing AA or AAA record also says nothing about experience in other leagues. These results support testing the inputs further, but do not support replacing the trade model’s projections.</p>
    <p>The next useful step is to add earlier June training samples with consistent player-selection rules. After that, dated injury and 40-man roster status could help distinguish an injured regular from a prospect awaiting a promotion. A later forecast saved before its games begin would tell us whether those additions hold up outside the seasons used to develop them.</p>
    <p>The <Link href="/research#playing-time-opportunity">research bundle</Link> includes every training and evaluation row, the fitted coefficients, source checks and code that refits the 2024 model and reproduces the 2025 results offline.</p>
  </>,
};
