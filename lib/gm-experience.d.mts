type MarketConsensus = { total: number; minYears: number; maxYears: number; singleSource: string | null };
export function tradeRosterImpact(before: import('./depth-chart.mjs').DepthResult, after: import('./depth-chart.mjs').DepthResult, incomingIds?: string[]): {
  warChange: number;
  positions: {pos: string; change: number}[];
  incoming: {pid: string; name: string; pt: number; unit: string; roles: {pos: string; pt: number; inferred: boolean}[]}[];
  displaced: {name: string; unit: string; loss: number}[];
};
export type MarketGuidanceRow = {
  years?: number | null;
  aav?: number | null;
  marketForecast?: {
    reference?: { years?: number; aav?: number } | null;
    forecasts?: { years?: number; aav?: number }[];
    consensus?: MarketConsensus | null;
  } | null;
};
export function expectedMarket(row: MarketGuidanceRow): { lowYears: number; highYears: number; lowAav: number | null; highAav: number | null; basis: string };
export function prospectBrief(player: { pos?: string; age?: number; fv?: string | number | null; eta?: string | number | null }): string;
export type RosterIdentity = { n: string; pos: string; k: "m" | "p"; age?: number; fv?: string | number; eta?: number; prot?: string };
export function ownedRoster(ctx: import("./gm-sim.mjs").GmContext, owner: Map<string, string | null>, team: string): { pid: string; v: RosterIdentity; priced: boolean }[];
export function couldFitBudget(row: MarketGuidanceRow, available: number, pending?: boolean): boolean;
export function alternativeRole(input: { selectedRole?: string; rememberedRole?: string; eligible?: string[]; projectedPositions?: string[] }): string;
export function isUsefulAlternative(candidate: { gain: number; positions: string[] }, role: string): boolean;
export function resultImpact(wins: number, playoffDelta: number): { headline: string; playoffs: string };
export function gradeContext(budget: number, standardBudget: number, startingPayroll: number, mode: string): string | null;
