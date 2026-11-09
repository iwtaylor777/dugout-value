#!/usr/bin/env node
// Records the evidence each graduate has produced since his last FanGraphs
// prospect grade (see lib/prospect-evidence.mjs for what counts). For every MLB
// player with a lastProspect grade it reads MLB Stats API year-by-year lines,
// writes data/prospect-evidence.json, and attaches `lastProspect.evidence` in
// app/data/player-database.json. The data refresh reapplies the stored file,
// so rerun this after each refresh.
//
// Usage: node scripts/build-prospect-evidence.mjs [--database path] [--out path]
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  EVIDENCE_LEVELS,
  applyProspectEvidence,
  evidenceFromStats,
} from "../lib/prospect-evidence.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const databasePath = option(
  "--database",
  new URL("../app/data/player-database.json", import.meta.url).pathname,
);
const evidencePath = option(
  "--out",
  new URL("../data/prospect-evidence.json", import.meta.url).pathname,
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const statsUrl = (mlbamId) =>
  `https://statsapi.mlb.com/api/v1/people/${mlbamId}/stats?stats=yearByYear&group=hitting,pitching&leagueListId=mlb_milb`;

async function main() {
  const database = JSON.parse(await readFile(databasePath, "utf8"));
  const throughSeason = Number(database.meta.baseYear);
  const capturedAt = new Date().toISOString();
  const players = {};
  const graduates = database.players.filter(
    (player) => player.kind === "mlb" && player.lastProspect && player.mlbamId,
  );
  for (const [index, player] of graduates.entries()) {
    const url = statsUrl(player.mlbamId);
    let response;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { "user-agent": "DugoutValueProspectEvidence/1.0" },
      });
      if (response.ok) break;
      await sleep(2000 * (attempt + 1));
    }
    if (!response.ok) throw new Error(`${response.status}: ${url}`);
    const text = await response.text();
    const fromSeason = Number(player.lastProspect.year);
    players[player.id] = {
      name: player.name,
      gradeYear: fromSeason,
      fromSeason,
      throughSeason,
      ...evidenceFromStats(JSON.parse(text), fromSeason, throughSeason),
      sourceSha256: createHash("sha256").update(text).digest("hex"),
    };
    if ((index + 1) % 25 === 0) console.log(`${index + 1}/${graduates.length}`);
    await sleep(250);
  }
  const evidence = {
    meta: {
      built: capturedAt,
      source: "MLB Stats API yearByYear (leagueListId=mlb_milb)",
      sourceUrlPattern: statsUrl("{mlbamId}"),
      levels: [...EVIDENCE_LEVELS],
      throughSeason,
      databaseRefreshed: database.meta.refreshed,
      players: Object.keys(players).length,
    },
    players,
  };
  await writeFile(evidencePath, JSON.stringify(evidence, null, 1) + "\n");
  applyProspectEvidence(database, evidence);
  await writeFile(databasePath, JSON.stringify(database) + "\n");
  console.log(`Wrote evidence for ${Object.keys(players).length} graduates.`);
}

await main();
