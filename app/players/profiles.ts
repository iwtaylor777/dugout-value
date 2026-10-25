import database from "../data/player-database.json";
import { initialSettings, valuePlayer } from "../../lib/value-model.mjs";
import { TRADE_SHARE_MODEL_VERSION } from "../../lib/trade-share.mjs";

export const profiles = [
  { id: "mlb-665742", name: "Juan Soto", deck: "How a player opt-out changes the Mets’ side of the value estimate." },
  { id: "mlb-805808", name: "Kevin McGonigle", deck: "A high estimate built on many controlled seasons, including years beyond the published projection series." },
  { id: "mlb-592450", name: "Aaron Judge", deck: "A strong projection paired with a large remaining salary commitment." },
] as const;

// The case studies are computed live with the current default settings, so they carry the
// current model version. The ledger keeps its own pinned version for its October 17 record.
export const modelContext = { playerDataAsOf: database.meta.refreshed, modelVersion: TRADE_SHARE_MODEL_VERSION };

export function getProfile(id: string) {
  const profile = profiles.find(item => item.id === id);
  const player = database.players.find(item => item.id === id);
  if (!profile || !player) return null;
  return { profile, player, estimate: valuePlayer(player, initialSettings, database) };
}

export function sotoOptionValues() {
  const player = database.players.find(item => item.id === "mlb-665742");
  if (!player?.contractScenario) return null;
  return Object.fromEntries(player.contractScenario.options.map(option => [
    option.id,
    valuePlayer({ ...player, contractScenario: { ...player.contractScenario, selectedId: option.id } }, initialSettings, database),
  ]));
}

export const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(1)}M`;
export const percent = (value: number) => `${(value * 100).toFixed(0)}%`;
