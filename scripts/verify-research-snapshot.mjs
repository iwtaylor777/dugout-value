import { join, resolve } from "node:path";
import { verifySnapshot } from "./snapshot-runtime/verify.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const snapshotId = process.argv[2];
const directoryIndex = process.argv.indexOf("--dir");
const suppliedDirectory = directoryIndex >= 0 ? process.argv[directoryIndex + 1] : null;
if (!snapshotId || process.argv.includes("--help")) {
  console.error("Usage: node scripts/verify-research-snapshot.mjs <YYYY-MM-DD> [--dir path]");
  process.exit(snapshotId ? 0 : 1);
}
if (directoryIndex >= 0 && !suppliedDirectory)
  throw new Error("--dir requires a snapshot directory.");
const dir = suppliedDirectory
  ? resolve(suppliedDirectory)
  : join(root, "public", "research", "snapshots", snapshotId);
const manifest = await verifySnapshot(dir, `dugout-value-${snapshotId}`);
console.log(`Verified ${manifest.snapshotId}: ${manifest.files.length} files match SHA-256 manifest.`);
