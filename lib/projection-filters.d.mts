type SearchPlayer = { name?: string; team?: string; position?: string; role?: string };
export const PROJECTION_POSITIONS: [string, string][];
export function matchesProjectionRole(player: SearchPlayer, filter: string): boolean;
export function matchesProjectionSearch(player: SearchPlayer, query: string, teamName?: string): boolean;
export function laterProjectionWar(war?: Record<string, number>): number | null;
