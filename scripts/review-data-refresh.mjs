import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { reviewDataRefresh } from "../lib/data-refresh-review.mjs";
import { verifyRefreshEvidence } from "../lib/refresh-evidence.mjs";

if (!process.argv[2]) throw new Error("Usage: node scripts/review-data-refresh.mjs <candidate-directory>");
const directory = resolve(process.argv[2]);
const currentBytes = await readFile(new URL("../app/data/player-database.json", import.meta.url));
const candidateBytes = await readFile(join(directory, "player-database.json"));
const candidate = JSON.parse(candidateBytes);
const dispositions = [...(candidate.archivedPlayers ?? []), ...candidate.players.filter(player => player.refreshStatus === "retained-grade")].map(player => ({ id: player.id, ...player.disposition }));
if (dispositions.length) await verifyRefreshEvidence(join(directory, "reviewed-evidence"), [{ entries: dispositions }]);
const report = reviewDataRefresh(JSON.parse(currentBytes), candidate);
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
Object.assign(report, { reviewedAt: new Date().toISOString(), currentSha256: sha256(currentBytes), candidateSha256: sha256(candidateBytes) });
await writeFile(join(directory, "review.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ readyForPromotion: report.readyForPromotion, blockers: report.blockers.length, warnings: report.warnings.length, report: join(directory, "review.json") }, null, 2));
if (!report.readyForPromotion) process.exitCode = 1;
