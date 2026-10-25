import type { Article } from "./types";
import { article as eliteHoldout } from "./do-good-swing-decisions-beat-elite-relievers";
import { article as playingTimeOpportunity } from "./minor-league-history-and-mlb-opportunity";
import { article as projectionBaselines } from "./prior-seasons-and-projection-baselines";
import { article as projectionBenchmark } from "./projection-rates-and-playing-time";
import { article as shapecastResults } from "./shapecast-2026-forecast-results";
import { article as attackability } from "./a-hitters-cold-zone-isnt-a-pitching-plan";
import { article as shapecast } from "./shapecast-pitch-shape-k-bb";
import { article as statcastNulls } from "./three-statcast-ideas-that-didnt-improve-the-forecast";
import { article as ridgeNote } from "./when-a-better-fit-isnt-a-better-forecast";
import { article as whatTradeValueMeasures } from "./what-trade-value-measures";
import { article as howToReadValueRanges } from "./how-to-read-value-ranges";

export type { Article } from "./types";

/**
 * Display order for /analysis and the home page: the research first, newest on top,
 * then the two explainers for the trade model. The home page leads with the first
 * article marked `featured`.
 */
export const articles: Article[] = [
  eliteHoldout,
  playingTimeOpportunity,
  projectionBaselines,
  projectionBenchmark,
  shapecastResults,
  attackability,
  shapecast,
  statcastNulls,
  ridgeNote,
  whatTradeValueMeasures,
  howToReadValueRanges,
];

/** Pieces that explain the trade model rather than report a test. */
export const isExplainer = (article: Article) => article.category === "Explainer" || article.category === "Model guide";
