import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";

export async function verifyRefreshEvidence(directory, registries, outputDirectory) {
  const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  const sources = new Map();
  for (const source of manifest.sources) {
    if (basename(source.file) !== source.file) throw new Error("Invalid evidence filename");
    const bytes = await readFile(join(directory, source.file));
    if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Evidence checksum mismatch: ${source.file}`);
    sources.set(source.sha256, { ...source, bytes });
  }
  for (const registry of registries) for (const entry of registry.entries) {
    const source = sources.get(entry.sourceSha256 ?? registry.sourceSha256);
    if (!source || source.url !== entry.sourceUrl) throw new Error(`Missing reviewed evidence: ${entry.id}`);
    if (entry.transactionId) {
      const transaction = JSON.parse(source.bytes).transactions?.find(row => row.id === entry.transactionId);
      const personId = entry.mlbamId ?? entry.id.replace(/^mlb-/, "");
      if (!transaction || String(transaction.person?.id) !== String(personId) || transaction.effectiveDate !== entry.effectiveDate || transaction.description !== entry.reason) throw new Error(`Transaction evidence mismatch: ${entry.id}`);
    } else if (!entry.sourceUrl.startsWith("https://www.mlb.com/") || !entry.reason) throw new Error(`Unsupported roster evidence: ${entry.id}`);
  }
  // Keep the reviewed bytes with every candidate; a tmp file must never be its
  // only evidence. These auxiliary sources have their own capture dates.
  if (outputDirectory) {
    const target = join(outputDirectory, "reviewed-evidence");
    await mkdir(target);
    for (const source of sources.values()) await writeFile(join(target, source.file), source.bytes, { flag: "wx" });
    await writeFile(join(target, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
  }
  return manifest;
}

export function reconcileMissingProspects(current, incoming, registry, snapshotDate) {
  const players = [...incoming];
  const archived = [];
  const ids = new Set(players.flatMap(player => [player.id, ...(player.previousIds ?? [])]));
  for (const prior of current.filter(player => player.kind === "prospect" && !ids.has(player.id))) {
    const entry = registry.entries.find(entry => entry.id === prior.id);
    if (!entry || snapshotDate > registry.validThrough || entry.effectiveDate > snapshotDate) continue;
    const disposition = { ...entry, validThrough: registry.validThrough, evidenceVerified: true };
    if (entry.action === "archive") archived.push({ ...structuredClone(prior), disposition });
    else if (entry.action === "retain-grade") players.push({
      ...structuredClone(prior), team: entry.team, mlbamId: entry.mlbamId,
      refreshStatus: "retained-grade", disposition,
      refreshNote: `Grade from ${prior.source.refreshed}; no grade in the ${snapshotDate} Board. Organization checked against MLB transactions.`,
      source: { ...prior.source, contract: `MLB roster checked ${snapshotDate}; prior scouting grade` },
    });
    else throw new Error(`Unknown prospect disposition: ${prior.id}`);
  }
  return { players, archived };
}
