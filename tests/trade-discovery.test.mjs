import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  discoveryProjectionYear,
  findTradeTargets,
  generateOfferPackages,
  incumbentRestOfSeasonWar,
  playerFitsPosition,
  primaryPositionGroup,
  rankTeamNeeds,
  restOfSeasonWar,
  seasonToDateWar,
} from "../lib/trade-discovery.mjs";

const mlb = ({
  id,
  team,
  position,
  role = "position",
  ytd = 0,
  ros = 0,
  age = 27,
  salaryMode = "prearb",
  depthPosition,
}) => ({
  id,
  kind: "mlb",
  name: id,
  team,
  position,
  depthPosition,
  role,
  age,
  platformWar: ytd + ros,
  seasons: [{ year: 2026, war: ros, salaryMode }],
});

const prospect = (id, team) => ({
  id,
  kind: "prospect",
  name: id,
  team,
  position: "SS",
  age: 20,
});

test("the seller snapshot covers every MLB organization", async () => {
  const database = JSON.parse(
    await readFile(
      new URL("../app/data/player-database.json", import.meta.url),
      "utf8",
    ),
  );
  const playoffOdds = JSON.parse(
    await readFile(
      new URL("../app/data/playoff-odds.json", import.meta.url),
      "utf8",
    ),
  );

  assert.equal(Object.keys(playoffOdds.odds).length, 30);
  assert.ok(
    database.teams.every((team) => Number.isFinite(playoffOdds.odds[team.abbr])),
  );
});

test("the live depth-chart snapshot assigns every team-position bucket", async () => {
  const database = JSON.parse(
    await readFile(
      new URL("../app/data/player-database.json", import.meta.url),
      "utf8",
    ),
  );
  const majorLeaguers = database.players.filter(
    (player) => player.kind === "mlb",
  );
  const teamIds = new Set(database.teams.map((team) => team.abbr));

  assert.ok(majorLeaguers.every((player) => teamIds.has(player.team)));
  assert.ok(majorLeaguers.every((player) => player.depthPosition));
  assert.equal(new Set(majorLeaguers.map((player) => player.id)).size, majorLeaguers.length);

  for (const team of database.teams) {
    const needs = rankTeamNeeds(
      database.players,
      database.teams,
      team.abbr,
      database.meta.baseYear,
    );
    assert.ok(
      needs.every((need) => need.playerCount > 0),
      `${team.abbr} contains an empty Trade Finder position bucket`,
    );
  }
});

test("the Red Sox first-base bucket includes Willson Contreras", async () => {
  const database = JSON.parse(
    await readFile(
      new URL("../app/data/player-database.json", import.meta.url),
      "utf8",
    ),
  );
  const contreras = database.players.find(
    (player) => player.kind === "mlb" && player.name === "Willson Contreras",
  );
  const firstBase = rankTeamNeeds(
    database.players,
    database.teams,
    "BOS",
    database.meta.baseYear,
    { valuationView: "offseason" },
  ).find((need) => need.id === "1B");

  assert.equal(contreras?.team, "BOS");
  assert.equal(contreras?.position, "1B");
  assert.equal(contreras?.depthPosition, "1B");
  assert.ok(firstBase.seasonToDateWar > 2);
  assert.ok(firstBase.restOfSeasonWar > 1);
  assert.equal(firstBase.needLabel, "Relative strength");
});

test("separates season-to-date WAR from the explicit rest-of-season projection", () => {
  const player = mlb({
    id: "catcher",
    team: "AAA",
    position: "C/1B",
    ytd: 1.3,
    ros: 0.7,
  });
  assert.equal(seasonToDateWar(player, 2026), 1.3);
  assert.equal(restOfSeasonWar(player, 2026), 0.7);
  assert.equal(playerFitsPosition(player, "C"), true);
  assert.equal(playerFitsPosition(player, "1B"), true);
});

test("ranks a hole relative to other teams at the same position", () => {
  const players = [
    mlb({ id: "aaa-c", team: "AAA", position: "C", ytd: 2, ros: 1 }),
    mlb({ id: "bbb-c", team: "BBB", position: "C", ytd: 1, ros: 0.5 }),
    mlb({ id: "ccc-c", team: "CCC", position: "C", ytd: -0.5, ros: -0.2 }),
  ];
  const needs = rankTeamNeeds(players, ["AAA", "BBB", "CCC"], "CCC", 2026);

  assert.equal(needs[0].id, "C");
  assert.equal(needs[0].seasonToDateRank, 3);
  assert.equal(needs[0].restOfSeasonRank, 3);
  assert.equal(needs[0].needLabel, "Clear need");
});

test("current depth assignment outranks a stale projection position", () => {
  const convertedFirstBaseman = mlb({
    id: "converted-first-baseman",
    team: "BOS",
    position: "C",
    depthPosition: "1B",
    ytd: 2.8,
    ros: 1.1,
  });

  assert.equal(playerFitsPosition(convertedFirstBaseman, "C"), true);
  assert.equal(primaryPositionGroup(convertedFirstBaseman), "1B");
  const needs = rankTeamNeeds(
    [
      convertedFirstBaseman,
      mlb({ id: "other-1b", team: "NYY", position: "1B", ytd: 1, ros: 0.5 }),
    ],
    ["BOS", "NYY"],
    "BOS",
    2026,
  );
  const firstBase = needs.find((need) => need.id === "1B");

  assert.equal(firstBase.seasonToDateWar, 2.8);
  assert.equal(firstBase.restOfSeasonWar, 1.1);
});

test("incumbent value uses the assigned position instead of double-counting utility players", () => {
  const players = [
    mlb({
      id: "utility-starter",
      team: "BUY",
      position: "1B/2B",
      depthPosition: "2B",
      ros: 1.2,
    }),
    mlb({
      id: "assigned-first-baseman",
      team: "BUY",
      position: "1B",
      depthPosition: "1B",
      ros: 0.3,
    }),
  ];

  assert.equal(incumbentRestOfSeasonWar(players, "BUY", "1B", 2026), 0.3);
  assert.equal(incumbentRestOfSeasonWar(players, "BUY", "2B", 2026), 1.2);
});

test("targets upgrades from low-odds clubs and excludes contenders", () => {
  const players = [
    mlb({ id: "buyer-c", team: "BUY", position: "C", ros: 0.2 }),
    mlb({ id: "seller-c", team: "SELL", position: "C", ros: 1.1 }),
    mlb({ id: "contender-c", team: "WIN", position: "C", ros: 2 }),
    mlb({ id: "seller-backup", team: "SELL", position: "C", ros: 0.1 }),
  ];
  const targets = findTradeTargets({
    players,
    values: {
      "seller-c": { total: 12 },
      "contender-c": { total: 30 },
      "seller-backup": { total: 2 },
    },
    buyerTeam: "BUY",
    position: "C",
    playoffOdds: { SELL: 10, WIN: 80 },
    sellerThreshold: 35,
    baseYear: 2026,
  });

  assert.deepEqual(targets.map((target) => target.id), ["seller-c"]);
  assert.equal(targets[0].improvement, 0.9);
});

test("deadline fit can rank a rental ahead of a less plausible young core target", () => {
  const buyer = mlb({ id: "buyer-3b", team: "BUY", position: "3B", ros: 0.1 });
  const rental = mlb({
    id: "rental",
    team: "SELL",
    position: "3B",
    ros: 0.9,
    age: 31,
  });
  const core = mlb({
    id: "core",
    team: "SELL",
    position: "3B",
    ros: 1.1,
    age: 22,
  });
  core.seasons = Array.from({ length: 6 }, (_, index) => ({
    year: 2026 + index,
    war: index ? 2 : 1.1,
    salaryMode: "prearb",
  }));
  const targets = findTradeTargets({
    players: [buyer, rental, core],
    values: { rental: { total: 12 }, core: { total: 90 } },
    buyerTeam: "BUY",
    position: "3B",
    playoffOdds: { SELL: 10 },
    sellerThreshold: 35,
    baseYear: 2026,
  });

  assert.equal(targets[0].id, "rental");
  assert.equal(targets[0].deadlineLabel, "Rental");
  assert.equal(targets[1].deadlineLabel, "Long-term control");
});

test("builds value-matched offer concepts from the buyer's assets", () => {
  const players = [
    prospect("p5", "BUY"),
    prospect("p3", "BUY"),
    prospect("p2", "BUY"),
    mlb({ id: "buyer-c", team: "BUY", position: "C", ros: 0.4 }),
  ];
  const values = {
    p5: { total: 5 },
    p3: { total: 3 },
    p2: { total: 2 },
    "buyer-c": { total: 8 },
  };
  const offers = generateOfferPackages({
    players,
    values,
    buyerTeam: "BUY",
    holePosition: "C",
    targetValue: 10,
    baseYear: 2026,
  });

  assert.ok(offers.length >= 1);
  assert.ok(offers.some((offer) => offer.total === 10));
  assert.ok(offers.every((offer) => !offer.assetIds.includes("buyer-c")));
  assert.ok(
    offers.every(
      (offer) => Math.abs(offer.gap) / 10 <= 0.3 || offer.salaryRelief,
    ),
  );
});

const withSeasons = (player, seasons) => ({ ...player, seasons });

test("finder keeps exact surplus through target and offer handoffs, avoiding double rounding", () => {
  const exact = 118.649;
  const buyer = mlb({ id: "buyer-c", team: "BUY", position: "C", ros: 0.2 });
  const target = mlb({ id: "seller-c", team: "SELL", position: "C", ros: 2 });
  const targets = findTradeTargets({ players: [buyer, target], values: { "seller-c": { total: exact } }, buyerTeam: "BUY", position: "C", playoffOdds: { SELL: 10 }, sellerThreshold: 35, baseYear: 2026 });
  assert.equal(targets[0].tradeValue, exact);
  assert.equal(targets[0].tradeValue.toFixed(1), "118.6");
  assert.equal(Number(exact.toFixed(2)).toFixed(1), "118.7", "old double-rounding path reproduces the reported mismatch");
  const asset = prospect("asset", "BUY");
  const offers = generateOfferPackages({ players: [asset], values: { asset: { total: exact } }, buyerTeam: "BUY", holePosition: "C", targetValue: exact, baseYear: 2026 });
  assert.ok(offers.length);
  assert.equal(offers[0].total, exact);
  assert.equal(offers[0].gap, 0);
});

test("offseason view drops pending free agents and compares next-season WAR", () => {
  const players = [
    withSeasons(mlb({ id: "buyer-c", team: "BUY", position: "C" }), [
      { year: 2026, war: 1.5, salaryMode: "prearb" },
      { year: 2027, war: 0.2, salaryMode: "prearb" },
    ]),
    // Great rest-of-2026, but no control after the season.
    withSeasons(mlb({ id: "rental-c", team: "SELL", position: "C" }), [
      { year: 2026, war: 2, salaryMode: "fixed" },
    ]),
    withSeasons(mlb({ id: "controlled-c", team: "SELL", position: "C" }), [
      { year: 2026, war: 0.4, salaryMode: "prearb" },
      { year: 2027, war: 2.4, salaryMode: "arb1" },
      { year: 2028, war: 2.2, salaryMode: "arb2" },
    ]),
  ];
  const args = {
    players,
    values: {
      "rental-c": { total: 0, pendingFreeAgent: true },
      "controlled-c": { total: 20, pendingFreeAgent: false },
    },
    buyerTeam: "BUY",
    position: "C",
    playoffOdds: { SELL: 10 },
    baseYear: 2026,
  };

  assert.equal(discoveryProjectionYear(2026, "offseason"), 2027);
  assert.equal(discoveryProjectionYear(2026, "deadline"), 2026);

  const deadline = findTradeTargets(args);
  assert.deepEqual(deadline.map((target) => target.id), ["rental-c"]);

  const offseason = findTradeTargets({ ...args, valuationView: "offseason" });
  assert.deepEqual(offseason.map((target) => target.id), ["controlled-c"]);
  assert.equal(offseason[0].improvement, 2.2);
  assert.equal(offseason[0].projectionYear, 2027);
  assert.equal(offseason[0].controlYears, 2);
  const allTeams = findTradeTargets({ ...args, playoffOdds: { SELL: 100 }, sellerThreshold: 0, valuationView: "offseason" });
  assert.deepEqual(allTeams.map(target => target.id), ["controlled-c"]);
});

test("offseason view falls back to the seasons themselves when no value is supplied", () => {
  const players = [
    withSeasons(mlb({ id: "buyer-c", team: "BUY", position: "C" }), [
      { year: 2026, war: 0, salaryMode: "prearb" },
    ]),
    withSeasons(mlb({ id: "rental-c", team: "SELL", position: "C" }), [
      { year: 2026, war: 2, salaryMode: "fixed" },
    ]),
  ];
  const targets = findTradeTargets({
    players,
    values: {},
    buyerTeam: "BUY",
    position: "C",
    playoffOdds: { SELL: 10 },
    baseYear: 2026,
    valuationView: "offseason",
  });
  assert.equal(targets.length, 0);
});

test("offseason team needs use next-season WAR and offer pools skip pending free agents", () => {
  const players = [
    withSeasons({ ...mlb({ id: "sp-expiring", team: "BUY", position: "SP", role: "starter" }), seasonToDateWar: 2 }, [
      { year: 2026, war: 1.5, salaryMode: "prearb" },
    ]),
    withSeasons(mlb({ id: "sp-signed", team: "NYY", position: "SP", role: "starter", ytd: 2 }), [
      { year: 2026, war: 1, salaryMode: "prearb" },
      { year: 2027, war: 3, salaryMode: "prearb" },
    ]),
  ];
  const need = (view) =>
    rankTeamNeeds(players, ["BUY", "NYY"], "BUY", 2026, { valuationView: view }).find(
      (candidate) => candidate.id === "SP",
    );
  assert.equal(need("deadline").restOfSeasonWar, 1.5);
  assert.equal(need("offseason").restOfSeasonWar, 0);
  assert.equal(need("offseason").seasonToDateWar, 2);

  const pool = [
    withSeasons(mlb({ id: "expiring-ss", team: "BUY", position: "SS", age: 25 }), [
      { year: 2026, war: 1, salaryMode: "prearb" },
    ]),
    withSeasons(mlb({ id: "signed-ss", team: "BUY", position: "SS", age: 25 }), [
      { year: 2026, war: 1, salaryMode: "prearb" },
      { year: 2027, war: 2, salaryMode: "prearb" },
    ]),
  ];
  const values = {
    "expiring-ss": { total: 10, pendingFreeAgent: true },
    "signed-ss": { total: 10, pendingFreeAgent: false },
  };
  const ids = (view) =>
    generateOfferPackages({
      players: pool,
      values,
      buyerTeam: "BUY",
      holePosition: "C",
      targetValue: 10,
      baseYear: 2026,
      valuationView: view,
    }).flatMap((offer) => offer.assetIds);
  assert.ok(ids("deadline").includes("expiring-ss"));
  assert.ok(!ids("offseason").includes("expiring-ss"));
  assert.ok(ids("offseason").includes("signed-ss"));
});
