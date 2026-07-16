export type ProjectionRole = "position" | "starter" | "reliever";

export type ProjectionRow = Partial<{
  WAR: number;
  PA: number;
  IP: number;
}>;

export type ProviderProjectionChange = {
  name: string;
  baselineRate: number;
  updatedRate: number;
  changeRate: number;
};
export type InSeasonTalentUpdate = {
  method: string;
  role: ProjectionRole;
  unit: number;
  unitLabel: string;
  rateChange: number;
  rawRateChange: number;
  providerCount: number;
  capped: boolean;
  providers: ProviderProjectionChange[];
};

export const NEXT_YEAR_SIGNAL_CARRY: number;
export const ANNUAL_SIGNAL_DECAY: number;

export function projectionRate(
  row: ProjectionRow | null | undefined,
  role: ProjectionRole,
): number | null;

export function buildInSeasonTalentUpdate(args: {
  role: ProjectionRole;
  providers: Array<{
    name: string;
    preseason?: ProjectionRow;
    updated?: ProjectionRow;
  }>;
}): InSeasonTalentUpdate | null;

export function signalPersistence(year: number, baseYear: number): number;

export function applyInSeasonTalentUpdate(args: {
  baselineWar: number;
  futureProjection?: ProjectionRow;
  role: ProjectionRole;
  year: number;
  baseYear: number;
  update?: InSeasonTalentUpdate | null;
}): {
  baselineWar: number;
  adjustment: number;
  finalWar: number;
  persistence: number;
  workload: number | null;
};
