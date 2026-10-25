import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sha256 = (contents) => createHash("sha256").update(contents).digest("hex");
const isSafePath = (value) =>
  typeof value === "string" && value.length > 0 && !value.startsWith("/") && !value.split("/").includes("..");

export async function verifySnapshot(directory, expectedSnapshotId) {
  const dir = resolve(directory);
  const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.captureDate)) throw new Error("Manifest has an invalid capture date.");
  if (manifest.snapshotId !== `dugout-value-${manifest.captureDate}`) throw new Error("Manifest snapshot ID does not match its capture date.");
  if (expectedSnapshotId && manifest.snapshotId !== expectedSnapshotId) throw new Error(`Expected ${expectedSnapshotId}, found ${manifest.snapshotId}.`);
  if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(manifest.modelVersion)) throw new Error("Manifest is missing a versioned model identifier.");
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) throw new Error("Manifest has no files to verify.");
  for (const entry of manifest.files) {
    if (!isSafePath(entry.path)) throw new Error(`Unsafe manifest path: ${entry.path}`);
    const path = join(dir, entry.path);
    const contents = await readFile(path);
    const actualHash = sha256(contents);
    const actualBytes = (await stat(path)).size;
    if (actualHash !== entry.sha256 || actualBytes !== entry.bytes) throw new Error(`Integrity check failed for ${entry.path}: expected ${entry.sha256}/${entry.bytes}, got ${actualHash}/${actualBytes}`);
  }
  const database = JSON.parse(await readFile(join(dir, "app/data/player-database.json"), "utf8"));
  const odds = JSON.parse(await readFile(join(dir, "app/data/playoff-odds.json"), "utf8"));
  if (database.meta?.refreshed !== manifest.sourceDataAsOf || odds.refreshed !== manifest.sourceDataAsOf) throw new Error(`Source-data date mismatch: manifest=${manifest.sourceDataAsOf}, player=${database.meta?.refreshed}, odds=${odds.refreshed}`);
  const tradeShareSource = await readFile(join(dir, "lib/trade-share.mjs"), "utf8");
  if (!tradeShareSource.includes(`TRADE_SHARE_MODEL_VERSION = "${manifest.modelVersion}"`)) throw new Error("Manifest model version does not match the bundled trade-share model.");
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await verifySnapshot(process.argv[2] ? resolve(process.argv[2]) : resolve("."));
  console.log(`Verified ${manifest.snapshotId}: ${manifest.files.length} files match SHA-256 manifest.`);
}
