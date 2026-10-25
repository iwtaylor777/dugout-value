import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TRADE_SHARE_MODEL_VERSION } from "../lib/trade-share.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotRoot = join(root, "public", "research", "snapshots");
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const localDate = (date) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const sha256 = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const run = (command, commandArgs, cwd) => new Promise((resolveRun, reject) => {
  const child = spawn(command, commandArgs, { cwd, stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", (code) => code === 0 ? resolveRun() : reject(new Error(`${command} exited with ${code}`)));
});

if (args.includes("--help")) {
  console.log("Usage: node scripts/create-research-snapshot.mjs [--date YYYY-MM-DD] [--captured-at ISO-8601]");
  process.exit(0);
}
const capturedAt = option("--captured-at") ?? new Date().toISOString();
if (Number.isNaN(Date.parse(capturedAt))) throw new Error("--captured-at must be an ISO-8601 timestamp.");
const captureDate = option("--date") ?? localDate(new Date(capturedAt));
if (!/^\d{4}-\d{2}-\d{2}$/.test(captureDate)) throw new Error("--date must be YYYY-MM-DD.");
const snapshotDir = join(snapshotRoot, captureDate);
const files = [
  ["app/data/player-database.json", "app/data/player-database.json"],
  ["app/data/playoff-odds.json", "app/data/playoff-odds.json"],
  ["app/trade-workspace.tsx", "app/trade-workspace.tsx"],
  ["lib/value-model.mjs", "lib/value-model.mjs"],
  ["lib/trade-package.mjs", "lib/trade-package.mjs"],
  ["lib/trade-share.mjs", "lib/trade-share.mjs"],
  ["lib/trade-discovery.mjs", "lib/trade-discovery.mjs"],
  ["scripts/snapshot-runtime/verify.mjs", "verify.mjs"],
  ["scripts/snapshot-runtime/replay.mjs", "replay.mjs"],
];

await mkdir(snapshotRoot, { recursive: true });
// mkdir without recursive is the atomic publication guard: an existing dated
// capture is never amended in place.
await mkdir(snapshotDir);
for (const [source, destination] of files) {
  const target = join(snapshotDir, destination);
  await mkdir(dirname(target), { recursive: true });
  await cp(join(root, source), target, { errorOnExist: true });
}
const database = JSON.parse(await readFile(join(snapshotDir, "app/data/player-database.json"), "utf8"));
const odds = JSON.parse(await readFile(join(snapshotDir, "app/data/playoff-odds.json"), "utf8"));
const sourceDataAsOf = database.meta?.refreshed;
if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDataAsOf) || odds.refreshed !== sourceDataAsOf) throw new Error(`Player and odds source dates must agree; found player=${sourceDataAsOf}, odds=${odds.refreshed}.`);
const readme = `# Dugout Value research snapshot\n\nThis bundle was captured at ${capturedAt}. Its public player and playoff-odds inputs are as of ${sourceDataAsOf}; those are separate dates.\n\nVerify before replaying any code:\n\n\`\`\`sh\nnode verify.mjs .\n\`\`\`\n\nReplay a known player ID after verification (for example, Juan Soto):\n\n\`\`\`sh\nnode replay.mjs mlb-665742\n\`\`\`\n\nThe manifest pins SHA-256 and byte size for every bundled input and records model version ${TRADE_SHARE_MODEL_VERSION}.\n`;
await writeFile(join(snapshotDir, "README.md"), readme);
const manifestFiles = [];
for (const [, destination] of [...files, ["README.md", "README.md"]]) {
  const path = join(snapshotDir, destination);
  manifestFiles.push({ path: destination, bytes: (await stat(path)).size, sha256: await sha256(path) });
}
const manifest = {
  schemaVersion: 1,
  snapshotId: `dugout-value-${captureDate}`,
  capturedAt,
  captureDate,
  sourceDataAsOf,
  modelVersion: TRADE_SHARE_MODEL_VERSION,
  purpose: "Immutable public-data valuation snapshot.",
  provenance: { playerData: database.meta.sources, projectionPriority: database.meta.projectionPriority, playoffOdds: { source: odds.source, sourceUrl: odds.sourceUrl, mode: odds.mode } },
  replay: { command: "node replay.mjs <player-id>", verifyCommand: "node verify.mjs .", defaultSettingsSource: "lib/value-model.mjs#initialSettings", workspaceDefaultsSource: "app/trade-workspace.tsx" },
  files: manifestFiles,
};
await writeFile(join(snapshotDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const archiveName = `dugout-value-${captureDate}.tar.gz`;
const archivePath = join(snapshotRoot, archiveName);
await run("tar", ["-czf", archivePath, captureDate], snapshotRoot);
await writeFile(`${archivePath}.sha256`, `${await sha256(archivePath)}  ${archiveName}\n`);
console.log(`Created ${relative(root, snapshotDir)} and ${relative(root, archivePath)}.`);
