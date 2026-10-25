import { join, resolve } from "node:path";
import { replaySnapshot } from "./snapshot-runtime/replay.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const snapshotId = process.argv[2];
const playerId = process.argv[3];
if (!snapshotId || !playerId || process.argv.includes("--help")) {
  console.error("Usage: node scripts/replay-research-snapshot.mjs <YYYY-MM-DD> <player-id>");
  process.exit(snapshotId && playerId ? 0 : 1);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotId)) throw new Error("Snapshot date must be YYYY-MM-DD.");
const result = await replaySnapshot(join(root, "public", "research", "snapshots", snapshotId), playerId);
console.log(JSON.stringify(result, null, 2));
