export type DiscoveryPosition = "C" | "1B" | "2B" | "3B" | "SS" | "OF" | "SP" | "RP";

export type DiscoverySeason = {
  year: number;
  war: number;
  salaryMode?: string;
};

export type DiscoveryMlbPlayer = {
  id: string;
  kind: "mlb";
  name: string;
  team: string;
  position: string;
  role?: "position" | "starter" | "reliever" | "two-way";
  age: number;
  custom?: boolean;
  seasonToDateWar?: number;
  platformWar?: number;
  tradeProtection?: "none" | "partial" | "full";
  availability?: {
    status: string;
    injury?: string;
  };
  seasons: DiscoverySeason[];
};

export type DiscoveryProspectPlayer = {
  id: string;
  kind: "prospect";
  name: string;
  team: string;
  position: string;
  age: number;
  fv: string;
  custom?: boolean;
};

export type DiscoveryPlayer = DiscoveryMlbPlayer | DiscoveryProspectPlayer;

export type DiscoveryNeed = {
  id: DiscoveryPosition;
  label: string;
  shortLabel: string;
  slots: number;
  position: DiscoveryPosition;
  seasonToDateWar: number;
  restOfSeasonWar: number;
  playerCount: number;
  seasonToDateRank: number;
  restOfSeasonRank: number;
  needScore: number;
  needLabel: string;
};

export type DiscoveryTarget = {
  id: string;
  player: DiscoveryMlbPlayer;
  incumbentWar: number;
  restOfSeasonWar: number;
  improvement: number;
  playoffOdds: number;
  tradeValue: number;
  controlThrough: number;
  controlYears: number;
  deadlineLabel: string;
  deadlineFit: number;
};

export type DiscoveryOfferAsset = {
  id: string;
  player: DiscoveryPlayer;
  value: number;
};

export type DiscoveryOffer = {
  label: string;
  assetIds: string[];
  assets: DiscoveryOfferAsset[];
  total: number;
  gap: number;
  salaryRelief: boolean;
};

export type DiscoveryValues = Record<
  string,
  { total?: number; low?: number; high?: number } | undefined
>;

export const DISCOVERY_POSITIONS: ReadonlyArray<{
  id: DiscoveryPosition;
  label: string;
  shortLabel: string;
  slots: number;
}>;

export function playerFitsPosition(
  player: DiscoveryPlayer | undefined,
  position: DiscoveryPosition,
): boolean;
export function primaryPositionGroup(
  player: DiscoveryPlayer | undefined,
): DiscoveryPosition | null;
export function restOfSeasonWar(
  player: DiscoveryPlayer | undefined,
  baseYear: number,
): number;
export function seasonToDateWar(
  player: DiscoveryPlayer | undefined,
  baseYear: number,
): number;
export function incumbentRestOfSeasonWar(
  players: DiscoveryPlayer[],
  team: string,
  position: DiscoveryPosition,
  baseYear: number,
): number;
export function rankTeamNeeds(
  players: DiscoveryPlayer[],
  teams: Array<string | { abbr: string }>,
  team: string,
  baseYear: number,
): DiscoveryNeed[];
export function findTradeTargets(args: {
  players: DiscoveryPlayer[];
  values: DiscoveryValues;
  buyerTeam: string;
  position: DiscoveryPosition;
  playoffOdds: Record<string, number>;
  sellerThreshold?: number;
  baseYear: number;
  limit?: number;
}): DiscoveryTarget[];
export function generateOfferPackages(args: {
  players: DiscoveryPlayer[];
  values: DiscoveryValues;
  buyerTeam: string;
  holePosition: DiscoveryPosition;
  targetValue: number;
  baseYear: number;
  limit?: number;
}): DiscoveryOffer[];
