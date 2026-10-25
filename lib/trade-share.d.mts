export function encodeTradeState(state: unknown): string;
export function decodeTradeState(payload: string): unknown | null;
export function buildTradeShareUrl(currentUrl: string, state: unknown): string;
export type SharedPlayerAliasTarget = {
  previousIds?: readonly string[];
};
/** Returns a unique current player ID, or null for missing or ambiguous IDs. */
export function resolveSharedPlayerId<T extends SharedPlayerAliasTarget>(
  id: unknown,
  players: Record<string, T>,
): string | null;
export function sharedSnapshotWarning(savedSnapshot: unknown, bundledSnapshot: string): string | null;
export const TRADE_SHARE_MODEL_VERSION: "2026-10-25.2";
export function sharedModelWarning(savedModelVersion: unknown): string | null;
export const LEGACY_SHARED_SETTINGS: Readonly<{
  timingPreference: 0;
  valuationView: "deadline";
}>;
export function restoreSharedSettings<T extends Record<string, unknown>>(
  value: unknown,
  defaults: T,
): T;
export function isLegacySettingsLink(state: unknown): boolean;
