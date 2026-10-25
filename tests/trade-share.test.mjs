import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTradeShareUrl,
  decodeTradeState,
  encodeTradeState,
  isLegacySettingsLink,
  resolveSharedPlayerId,
  restoreSharedSettings,
  sharedModelWarning,
  TRADE_SHARE_MODEL_VERSION,
} from "../lib/trade-share.mjs";
import { initialSettings } from "../lib/value-model.mjs";

test("round-trips a versioned trade with Unicode player data", () => {
  const state = {
    v: 1,
    modelVersion: TRADE_SHARE_MODEL_VERSION,
    leftTeam: "BOS",
    rightTeam: "NYM",
    leftIds: ["custom-jose"],
    rightIds: ["mlb-123"],
    leftCash: 12.5,
    rightCash: 0,
    overrides: [{ id: "custom-jose", name: "José Álvarez ⚾" }],
  };

  assert.deepEqual(decodeTradeState(encodeTradeState(state)), state);
  assert.equal(sharedModelWarning(state.modelVersion), null);
});

test("links with absent or older model versions warn even when the snapshot is unchanged", () => {
  assert.equal(sharedModelWarning(TRADE_SHARE_MODEL_VERSION), null);
  assert.match(sharedModelWarning(undefined), /recalculated under the current model/);
  assert.match(sharedModelWarning("2026-10-16"), /recalculated under the current model/);
});

test("rejects malformed and unsupported trade payloads", () => {
  assert.equal(decodeTradeState("not-valid-base64"), null);
  assert.equal(decodeTradeState(encodeTradeState({ v: 2 })), null);
  assert.equal(decodeTradeState("a".repeat(100_001)), null);
  assert.throws(
    () => encodeTradeState({ v: 1, note: "a".repeat(100_001) }),
    /too large/,
  );
});

test("resolves a saved player ID to its unique current ID", () => {
  const players = {
    "mlb-current": { previousIds: ["mlb-before"] },
    "prospect-current": { previousIds: ["prospect-before"] },
  };
  assert.equal(resolveSharedPlayerId("mlb-current", players), "mlb-current");
  assert.equal(resolveSharedPlayerId("mlb-before", players), "mlb-current");
  assert.equal(resolveSharedPlayerId("missing", players), null);
  assert.equal(resolveSharedPlayerId(123, players), null);
});

test("rejects IDs that match more than one current or former player", () => {
  assert.equal(
    resolveSharedPlayerId("reused", {
      "mlb-current": { previousIds: ["reused"] },
      "prospect-current": { previousIds: ["reused"] },
    }),
    null,
  );
  assert.equal(
    resolveSharedPlayerId("mlb-current", {
      "mlb-current": {},
      "prospect-current": { previousIds: ["mlb-current"] },
    }),
    null,
  );
});

test("shared trades always open the trade route with explicit model settings", () => {
  const state = {
    v: 1,
    snapshot: "2026-07-31",
    leftTeam: "SEA",
    rightTeam: "PIT",
    leftIds: ["mlb-677594"],
    rightIds: ["mlb-694973"],
    settings: { deadlineBoost: 15 },
    overrides: [],
  };
  const url = new URL(buildTradeShareUrl("https://dugoutvalue.com/tools/rankings?old=1#top", state));
  assert.equal(url.pathname, "/tools/trade");
  assert.equal(url.searchParams.has("old"), false);
  assert.equal(url.hash, "");
  assert.deepEqual(decodeTradeState(url.searchParams.get("trade")), {
    ...state,
    settings: { deadlineBoost: 15, valuationView: "deadline", timingPreference: 0 },
  });
});

test("legacy links without valuationView or timingPreference decode to their old meaning", () => {
  const legacy = decodeTradeState(
    encodeTradeState({ v: 1, settings: { dollarsPerWar: 14, starPremium: 30 } }),
  );
  assert.equal(legacy.settings.valuationView, "deadline");
  assert.equal(legacy.settings.timingPreference, 0);
  assert.equal(legacy.settings.dollarsPerWar, 14);

  const restored = restoreSharedSettings(legacy.settings, initialSettings);
  assert.equal(restored.valuationView, "deadline");
  assert.equal(restored.timingPreference, 0);
  assert.equal(restored.dollarsPerWar, 14);
  assert.equal(restored.starPremium, 30);
  // Fields the link never stored come from the supplied defaults.
  assert.equal(restored.inflation, initialSettings.inflation);
});

test("links saved with the new fields keep them", () => {
  const state = {
    v: 1,
    settings: { ...initialSettings, timingPreference: 20, valuationView: "offseason" },
  };
  const decoded = decodeTradeState(encodeTradeState(state));
  assert.deepEqual(decoded.settings, state.settings);
  const restored = restoreSharedSettings(decoded.settings, initialSettings);
  assert.equal(restored.valuationView, "offseason");
  assert.equal(restored.timingPreference, 20);
  assert.equal(restoreSharedSettings({ ...state.settings, timingPreference: 0 }, initialSettings).timingPreference, 0);
});

test("restored settings are clamped and unknown views fall back to deadline", () => {
  const restored = restoreSharedSettings(
    { timingPreference: 500, dollarsPerWar: "12", valuationView: "winter" },
    initialSettings,
  );
  assert.equal(restored.timingPreference, 100);
  assert.equal(restored.dollarsPerWar, initialSettings.dollarsPerWar);
  assert.equal(restored.valuationView, "deadline");
  assert.deepEqual(restoreSharedSettings(null, initialSettings), initialSettings);
});

test("legacy settings preserve the July value for an unchanged player", async () => {
  const { readFile } = await import("node:fs/promises");
  const { valuePlayer } = await import("../lib/value-model.mjs");
  const database = JSON.parse(
    await readFile(new URL("../app/data/player-database.json", import.meta.url)),
  );
  const skenes = database.players.find((player) => player.name === "Paul Skenes");
  const legacySettings = restoreSharedSettings(
    decodeTradeState(encodeTradeState({ v: 1, settings: {} })).settings,
    initialSettings,
  );
  const old = valuePlayer(
    skenes,
    { ...initialSettings, timingPreference: 0, valuationView: "deadline" },
    database,
  );
  assert.equal(valuePlayer(skenes, legacySettings, database).total, old.total);
  assert.ok(valuePlayer(skenes, initialSettings, database).total < old.total);
});

test("an unversioned Soto link warns when the new option changes its value", async () => {
  const { readFile } = await import("node:fs/promises");
  const { valuePlayer } = await import("../lib/value-model.mjs");
  const database = JSON.parse(
    await readFile(new URL("../public/research/snapshots/2026-10-17/app/data/player-database.json", import.meta.url)),
  );
  const unversioned = decodeTradeState(
    encodeTradeState({
      v: 1,
      snapshot: database.meta.refreshed,
      // A link saved under the October 17 defaults carries its star premium.
      settings: { dollarsPerWar: 18, starPremium: 30 },
    }),
  );
  const settings = restoreSharedSettings(unversioned.settings, initialSettings);
  const soto = database.players.find((player) => player.name === "Juan Soto");
  const oldContract = structuredClone(soto);
  oldContract.contractScenario.selectedId = "stays";

  assert.equal(settings.valuationView, "deadline");
  assert.equal(settings.timingPreference, 0);
  assert.ok(
    valuePlayer(oldContract, settings, database).total -
      valuePlayer(soto, settings, database).total > 60,
  );
  assert.match(sharedModelWarning(unversioned.modelVersion), /recalculated/);
});

test("only links that stored neither view nor discount are flagged as legacy", () => {
  const legacy = decodeTradeState(encodeTradeState({ v: 1, settings: { dollarsPerWar: 14 } }));
  assert.equal(isLegacySettingsLink(legacy), true);
  // The flag is not enumerable, so it never leaks into re-encoded state.
  assert.equal("legacySettings" in JSON.parse(JSON.stringify(legacy)), false);
  const current = decodeTradeState(
    encodeTradeState({ v: 1, settings: { ...initialSettings, valuationView: "deadline" } }),
  );
  assert.equal(isLegacySettingsLink(current), false);
  assert.equal(isLegacySettingsLink(null), false);
});

test("links saved before the reliever cutoff existed keep pricing every reliever the same way", () => {
  // A 2026-10-17.1 link carries its full settings but no relieverPremiumMinWar.
  const october17 = { ...initialSettings };
  delete october17.relieverPremiumMinWar;
  const saved = {
    ...october17,
    dollarsPerWar: 12,
    starPremium: 30,
    relieverPremium: 25,
    valuationView: "offseason",
  };
  const decoded = decodeTradeState(
    encodeTradeState({ v: 1, modelVersion: "2026-10-17.1", settings: saved }),
  );
  assert.deepEqual(decoded.settings, saved);
  assert.equal(isLegacySettingsLink(decoded), false);
  const restored = restoreSharedSettings(decoded.settings, initialSettings);
  // Saved values win; the missing cutoff means "no cutoff", not the new 0.8 default.
  assert.equal(restored.dollarsPerWar, 12);
  assert.equal(restored.starPremium, 30);
  assert.equal(restored.relieverPremium, 25);
  assert.equal(restored.relieverPremiumMinWar, 0);
  assert.match(sharedModelWarning(decoded.modelVersion), /earlier or unknown model version/);
  // Fully legacy links (no view, no discount) behave the same way.
  assert.equal(
    restoreSharedSettings(decodeTradeState(encodeTradeState({ v: 1, settings: {} })).settings, initialSettings)
      .relieverPremiumMinWar,
    0,
  );
});

test("the reliever cutoff round-trips through a link and is clamped", () => {
  const state = { v: 1, modelVersion: TRADE_SHARE_MODEL_VERSION, settings: { ...initialSettings, relieverPremiumMinWar: 1.2 } };
  const decoded = decodeTradeState(encodeTradeState(state));
  assert.equal(restoreSharedSettings(decoded.settings, initialSettings).relieverPremiumMinWar, 1.2);
  assert.equal(sharedModelWarning(decoded.modelVersion), null);
  assert.equal(restoreSharedSettings({ ...state.settings, relieverPremiumMinWar: 99 }, initialSettings).relieverPremiumMinWar, 10);
  assert.equal(restoreSharedSettings({ ...state.settings, relieverPremiumMinWar: "0.5" }, initialSettings).relieverPremiumMinWar, initialSettings.relieverPremiumMinWar);
  assert.equal(TRADE_SHARE_MODEL_VERSION, "2026-10-25.2");
});
