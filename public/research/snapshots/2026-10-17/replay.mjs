import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifySnapshot } from "./verify.mjs";

export async function replaySnapshot(directory, playerId) {
  if (!playerId) throw new Error("Provide a player ID to replay.");
  const dir = resolve(directory);
  const manifest = await verifySnapshot(dir);
  const database = JSON.parse(await readFile(join(dir, "app/data/player-database.json"), "utf8"));
  const player = database.players.find((entry) => entry.id === playerId);
  if (!player) throw new Error(`Unknown player ID in this snapshot: ${playerId}`);
  const model = await import(pathToFileURL(join(dir, "lib/value-model.mjs")).href);
  const value = model.valuePlayer(player, model.initialSettings, database);
  return { snapshotId: manifest.snapshotId, sourceDataAsOf: manifest.sourceDataAsOf, modelVersion: manifest.modelVersion, player: { id: player.id, name: player.name, team: player.team }, settings: model.initialSettings, value: { total: value.total, low: value.low, high: value.high, controlThrough: value.controlThrough } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = dirname(fileURLToPath(import.meta.url));
  console.log(JSON.stringify(await replaySnapshot(directory, process.argv[2]), null, 2));
}
