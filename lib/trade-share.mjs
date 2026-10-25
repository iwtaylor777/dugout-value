const MAX_PAYLOAD_LENGTH = 100_000;

// Increment this when a model or bundled contract change can alter a saved
// trade's values even if its player snapshot date and settings are unchanged.
export const TRADE_SHARE_MODEL_VERSION = "2026-10-25.1";

const bytesToBase64Url = (bytes) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

export function encodeTradeState(state) {
  const json = JSON.stringify(state);
  const payload = bytesToBase64Url(new TextEncoder().encode(json));
  if (payload.length > MAX_PAYLOAD_LENGTH) {
    throw new RangeError("Trade link is too large");
  }
  return payload;
}

// Links saved before the offseason view existed carry no valuationView and were
// priced with no discount. Fill those two fields with their old meaning so the
// link retains its saved settings; every other missing field is left for the
// caller to default. Bundled player inputs or model rules may have changed.
export const LEGACY_SHARED_SETTINGS = Object.freeze({
  timingPreference: 0,
  valuationView: "deadline",
});

function migrateLegacySettings(state) {
  const settings = state.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings))
    return state;
  const migrated = { ...settings };
  let legacy = false;
  if (!Object.hasOwn(migrated, "valuationView")) {
    migrated.valuationView = LEGACY_SHARED_SETTINGS.valuationView;
    legacy = true;
  }
  if (!Object.hasOwn(migrated, "timingPreference")) {
    migrated.timingPreference = LEGACY_SHARED_SETTINGS.timingPreference;
    legacy = true;
  }
  const result = { ...state, settings: migrated };
  // Non-enumerable, so it never shows up in comparisons or re-encoded state.
  if (legacy)
    Object.defineProperty(result, "legacySettings", { value: true });
  return result;
}

// True when decodeTradeState filled in the pre-October-16 defaults because the
// link stored neither a valuation view nor a discount rate.
export const isLegacySettingsLink = (state) =>
  Boolean(state && typeof state === "object" && state.legacySettings === true);

const SHARED_SETTING_RANGES = Object.freeze({
  dollarsPerWar: [0, 50],
  regularRosterWar: [0, 10],
  relieverRosterWar: [0, 10],
  timingPreference: [0, 100],
  starPremium: [0, 200],
  starThreshold: [0, 10],
  deadlineBoost: [0, 50],
  postseasonStarterBaselineWar: [0, 10],
  postseasonEquivalentSeason: [0, 100],
  relieverPremium: [0, 200],
  relieverPremiumMinWar: [0, 10],
  inflation: [0, 100],
  minimumSalary: [0, 10],
});

// Turns the settings object from a decoded link into a complete, clamped
// settings object. Missing numeric fields fall back to defaults, except that
// a payload with no valuationView or timingPreference is a legacy link.
export function restoreSharedSettings(value, defaults) {
  const record =
    value && typeof value === "object" && !Array.isArray(value) ? value : null;
  if (!record) return { ...defaults };
  const source = migrateLegacySettings({ settings: record }).settings;
  const restored = { ...defaults };
  for (const [key, [minimum, maximum]] of Object.entries(
    SHARED_SETTING_RANGES,
  )) {
    const candidate = source[key];
    if (typeof candidate === "number" && Number.isFinite(candidate))
      restored[key] = Math.min(maximum, Math.max(minimum, candidate));
  }
  // Links saved before the reliever threshold existed priced every reliever
  // with the saved premium, so a missing threshold means 0, not the new default.
  if (!Object.hasOwn(source, "relieverPremiumMinWar"))
    restored.relieverPremiumMinWar = 0;
  restored.valuationView =
    source.valuationView === "offseason" ? "offseason" : "deadline";
  return restored;
}

export function decodeTradeState(payload) {
  try {
    if (!payload || payload.length > MAX_PAYLOAD_LENGTH) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === "object" && parsed.v === 1
      ? migrateLegacySettings(parsed)
      : null;
  } catch {
    return null;
  }
}

export function buildTradeShareUrl(currentUrl, state) {
  const url = new URL(currentUrl);
  url.pathname = "/tools/trade";
  url.search = "";
  url.hash = "";
  url.searchParams.set("trade", encodeTradeState(state));
  return url.toString();
}

// Resolves an ID from a saved link to its current canonical ID. A current ID
// that is also another player's former ID is deliberately rejected: picking a
// player in that case could restore a trade or edit for the wrong person.
export function resolveSharedPlayerId(id, players) {
  if (typeof id !== "string" || !players || typeof players !== "object")
    return null;
  const matches = new Set();
  if (Object.hasOwn(players, id)) matches.add(id);
  for (const [canonicalId, player] of Object.entries(players)) {
    if (
      player &&
      typeof player === "object" &&
      Array.isArray(player.previousIds) &&
      player.previousIds.includes(id)
    )
      matches.add(canonicalId);
  }
  return matches.size === 1 ? [...matches][0] : null;
}

export function sharedSnapshotWarning(savedSnapshot, bundledSnapshot) {
  if (typeof savedSnapshot !== "string" || savedSnapshot === bundledSnapshot) return null;
  return `This shared trade used the ${savedSnapshot} player snapshot. Unedited players now use the bundled ${bundledSnapshot} snapshot, so their values have been recalculated. Saved custom and edited player inputs remain as shared.`;
}

export function sharedModelWarning(savedModelVersion) {
  if (savedModelVersion === TRADE_SHARE_MODEL_VERSION) return null;
  return "This trade link was saved with an earlier or unknown model version. Player values have been recalculated under the current model and contract assumptions, so they may differ from the original link.";
}
