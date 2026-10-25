export type ModelSettingsShape = {
  dollarsPerWar: number;
  regularRosterWar: number;
  relieverRosterWar: number;
  timingPreference: number;
  starPremium: number;
  starThreshold: number;
  deadlineBoost: number;
  postseasonStarterBaselineWar: number;
  postseasonEquivalentSeason: number;
  relieverPremium: number;
  inflation: number;
  minimumSalary: number;
  valuationView: ValuationView;
};

export type ValuationView = "offseason" | "deadline";
export const valuationViews: readonly ValuationView[];
export function normalizeValuationView(value: unknown): ValuationView;
export const FANGRAPHS_PROSPECT_DISCOUNT: 10;

export type ValueRow = {
  year: number;
  war: number;
  market: number;
  salary: number;
  surplus: number;
  deadlineAdjustment: number;
  deadlineCurrentWinAdjustment: number;
  octoberAdjustment: number;
  /** True for rest-of-2026 rows dropped from value in the offseason view. */
  excluded: boolean;
  /** Discounted surplus the row would have contributed had it counted. */
  excludedSurplus: number;
  /** True for seasons after the aging-model anchor year. */
  extrapolated: boolean;
  /** True for seasons inside a multi-year, all-or-nothing player option. */
  optionBlock: boolean;
  /** True when that option block is settled as opted out (rows count as zero). */
  optedOut: boolean;
};

export type PlayerValue = {
  total: number;
  low: number;
  high: number;
  rows: ValueRow[];
  projectionTotal?: number;
  prospectTotal?: number;
  prospectRankAdjustment: number;
  rookieAdjustment?: number;
  deadlineAdjustment: number;
  deadlineCurrentWinAdjustment: number;
  octoberAdjustment: number;
  horizonRisk?: number;
  rangeUncertainty?: number;
  expectedWar?: number;
  starOdds?: number;
  valuationView: ValuationView;
  /** Last counted season of any kind, player-option years included. */
  controlThrough: number | null;
  /** Last season before the first player or mutual option; null for prospects. */
  clubControlThrough: number | null;
  /** Last counted player-option season when it runs past club control, else null. */
  playerOptionThrough: number | null;
  /** fWAR over club-controlled counted seasons only; null for prospects. */
  clubControlWar: number | null;
  /** Salary ($M) over club-controlled counted seasons only; null for prospects. */
  clubControlSalary: number | null;
  totalWar: number | null;
  totalSalary: number | null;
  extrapolatedValue: number;
  extrapolatedShare: number | null;
  excludedRosValue: number;
  pendingFreeAgent: boolean;
  fgTradeValueRank: number | null;
  valuationBasis:
    | "projection"
    | "projection blended with prospect grade"
    | "prospect grade";
  prospectWeight: number;
};

export const initialSettings: Readonly<ModelSettingsShape>;
export const prospectValues: Readonly<
  Record<
    string,
    Record<"Hitter" | "Pitcher", { value: number; war: number; star: number }>
  >
>;
export function isReliever(player: {
  position: string;
  role?: "position" | "starter" | "reliever" | "two-way";
}): boolean;
export function prospectRankAdjustment(
  player: { fv?: string; rank?: number | null },
  database: unknown,
): number;
export function estimateFirstArbitrationSalary(
  player: unknown,
  metrics: Record<string, number> | undefined,
  inflation?: number,
): number;
export function estimateArbitrationSalary(
  player: unknown,
  salaryMode: "arb1" | "arb2" | "arb3" | "arb4",
  metrics: Record<string, number> | undefined,
  priorSalary?: number,
  inflation?: number,
  annualInflation?: number,
): number;
export function effectiveSeasons<T extends { seasons: unknown[] }>(
  player: T & {
    contractScenario?: {
      selectedId: string;
      options: Array<{ id: string; seasons: unknown[] }>;
    };
  },
): unknown[];
export function marketValueForSeason(
  player: unknown,
  season: unknown,
  settings: ModelSettingsShape,
  database: unknown,
): number;
export function postseasonRotationValueForSeason(
  player: unknown,
  season: unknown,
  settings: ModelSettingsShape,
  database: unknown,
): number;
export function valuePlayer(
  player: unknown,
  settings: ModelSettingsShape,
  database: unknown,
): PlayerValue;
