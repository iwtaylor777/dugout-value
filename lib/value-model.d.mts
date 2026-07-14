export type ModelSettingsShape = {
  dollarsPerWar: number;
  regularRosterWar: number;
  relieverRosterWar: number;
  timingPreference: number;
  starPremium: number;
  relieverPremium: number;
  inflation: number;
  minimumSalary: number;
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
export function marketValueForSeason(
  player: unknown,
  season: unknown,
  settings: ModelSettingsShape,
  database: unknown,
): number;
export function valuePlayer(
  player: unknown,
  settings: ModelSettingsShape,
  database: unknown,
): unknown;
