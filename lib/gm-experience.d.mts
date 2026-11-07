export type MarketGuidanceRow = { years?: number | null; aav?: number | null; marketForecast?: { reference?: { years?: number; aav?: number } | null; forecasts?: { years?: number; aav?: number }[] } | null };
export function expectedMarket(row: MarketGuidanceRow): { lowYears: number; highYears: number; lowAav: number | null; highAav: number | null; basis: string };
export function prospectBrief(player: { pos?: string; age?: number; fv?: string | number | null; eta?: string | number | null }): string;
