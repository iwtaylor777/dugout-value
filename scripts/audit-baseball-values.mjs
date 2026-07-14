import { readFile } from "node:fs/promises";
import {
  effectiveSeasons,
  initialSettings,
  isReliever,
  valuePlayer,
} from "../lib/value-model.mjs";

const database = JSON.parse(
  await readFile(new URL("../app/data/player-database.json", import.meta.url)),
);
const limitArg = process.argv.find((argument) => argument.startsWith("--limit="));
const limit = Number(limitArg?.split("=")[1] ?? 50);
const jsonOutput = process.argv.includes("--json");

const records = database.players
  .filter((player) => !player.custom)
  .map((player) => {
    const result = valuePlayer(player, initialSettings, database);
    const seasons =
      player.kind === "mlb" ? effectiveSeasons(player) : [];
    const firstPlayerDecision =
      player.kind === "mlb"
        ? seasons.find((season) =>
            ["playerOption", "mutualOption"].includes(
              season.contractType ?? season.salaryMode,
            ),
          )
        : null;
    const controlledSeasons =
      player.kind === "mlb"
        ? firstPlayerDecision
          ? seasons.filter(
              (season) => season.year < firstPlayerDecision.year,
            )
          : seasons
        : [];
    return {
      id: player.id,
      name: player.name,
      team: player.team,
      position: player.position,
      kind: player.kind,
      subtype:
        player.kind === "prospect"
          ? `${player.fv} FV ${player.prospectType}`
          : player.role === "two-way"
            ? "Two-way"
            : isReliever(player)
              ? "Reliever"
              : player.role === "starter"
                ? "Starter"
                : "Position",
      age: player.age,
      controlThrough:
        player.kind === "mlb" ? controlledSeasons.at(-1)?.year : null,
      contractSeasons: player.kind === "mlb" ? seasons.length : null,
      contractScenario:
        player.kind === "mlb" ? player.contractScenario?.selectedId ?? null : null,
      expectedIncentives:
        player.kind === "mlb"
          ? Number(
              seasons
                .reduce(
                  (sum, season) =>
                    sum + Number(season.expectedIncentives ?? 0),
                  0,
                )
                .toFixed(2),
            )
          : 0,
      horizonRisk: Number((result.horizonRisk ?? 0).toFixed(2)),
      value: Number(result.total.toFixed(2)),
      low: Number(result.low.toFixed(2)),
      high: Number(result.high.toFixed(2)),
    };
  })
  .sort((left, right) => right.value - left.value);

const report = {
  generatedFrom: database.meta.refreshed,
  settings: initialSettings,
  counts: {
    players: records.length,
    mlb: records.filter((player) => player.kind === "mlb").length,
    prospects: records.filter((player) => player.kind === "prospect").length,
    positive: records.filter((player) => player.value > 0).length,
    negative: records.filter((player) => player.value < 0).length,
  },
  bounds: {
    maximum: records[0],
    minimum: records.at(-1),
  },
  top: records.slice(0, limit),
  topMlb: records.filter((player) => player.kind === "mlb").slice(0, 25),
  topProspects: records
    .filter((player) => player.kind === "prospect")
    .slice(0, 25),
  topRelievers: records
    .filter((player) => player.subtype === "Reliever")
    .slice(0, 20),
  contractsWithExpectedIncentives: records
    .filter((player) => player.expectedIncentives > 0)
    .sort(
      (left, right) => right.expectedIncentives - left.expectedIncentives,
    ),
  conditionalContractPaths: records.filter(
    (player) => player.contractScenario,
  ),
};

if (jsonOutput) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log(
    `Snapshot ${report.generatedFrom} · ${report.counts.players} players · ${report.counts.positive} positive · ${report.counts.negative} negative`,
  );
  console.table(report.top);
  console.log("Top MLB players");
  console.table(report.topMlb);
  console.log("Top prospects");
  console.table(report.topProspects);
  console.log("Top relievers");
  console.table(report.topRelievers);
  console.log("Contracts with modeled playing-time incentives");
  console.table(report.contractsWithExpectedIncentives);
  console.log("Contracts with conditional paths");
  console.table(report.conditionalContractPaths);
  console.log("Bounds");
  console.table([report.bounds.maximum, report.bounds.minimum]);
}
