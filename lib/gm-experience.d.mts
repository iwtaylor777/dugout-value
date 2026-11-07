export type MarketGuidanceRow = { years?: number | null; aav?: number | null; marketForecast?: { reference?: { years?: number; aav?: number } | null; forecasts?: { years?: number; aav?: number }[] } | null };
export function expectedMarket(row: MarketGuidanceRow): { lowYears: number; highYears: number; lowAav: number | null; highAav: number | null; basis: string };
export function prospectBrief(player: { pos?: string; age?: number; fv?: string | number | null; eta?: string | number | null }): string;
export type RosterIdentity = { n: string; pos: string; k: "m" | "p"; age?: number; fv?: string | number; eta?: number; prot?: string };
export function ownedRoster(ctx: import("./gm-sim.mjs").GmContext, owner: Map<string, string | null>, team: string): { pid: string; v: RosterIdentity; priced: boolean }[];
export function couldFitBudget(row: MarketGuidanceRow, available: number, pending?: boolean): boolean;
