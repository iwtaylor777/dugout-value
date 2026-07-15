import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeProspectRisk,
  prospectRosterContext,
} from "../lib/prospect-context.mjs";
import {
  tradeProtectionForPlayer,
  tradeProtectionFromNote,
} from "../lib/contract-context.mjs";
import {
  effectiveSeasons,
  estimateFirstArbitrationSalary,
  initialSettings,
  isReliever,
  marketValueForSeason,
  valuePlayer,
} from "../lib/value-model.mjs";

test("first-year arbitration follows role-specific counting stats", () => {
  const hitter = { position: "OF", role: "position" };
  const lowVolume = estimateFirstArbitrationSalary(hitter, {
    pa: 250,
    hr: 8,
    rbi: 35,
    sb: 4,
    avg: 0.25,
    war: 2,
  });
  const everydayPower = estimateFirstArbitrationSalary(hitter, {
    pa: 650,
    hr: 30,
    rbi: 95,
    sb: 4,
    avg: 0.25,
    war: 2,
  });
  assert.ok(everydayPower > lowVolume + 2);

  const reliever = { position: "P", role: "reliever" };
  const setup = estimateFirstArbitrationSalary(reliever, {
    ip: 65,
    g: 65,
    sv: 0,
    hld: 20,
    era: 3,
    so: 75,
  });
  const closer = estimateFirstArbitrationSalary(reliever, {
    ip: 65,
    g: 65,
    sv: 35,
    hld: 0,
    era: 3,
    so: 75,
  });
  assert.ok(closer > setup + 1);
});

test("first-year arbitration has a restrained WAR fallback", () => {
  const starter = { position: "P", role: "starter" };
  assert.ok(estimateFirstArbitrationSalary(starter, { war: 5 }) < 10);
  assert.ok(estimateFirstArbitrationSalary(starter, { war: 5 }) > 7);
  assert.ok(
    estimateFirstArbitrationSalary(starter, { war: 0 }) >= 0.8,
  );
});

const database = JSON.parse(
  await readFile(new URL("../app/data/player-database.json", import.meta.url)),
);

const identity = (player) =>
  `${player.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()}::${player.team}`;

test("contract notes distinguish full, partial, and absent trade protection", () => {
  assert.equal(
    tradeProtectionFromNote("Deal includes a full no-trade clause."),
    "full",
  );
  assert.equal(tradeProtectionFromNote("Full NTC"), "full");
  assert.equal(
    tradeProtectionFromNote("Player receives a 10-team no-trade list."),
    "partial",
  );
  assert.equal(
    tradeProtectionFromNote("The extension has no no-trade clause."),
    "none",
  );
  assert.equal(tradeProtectionForPlayer("663728", ""), "full");
  assert.equal(tradeProtectionForPlayer("596019", ""), "partial");
  assert.equal(
    tradeProtectionForPlayer("unknown", "Full no-trade clause"),
    "full",
  );
});

test("trade consent is surfaced separately from economic value", () => {
  const player = {
    id: "test-trade-protection",
    kind: "mlb",
    name: "Protected Player",
    team: "SEA",
    position: "SS",
    role: "position",
    risk: 0,
    seasons: [
      { year: 2027, war: 3, salary: 10, salaryMode: "fixed" },
    ],
  };
  const unprotected = valuePlayer(player, initialSettings, database);
  const protectedValue = valuePlayer(
    { ...player, tradeProtection: "full" },
    initialSettings,
    database,
  );

  assert.equal(protectedValue.total, unprotected.total);
});

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

test("prospect scouting risk widens the range without moving the median", () => {
  const baseProspect = {
    id: "test-prospect-risk",
    kind: "prospect",
    name: "Range Prospect",
    team: "SEA",
    position: "SS",
    prospectType: "Hitter",
    fv: "50",
    eta: database.meta.baseYear + 2,
    adjustment: 0,
    rosterContext: "none",
  };
  const lowRisk = valuePlayer(
    { ...baseProspect, riskLabel: "Low" },
    initialSettings,
    database,
  );
  const highRisk = valuePlayer(
    { ...baseProspect, riskLabel: "High" },
    initialSettings,
    database,
  );

  assert.equal(lowRisk.total, highRisk.total);
  assert.ok(highRisk.low < lowRisk.low);
  assert.ok(highRisk.high > lowRisk.high);
  assert.ok(highRisk.rangeUncertainty > lowRisk.rangeUncertainty);
});

test("prospect roster context follows option status and Rule 5 timing", () => {
  const baseYear = 2026;
  assert.equal(normalizeProspectRisk("high"), "High");
  assert.equal(normalizeProspectRisk("Short"), "Med");
  assert.equal(
    prospectRosterContext(
      { options: "3", cETA: 2028, Age: 22 },
      baseYear,
    ),
    "on40",
  );
  assert.equal(
    prospectRosterContext(
      {
        options: "",
        cETA: 2027,
        Age: 21,
        Signed_Yr: 2023,
        Signed_Mkt: "Draft",
        BirthDate: 38342,
      },
      baseYear,
    ),
    "none",
  );
  assert.equal(
    prospectRosterContext(
      {
        options: "",
        cETA: 2027,
        Age: 21,
        Signed_Yr: 2022,
        Signed_Mkt: "Intl15",
        BirthDate: 38500,
      },
      baseYear,
    ),
    "rule5",
  );
  assert.equal(
    prospectRosterContext(
      {
        options: "",
        cETA: 2028,
        Age: 24,
        Signed_Yr: 2022,
        Signed_Mkt: "Draft",
        BirthDate: 37300,
      },
      baseYear,
    ),
    "crunch",
  );
});

test("the live snapshot clears identity, reliever, opt-out, and arb checks", () => {
  const identities = database.players.map(identity);
  assert.equal(new Set(identities).size, identities.length);

  const relievers = database.players.filter(
    (player) => player.kind === "mlb" && isReliever(player),
  );
  assert.ok(relievers.length > 100);

  const prospects = database.players.filter(
    (player) => player.kind === "prospect",
  );
  assert.ok(
    prospects.every((player) =>
      ["Low", "Med", "High"].includes(player.riskLabel),
    ),
  );
  assert.ok(
    prospects.filter((player) => player.rosterContext === "rule5").length >
      100,
  );
  assert.ok(
    prospects.filter((player) => player.rosterContext === "on40").length > 20,
  );
  assert.ok(
    prospects.filter((player) => player.rosterContext === "crunch").length >
      100,
  );

  const mlbPlayers = database.players.filter(
    (player) => player.kind === "mlb",
  );
  assert.equal(
    mlbPlayers.find((player) => player.name === "Stephen Strasburg"),
    undefined,
  );
  assert.ok(
    mlbPlayers.every(
      (player) => !player.source.projection.includes("Marcel + aging"),
    ),
  );
  const protectedPlayers = mlbPlayers.filter(
    (player) => player.tradeProtection !== "none",
  );
  assert.ok(protectedPlayers.length > 40);
  assert.ok(
    [
      "Shohei Ohtani",
      "Manny Machado",
      "Bobby Witt Jr.",
      "Julio Rodríguez",
      "Cal Raleigh",
      "José Ramírez",
      "Mookie Betts",
    ].every(
      (name) =>
        protectedPlayers.find((player) => player.name === name)
          ?.tradeProtection === "full",
    ),
  );
  assert.equal(
    protectedPlayers.find((player) => player.name === "Francisco Lindor")
      ?.tradeProtection,
    "partial",
  );
  assert.ok(
    protectedPlayers.filter((player) => player.tradeProtection === "partial")
      .length >= 3,
  );
  assert.ok(
    mlbPlayers.every((player) =>
      player.seasons.some(
        (season) =>
          season.year === database.meta.baseYear && season.ros === true,
      ),
    ),
  );
  assert.ok(
    mlbPlayers.every((player) => {
      const years = effectiveSeasons(player).map((season) => season.year);
      return new Set(years).size === years.length;
    }),
  );

  const pca = mlbPlayers.find(
    (player) => player.name === "Pete Crow-Armstrong",
  );
  const pcaCurrent = pca?.seasons.find(
    (season) => season.year === database.meta.baseYear,
  );
  const pcaExtension = pca?.seasons.find(
    (season) => season.year === database.meta.baseYear + 1,
  );
  assert.ok(pcaCurrent?.salaryMode === "fixed");
  assert.equal(pcaCurrent?.contractType, "prearb");
  assert.ok((pcaCurrent?.war ?? 99) < (pcaExtension?.war ?? 0));
  assert.ok((pcaCurrent?.annualSalary ?? 99) < (pcaExtension?.salary ?? 0));

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

  const firstArbitrationSeasons = mlbPlayers.flatMap((player) => {
    const seasons = effectiveSeasons(player);
    return seasons
      .map((season, index) => ({ season, prior: seasons[index - 1] }))
      .filter(({ season }) => season.salaryMode === "arb1");
  });
  assert.ok(firstArbitrationSeasons.length > 250);
  assert.ok(
    firstArbitrationSeasons.every(({ prior }) => prior?.arbMetrics),
  );

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

test("mutually exclusive contract paths stay separate and conservative", () => {
  const julio = database.players.find(
    (player) => player.name === "Julio Rodríguez" && player.kind === "mlb",
  );
  assert.ok(julio?.contractScenario);
  assert.equal(julio.contractScenario.selectedId, "fallback");
  assert.deepEqual(
    julio.contractScenario.options.map((option) => option.id),
    ["fallback", "club", "mutual"],
  );
  assert.equal(effectiveSeasons(julio).at(-1)?.year, 2034);
  const fallbackValue = valuePlayer(julio, initialSettings, database).total;
  assert.ok(fallbackValue > 150 && fallbackValue < 230);

  const clubScenario = structuredClone(julio);
  clubScenario.contractScenario.selectedId = "club";
  assert.equal(effectiveSeasons(clubScenario).at(-1)?.year, 2037);
  assert.ok(
    valuePlayer(clubScenario, initialSettings, database).total >
      fallbackValue + 100,
  );

  const mutual = julio.contractScenario.options.find(
    (option) => option.id === "mutual",
  );
  assert.match(mutual?.description ?? "", /both the player and club/i);
});

test("injury-only club options are excluded from the healthy default", () => {
  const diaz = database.players.find(
    (player) => player.name === "Edwin Díaz" && player.kind === "mlb",
  );
  assert.ok(diaz?.contractScenario);
  assert.equal(diaz.contractScenario.selectedId, "unavailable");
  assert.equal(effectiveSeasons(diaz).at(-1)?.year, 2028);

  const conditionMet = structuredClone(diaz);
  conditionMet.contractScenario.selectedId = "condition-met";
  assert.equal(effectiveSeasons(conditionMet).at(-1)?.year, 2029);
  assert.equal(
    effectiveSeasons(conditionMet).at(-1)?.contractType,
    "clubOption",
  );
});
