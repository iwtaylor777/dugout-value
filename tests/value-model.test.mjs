import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  initialSettings,
  isReliever,
  marketValueForSeason,
  valuePlayer,
} from "../lib/value-model.mjs";

const database = JSON.parse(
  await readFile(new URL("../app/data/player-database.json", import.meta.url)),
);

const identity = (player) =>
  `${player.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()}::${player.team}`;

test("role-aware roster burden gives relievers the intended baseline", () => {
  const season = { year: 2027, war: 1, ros: false };
  const reliever = { position: "P", role: "reliever" };
  const starter = { position: "P", role: "starter" };
  const neutralSettings = {
    ...initialSettings,
    inflation: 0,
    starPremium: 0,
  };

  assert.equal(isReliever(reliever), true);
  assert.equal(isReliever(starter), false);
  assert.equal(
    marketValueForSeason(reliever, season, neutralSettings, database),
    9.600000000000001,
  );
  assert.equal(
    marketValueForSeason(starter, season, neutralSettings, database),
    6,
  );
});

test("player options preserve downside but do not invent club upside", () => {
  const player = {
    id: "test-option",
    kind: "mlb",
    name: "Option Player",
    team: "SEA",
    position: "SS",
    role: "position",
    risk: 0,
    seasons: [
      {
        year: 2027,
        war: 4,
        salary: 20,
        annualSalary: 20,
        salaryMode: "fixed",
        contractType: "playerOption",
      },
      {
        year: 2028,
        war: 0,
        salary: 20,
        annualSalary: 20,
        salaryMode: "fixed",
        contractType: "playerOption",
      },
    ],
  };
  const result = valuePlayer(
    player,
    { ...initialSettings, inflation: 0, starPremium: 0 },
    database,
  );

  assert.equal(result.rows[0].surplus, 0);
  assert.equal(result.rows[1].surplus, -20);
  assert.equal(result.total, -20);
});

test("the live snapshot clears identity, reliever, opt-out, and arb checks", () => {
  const identities = database.players.map(identity);
  assert.equal(new Set(identities).size, identities.length);

  const relievers = database.players.filter(
    (player) => player.kind === "mlb" && isReliever(player),
  );
  assert.ok(relievers.length > 100);

  const bobby = database.players.find(
    (player) => player.name === "Bobby Witt Jr." && player.kind === "mlb",
  );
  assert.ok(bobby);
  assert.ok(
    bobby.seasons
      .filter((season) => season.year > 2030)
      .every((season) => season.contractType === "playerOption"),
  );
  const bobbyValue = valuePlayer(bobby, initialSettings, database).total;
  assert.ok(bobbyValue > 150 && bobbyValue < 300);

  const mason = database.players.find(
    (player) => player.name === "Mason Miller" && player.kind === "mlb",
  );
  assert.equal(mason?.role, "reliever");
  assert.ok(valuePlayer(mason, initialSettings, database).total > 25);

  const duran = database.players.find(
    (player) => player.name === "Jarren Duran" && player.kind === "mlb",
  );
  const duranRows = valuePlayer(duran, initialSettings, database).rows;
  assert.ok(duranRows.find((row) => row.year === 2027).salary < 15);

  const merrill = database.players.find(
    (player) => player.name === "Jackson Merrill" && player.kind === "mlb",
  );
  const merrillExpectedIncentives = merrill.seasons.reduce(
    (sum, season) => sum + (season.expectedIncentives ?? 0),
    0,
  );
  const merrillValue = valuePlayer(merrill, initialSettings, database);
  assert.ok(
    merrillExpectedIncentives > 20 && merrillExpectedIncentives < 30,
  );
  assert.ok(
    merrillValue.rows.reduce((sum, row) => sum + row.salary, 0) > 180,
  );
  assert.ok(merrillValue.horizonRisk > 5);

  const chourio = database.players.find(
    (player) => player.name === "Jackson Chourio" && player.kind === "mlb",
  );
  assert.equal(
    chourio.seasons.reduce(
      (sum, season) => sum + (season.expectedIncentives ?? 0),
      0,
    ),
    0,
  );
});
