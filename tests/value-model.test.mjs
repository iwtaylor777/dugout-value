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
  estimateArbitrationSalary,
  estimateFirstArbitrationSalary,
  initialSettings,
  isReliever,
  marketValueForSeason,
  postseasonRotationValueForSeason,
  prospectRankAdjustment,
  valuePlayer,
} from "../lib/value-model.mjs";

// The July 31 view keeps rest-of-2026 seasons in value; deadline tests use it.
const archivedDatabase = JSON.parse(await readFile(new URL("../public/research/snapshots/2026-10-17/app/data/player-database.json", import.meta.url)));
const deadlineView = { ...initialSettings, valuationView: "deadline" };
// The prices in force through model 2026-10-17.1. A few tests below assert fixed dollar
// thresholds that were set under them; they pin these prices so the assertions stay as strict
// as before instead of being loosened for the 2026-10-25.2 defaults.
const october17Prices = { dollarsPerWar: 12, starPremium: 30 };

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

test("later arbitration years blend class value with the prior salary path", () => {
  const hitter = { position: "OF", role: "position" };
  const metrics = {
    pa: 650,
    hr: 30,
    rbi: 95,
    sb: 15,
    avg: 0.28,
    war: 5,
  };
  const arb1 = estimateArbitrationSalary(hitter, "arb1", metrics);
  const arb2 = estimateArbitrationSalary(hitter, "arb2", metrics, arb1);
  const arb3 = estimateArbitrationSalary(hitter, "arb3", metrics, arb2);

  assert.ok(arb2 > arb1 * 1.25);
  assert.ok(arb3 > 15);
  assert.ok(arb3 <= 36);
});

test("a higher prior award raises every repeat-eligible estimate", () => {
  const hitter = { position: "SS", role: "position" };
  const metrics = {
    pa: 650,
    hr: 30,
    rbi: 85,
    sb: 20,
    avg: 0.255,
    war: 4,
  };
  const lowerPath = estimateArbitrationSalary(
    hitter,
    "arb2",
    metrics,
    4.15,
    1.03,
    1.03,
  );
  const higherPath = estimateArbitrationSalary(
    hitter,
    "arb2",
    metrics,
    6,
    1.03,
    1.03,
  );

  assert.ok(lowerPath > 8);
  assert.ok(higherPath > lowerPath + 1);
});

test("later arbitration can flatten after a down year instead of forcing a large raise", () => {
  const hitter = { position: "OF", role: "position" };
  const downYear = {
    pa: 550,
    hr: 10,
    rbi: 55,
    sb: 10,
    avg: 0.245,
    war: 1,
  };
  const salary = estimateArbitrationSalary(
    hitter,
    "arb3",
    downYear,
    8.4,
  );

  assert.ok(salary >= 6.72);
  assert.ok(salary < 13);
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

test("Wyatt Langford's projected arbitration ladder reflects star production", () => {
  const langford = database.players.find(
    (player) => player.name === "Wyatt Langford",
  );
  assert.ok(langford);
  const rows = valuePlayer(langford, initialSettings, database).rows.filter(
    (row) => row.year >= 2027,
  );
  assert.deepEqual(rows.map((row) => row.year), [2027, 2028, 2029]);
  assert.ok(rows[1].salary > rows[0].salary);
  assert.ok(rows[2].salary > 10);
});

test("Zach Neto's arbitration ladder carries his first award into later raises", () => {
  const neto = database.players.find((player) => player.name === "Zach Neto");
  assert.ok(neto);
  const rows = valuePlayer(neto, initialSettings, database).rows.filter(
    (row) => row.year >= 2027,
  );

  assert.equal(rows.length, 3);
  assert.ok(rows[0].salary >= 8);
  assert.ok(rows[1].salary >= 13);
  assert.ok(rows[2].salary >= 18);
  assert.ok(rows[2].salary > rows[1].salary + 4);
});

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
    12.600000000000001, // 0.8 net WAR x $10.5M x 1.5 (a 1.0-WAR reliever clears the 0.8 cutoff)
  );
  assert.equal(
    marketValueForSeason(starter, season, neutralSettings, database),
    5.25, // 0.5 net WAR x $10.5M
  );
});

test("the 2026-10-25.2 defaults price a win at $10.5M with a 10% star premium", () => {
  assert.equal(initialSettings.dollarsPerWar, 10.5);
  assert.equal(initialSettings.starPremium, 10);
  assert.equal(initialSettings.relieverPremium, 50);
  assert.equal(initialSettings.relieverPremiumMinWar, 0.8);
  // The methods page compares these two seasons with FanGraphs' graduated scale.
  const player = { position: "SS", role: "position" };
  const flat = { ...initialSettings, inflation: 0 };
  const price = (war) =>
    marketValueForSeason(player, { year: 2027, war, ros: false }, flat, database);
  assert.ok(Math.abs(price(4) - 38.325) < 1e-9);
  assert.ok(Math.abs(price(6) - 61.425) < 1e-9);
});

test("the reliever premium applies only above the projected-WAR cutoff", () => {
  const reliever = { position: "RP", role: "reliever" };
  const starter = { position: "SP", role: "starter" };
  const flat = { ...initialSettings, inflation: 0, starPremium: 0 };
  const value = (player, war, settings = flat) =>
    marketValueForSeason(player, { year: 2027, war, ros: false }, settings, database);
  const base = (war) => (war - initialSettings.relieverRosterWar) * initialSettings.dollarsPerWar;

  // Exactly at the cutoff there is no premium; just above it there is +50%.
  assert.ok(Math.abs(value(reliever, 0.8) - base(0.8)) < 1e-9);
  assert.ok(Math.abs(value(reliever, 0.9) - base(0.9) * 1.5) < 1e-9);
  // Starters never get it, however good.
  assert.ok(Math.abs(value(starter, 3) - (3 - initialSettings.regularRosterWar) * initialSettings.dollarsPerWar) < 1e-9);
  // The cutoff is editable, and a settings object that predates it means "every reliever".
  assert.ok(Math.abs(value(reliever, 0.5, { ...flat, relieverPremiumMinWar: 0.4 }) - base(0.5) * 1.5) < 1e-9);
  const legacy = { ...flat };
  delete legacy.relieverPremiumMinWar;
  assert.ok(Math.abs(value(reliever, 0.5, legacy) - base(0.5) * 1.5) < 1e-9);
  assert.ok(Math.abs(value(reliever, 0.5, { ...legacy, relieverPremium: 0 }) - base(0.5)) < 1e-9);
});

test("the star premium threshold is explicit and editable", () => {
  const season = { year: 2027, war: 4, ros: false };
  const player = { position: "SS", role: "position" };
  const earlierPremium = marketValueForSeason(
    player,
    season,
    { ...initialSettings, inflation: 0, starThreshold: 2 },
    database,
  );
  const laterPremium = marketValueForSeason(
    player,
    season,
    { ...initialSettings, inflation: 0, starThreshold: 3 },
    database,
  );

  assert.ok(Math.abs(earlierPremium - 38.325) < 1e-9);
  assert.ok(Math.abs(laterPremium - 37.275) < 1e-9);
  assert.ok(earlierPremium > laterPremium);
});

test("deadline boost applies only to rest-of-season field value", () => {
  const player = { position: "SS", role: "position" };
  const rosSeason = {
    year: database.meta.baseYear,
    war: 1.4,
    salary: 12.3,
    salaryMode: "fixed",
    ros: true,
  };
  const futureSeason = {
    year: database.meta.baseYear + 1,
    war: 2.1,
    salary: 20,
    salaryMode: "fixed",
    ros: false,
  };
  const baselineSettings = { ...initialSettings, deadlineBoost: 0 };
  const deadlineSettings = { ...initialSettings, deadlineBoost: 15 };

  const baselineRos = marketValueForSeason(
    player,
    rosSeason,
    baselineSettings,
    database,
  );
  const deadlineRos = marketValueForSeason(
    player,
    rosSeason,
    deadlineSettings,
    database,
  );
  assert.ok(Math.abs(deadlineRos - baselineRos * 1.15) < 1e-9);
  assert.equal(
    marketValueForSeason(player, futureSeason, deadlineSettings, database),
    marketValueForSeason(player, futureSeason, baselineSettings, database),
  );
});

test("October rotation value uses a two-WAR net fourth-starter benchmark", () => {
  const database = archivedDatabase;
  const share = database.meta.seasonRemainingFraction;
  const ace = { position: "SP", role: "starter" };
  const reliever = { position: "RP", role: "reliever" };
  const deadlineSettings = {
    ...initialSettings,
    deadlineBoost: 15,
    inflation: 0,
  };
  const aceSeason = {
    year: database.meta.baseYear,
    war: 5.8 * share,
    salary: 0,
    salaryMode: "fixed",
    ros: true,
  };
  const replacementSeason = {
    ...aceSeason,
    war: 2 * share,
  };
  const futureAceSeason = {
    ...aceSeason,
    year: database.meta.baseYear + 1,
    ros: false,
  };
  const expected = (5.8 - 2) * 0.25 * 10.5 * 1.1;

  assert.ok(
    Math.abs(
      postseasonRotationValueForSeason(
        ace,
        aceSeason,
        deadlineSettings,
        database,
      ) - expected,
    ) < 1e-9,
  );
  assert.equal(
    postseasonRotationValueForSeason(
      ace,
      replacementSeason,
      deadlineSettings,
      database,
    ),
    0,
  );
  assert.equal(
    postseasonRotationValueForSeason(
      reliever,
      aceSeason,
      deadlineSettings,
      database,
    ),
    0,
  );
  assert.equal(
    postseasonRotationValueForSeason(
      ace,
      futureAceSeason,
      deadlineSettings,
      database,
    ),
    0,
  );
});

test("Skubal's deadline value separates current-win and October premiums", () => {
  const database = archivedDatabase;
  const skubal = database.players.find(
    (player) => player.name === "Tarik Skubal",
  );
  assert.ok(skubal);
  const baseline = valuePlayer(
    skubal,
    { ...deadlineView, ...october17Prices, deadlineBoost: 0 },
    database,
  );
  const deadline = valuePlayer(
    skubal,
    { ...deadlineView, ...october17Prices, deadlineBoost: 15 },
    database,
  );

  assert.ok(baseline.total > 0);
  assert.ok(deadline.deadlineCurrentWinAdjustment > 0);
  assert.ok(deadline.octoberAdjustment > deadline.deadlineCurrentWinAdjustment);
  assert.ok(deadline.total > baseline.total + 20);
  assert.ok(
    Math.abs(
      deadline.deadlineAdjustment -
        deadline.deadlineCurrentWinAdjustment -
        deadline.octoberAdjustment,
    ) < 1e-9,
  );
});

test("deadline adjustment raises current MLB surplus without changing salary", () => {
  const player = {
    id: "test-deadline",
    kind: "mlb",
    name: "Deadline Player",
    team: "SEA",
    position: "SP",
    role: "starter",
    risk: 0,
    seasons: [
      {
        year: database.meta.baseYear,
        war: 1.4,
        salary: 12.3,
        salaryMode: "fixed",
        ros: true,
      },
      {
        year: database.meta.baseYear + 1,
        war: 2.1,
        salary: 20,
        salaryMode: "fixed",
        ros: false,
      },
    ],
  };
  const baseline = valuePlayer(
    player,
    { ...deadlineView, deadlineBoost: 0 },
    database,
  );
  const deadline = valuePlayer(
    player,
    { ...deadlineView, deadlineBoost: 15 },
    database,
  );

  assert.ok(deadline.total > baseline.total);
  assert.ok(
    Math.abs(deadline.deadlineAdjustment - (deadline.total - baseline.total)) <
      1e-9,
  );
  assert.equal(deadline.rows[0].salary, baseline.rows[0].salary);
  assert.equal(deadline.rows[1].market, baseline.rows[1].market);
  assert.equal(deadline.rows[1].deadlineAdjustment, 0);
});

test("deadline boost leaves prospect value unchanged", () => {
  const prospect = {
    id: "test-deadline-prospect",
    kind: "prospect",
    name: "Future Player",
    team: "SEA",
    position: "SS",
    prospectType: "Hitter",
    fv: "50",
    eta: database.meta.baseYear + 2,
    adjustment: 0,
    rosterContext: "none",
  };
  const baseline = valuePlayer(
    prospect,
    { ...initialSettings, deadlineBoost: 0 },
    database,
  );
  const deadline = valuePlayer(
    prospect,
    { ...initialSettings, deadlineBoost: 15 },
    database,
  );

  assert.equal(deadline.total, baseline.total);
  assert.equal(deadline.deadlineAdjustment, 0);
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
    { ...initialSettings, inflation: 0, starPremium: 0, timingPreference: 0 },
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

test("ordinal rank breaks FV ties without overruling the scouting tier", () => {
  const tier = database.players
    .filter(
      (player) =>
      player.kind === "prospect" &&
      player.fv === "50" &&
      player.prospectType === "Hitter" &&
      player.rosterContext === "none" &&
      Number.isFinite(player.rank),
    )
    .sort((left, right) => left.rank - right.rank);
  const topOfTier = tier[0];
  const bottomOfTier = tier.at(-1);
  assert.ok(topOfTier);
  assert.ok(bottomOfTier);
  assert.ok(topOfTier.rank < bottomOfTier.rank);

  const topValue = valuePlayer(topOfTier, initialSettings, database);
  const bottomValue = valuePlayer(bottomOfTier, initialSettings, database);
  assert.ok(topValue.total > bottomValue.total);
  assert.ok(topValue.total / bottomValue.total < 1.12);
  assert.ok(Math.abs(prospectRankAdjustment(topOfTier, database)) <= 0.05);
  assert.ok(Math.abs(prospectRankAdjustment(bottomOfTier, database)) <= 0.05);

  const unranked = { ...topOfTier, rank: null };
  assert.equal(prospectRankAdjustment(unranked, database), 0);
  assert.equal(
    valuePlayer(unranked, initialSettings, database).total,
    39.375, // the FV 50 hitter value of 45 scales with dollarsPerWar / 12
  );
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

test("the archived July snapshot clears identity, reliever, opt-out, and arb checks", () => {
  const database = archivedDatabase;
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
  const marcelFallbacks = mlbPlayers.filter((player) =>
    player.source.projection.includes("Marcel"),
  );
  assert.ok(marcelFallbacks.length <= 5);
  assert.ok(
    marcelFallbacks.every((player) =>
      player.source.projection.includes("Depth Charts RoS"),
    ),
  );
  const protectedPlayers = mlbPlayers.filter(
    (player) => player.tradeProtection !== "none",
  );
  const injuredPlayers = mlbPlayers.filter((player) => player.availability);
  assert.ok(injuredPlayers.length > 180);
  assert.ok(
    injuredPlayers.every(
      (player) =>
        player.availability.riskAdjustment > 0 &&
        player.availability.status !== "Activated",
    ),
  );
  assert.equal(
    injuredPlayers.find((player) => player.name === "Corbin Burnes")
      ?.availability?.status,
    "60-Day IL",
  );
  const injuredExample = injuredPlayers.find(
    (player) => player.name === "Corbin Burnes",
  );
  assert.ok(injuredExample?.availability);
  const injuredValue = valuePlayer(injuredExample, initialSettings, database);
  const sameProjectionWithoutHealthRisk = valuePlayer(
    {
      ...injuredExample,
      risk:
        injuredExample.risk - injuredExample.availability.riskAdjustment,
      availability: undefined,
    },
    initialSettings,
    database,
  );
  assert.equal(injuredValue.total, sameProjectionWithoutHealthRisk.total);
  assert.ok(
    injuredValue.high - injuredValue.low >
      sameProjectionWithoutHealthRisk.high -
        sameProjectionWithoutHealthRisk.low,
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
  const bobbyValue = valuePlayer(bobby, { ...initialSettings, ...october17Prices }, database).total;
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
  const october17 = { ...initialSettings, ...october17Prices };
  const fallbackValue = valuePlayer(julio, october17, database).total;
  assert.ok(fallbackValue > 100 && fallbackValue < 200);

  const clubScenario = structuredClone(julio);
  clubScenario.contractScenario.selectedId = "club";
  assert.equal(effectiveSeasons(clubScenario).at(-1)?.year, 2037);
  assert.ok(
    valuePlayer(clubScenario, october17, database).total >
      fallbackValue + 30,
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

const mlbPlayer = (overrides = {}) => ({
  id: "test-view",
  kind: "mlb",
  name: "View Player",
  team: "SEA",
  position: "SS",
  role: "position",
  risk: 0,
  seasons: [
    { year: 2026, war: 1, salary: 5, salaryMode: "fixed", ros: true },
    { year: 2027, war: 4, salary: 10, salaryMode: "fixed", ros: false },
    { year: 2028, war: 4, salary: 10, salaryMode: "fixed", ros: false },
  ],
  ...overrides,
});

test("defaults are a 10% discount in the offseason view", () => {
  assert.equal(initialSettings.timingPreference, 10);
  assert.equal(initialSettings.valuationView, "offseason");
});

test("the default discount applies 1/1.1^years to future surplus", () => {
  const player = mlbPlayer();
  const flat = valuePlayer(
    player,
    { ...initialSettings, timingPreference: 0 },
    database,
  );
  const discounted = valuePlayer(player, initialSettings, database);
  for (const [index, years] of [[1, 1], [2, 2]]) {
    assert.ok(
      Math.abs(
        discounted.rows[index].surplus -
          flat.rows[index].surplus / Math.pow(1.1, years),
      ) < 1e-9,
    );
  }
  assert.ok(discounted.total < flat.total);
});

test("the FanGraphs prospect table is not discounted twice", () => {
  const prospect = {
    id: "test-fv-discount",
    kind: "prospect",
    name: "Future Player",
    team: "SEA",
    position: "SS",
    prospectType: "Hitter",
    fv: "55",
    eta: database.meta.baseYear + 3,
    adjustment: 0,
    rosterContext: "none",
  };
  const valueAt = (timingPreference) =>
    valuePlayer(prospect, { ...initialSettings, timingPreference }, database)
      .total;
  assert.equal(valueAt(10), valueAt(0));
  assert.equal(valueAt(5), valueAt(10));
  assert.ok(
    Math.abs(valueAt(20) - valueAt(10) / Math.pow(1.1, 3)) < 1e-9,
  );
});

test("offseason view excludes rest-of-2026 seasons and the deadline view keeps them", () => {
  const player = mlbPlayer();
  const offseason = valuePlayer(player, initialSettings, database);
  const deadline = valuePlayer(player, deadlineView, database);

  assert.equal(offseason.valuationView, "offseason");
  assert.equal(deadline.valuationView, "deadline");
  assert.equal(offseason.rows.length, 3);
  assert.equal(offseason.rows[0].excluded, true);
  assert.equal(offseason.rows[0].surplus, 0);
  assert.equal(deadline.rows[0].excluded, false);
  assert.ok(deadline.rows[0].surplus !== 0);
  assert.ok(
    Math.abs(
      deadline.total - offseason.total - offseason.excludedRosValue,
    ) < 1e-9,
  );
  assert.equal(offseason.totalWar, 8);
  assert.equal(deadline.totalWar, 9);
  assert.equal(offseason.totalSalary, 20);
  assert.equal(deadline.totalSalary, 25);
});

test("a settings object with no valuationView behaves as the deadline view", () => {
  const { valuationView: _omitted, ...legacy } = initialSettings;
  const player = mlbPlayer();
  assert.equal(
    valuePlayer(player, legacy, database).total,
    valuePlayer(player, deadlineView, database).total,
  );
});

test("offseason view flags pending free agents and leaves the deadline view alone", () => {
  const rental = mlbPlayer({
    seasons: [
      { year: 2026, war: 2, salary: 4, salaryMode: "fixed", ros: true },
    ],
  });
  const offseason = valuePlayer(rental, initialSettings, database);
  assert.equal(offseason.pendingFreeAgent, true);
  assert.equal(offseason.total, 0);
  assert.equal(offseason.controlThrough, 2026);
  assert.equal(offseason.totalWar, 0);

  const deadline = valuePlayer(rental, deadlineView, database);
  assert.equal(deadline.pendingFreeAgent, false);
  assert.ok(deadline.total > 0);

  assert.equal(
    valuePlayer(mlbPlayer(), initialSettings, database).pendingFreeAgent,
    false,
  );
});

test("pending free agents in the live snapshot match players with no seasons after 2026", () => {
  const mlb = database.players.filter((player) => player.kind === "mlb");
  const expected = mlb.filter(
    (player) =>
      !effectiveSeasons(player).some(
        (season) => season.year > database.meta.baseYear,
      ),
  ).length;
  const flagged = mlb.filter(
    (player) =>
      valuePlayer(player, initialSettings, database).pendingFreeAgent,
  ).length;
  assert.equal(flagged, expected);
  assert.ok(flagged > 100);
  assert.equal(
    mlb.filter(
      (player) =>
        valuePlayer(player, deadlineView, database).pendingFreeAgent,
    ).length,
    0,
  );
});

test("driver fields describe control, WAR, salary, extrapolation and the FanGraphs rank", () => {
  const mcgonigle = database.players.find(
    (player) => player.name === "Kevin McGonigle",
  );
  const result = valuePlayer(mcgonigle, initialSettings, database);
  const anchor = mcgonigle.agingModel.anchorYear;

  assert.equal(result.controlThrough, 2034);
  assert.equal(result.fgTradeValueRank, mcgonigle.futureProjectionUpdate.rank);
  assert.equal(result.valuationBasis, "projection");
  assert.ok(
    result.rows.every((row) => row.extrapolated === row.year > anchor),
  );
  assert.ok(result.rows.some((row) => row.extrapolated));
  const fromRows = result.rows
    .filter((row) => row.extrapolated)
    .reduce((sum, row) => sum + row.surplus, 0);
  assert.ok(Math.abs(result.extrapolatedValue - fromRows) < 1e-9);
  assert.ok(
    Math.abs(result.extrapolatedShare - result.extrapolatedValue / result.total) <
      1e-12,
  );
  assert.ok(
    Math.abs(
      result.totalWar -
        result.rows.filter((row) => !row.excluded).reduce((s, r) => s + r.war, 0),
    ) < 1e-9,
  );
  assert.equal(
    valuePlayer(
      { ...mcgonigle, futureProjectionUpdate: undefined },
      initialSettings,
      database,
    ).fgTradeValueRank,
    null,
  );
});

test("rookie blends are labeled as blended with prospect grade", () => {
  const blended = database.players.find(
    (player) => player.kind === "mlb" && player.rookieMode === "blend",
  );
  const result = valuePlayer(blended, initialSettings, database);
  assert.equal(result.valuationBasis, "projection blended with prospect grade");
  assert.ok(result.prospectWeight > 0 && result.prospectWeight <= 0.8);
  const projectionOnly = valuePlayer(
    { ...blended, rookieMode: "projection" },
    initialSettings,
    database,
  );
  assert.equal(projectionOnly.valuationBasis, "projection");
  assert.equal(projectionOnly.prospectWeight, 0);
});

test("Soto's post-2029 opt-out is one all-or-nothing option", () => {
  const soto = database.players.find((player) => player.name === "Juan Soto");
  assert.ok(soto?.contractScenario);
  assert.equal(soto.contractScenario.selectedId, "option");
  assert.deepEqual(
    soto.contractScenario.options.map((option) => option.id),
    ["option", "walks", "stays", "voided"],
  );
  assert.equal(soto.seasons.at(-1).year, 2029);
  const withPath = (id, settings = initialSettings) => {
    const copy = structuredClone(soto);
    copy.contractScenario.selectedId = id;
    return valuePlayer(copy, settings, database);
  };
  const walks = withPath("walks");
  const stays = withPath("stays");
  const voided = withPath("voided");
  const option = withPath("option");

  assert.equal(walks.controlThrough, 2029);
  assert.equal(stays.controlThrough, 2039);
  // At $12M/WAR the ten years cost more than they return, so he stays and the
  // club carries them; the option value equals the guaranteed-years value.
  assert.ok(stays.total < walks.total);
  assert.ok(Math.abs(option.total - stays.total) < 1e-9);
  assert.ok(voided.total < stays.total);
  // At a higher WAR price the block is worth more than it costs and he opts out.
  const rich = { ...initialSettings, dollarsPerWar: 18 };
  const richOption = withPath("option", rich);
  assert.ok(Math.abs(richOption.total - withPath("walks", rich).total) < 1e-9);
  assert.ok(richOption.rows.filter((row) => row.optionBlock).every((row) => row.optedOut));
  assert.equal(richOption.controlThrough, 2029);
  assert.ok(withPath("stays", rich).total > richOption.total);
});

test("club control stops before player-option years; controlThrough keeps counting them", () => {
  const byName = (name) => database.players.find((player) => player.name === name);
  const julio = valuePlayer(byName("Julio Rodríguez"), initialSettings, database);
  assert.equal(julio.clubControlThrough, 2029);
  assert.equal(julio.controlThrough, 2034);
  assert.equal(julio.playerOptionThrough, 2034);
  // Club-control totals exclude the option years, so they are smaller.
  assert.ok(julio.clubControlWar < julio.totalWar);
  assert.ok(julio.clubControlSalary < julio.totalSalary);
  const clubRows = julio.rows.filter(
    (row) => !row.excluded && !row.optedOut && row.year <= 2029,
  );
  assert.ok(
    Math.abs(julio.clubControlWar - clubRows.reduce((s, r) => s + r.war, 0)) < 1e-9,
  );
  assert.ok(
    Math.abs(
      julio.clubControlSalary - clubRows.reduce((s, r) => s + r.salary, 0),
    ) < 1e-9,
  );

  // No option: club control equals total control and there is no option tail.
  const mcgonigle = valuePlayer(byName("Kevin McGonigle"), initialSettings, database);
  assert.equal(mcgonigle.clubControlThrough, mcgonigle.controlThrough);
  assert.equal(mcgonigle.playerOptionThrough, null);
  assert.ok(Math.abs(mcgonigle.clubControlWar - mcgonigle.totalWar) < 1e-9);

  // Soto: on the default option path club control ends in 2029.
  const soto = byName("Juan Soto");
  const withPath = (id) => {
    const copy = structuredClone(soto);
    copy.contractScenario.selectedId = id;
    return valuePlayer(copy, initialSettings, database);
  };
  assert.equal(withPath("option").clubControlThrough, 2029);
  assert.equal(withPath("option").playerOptionThrough, 2039);
  // Guaranteed years are club control, not an option.
  assert.equal(withPath("stays").clubControlThrough, 2039);
  assert.equal(withPath("stays").playerOptionThrough, null);
  assert.equal(withPath("walks").clubControlThrough, 2029);
  assert.equal(withPath("walks").playerOptionThrough, null);

  // Prospects and pending free agents.
  const prospect = database.players.find((player) => player.kind === "prospect");
  const p = valuePlayer(prospect, initialSettings, database);
  assert.equal(p.clubControlThrough, null);
  assert.equal(p.playerOptionThrough, null);
  assert.equal(p.clubControlWar, null);
});

test("club-control surplus plus player-option surplus equals the total", () => {
  for (const name of ["Juan Soto", "Bobby Witt Jr.", "Julio Rodríguez"]) {
    const player = database.players.find(
      (item) => item.name === name && item.kind === "mlb",
    );
    const result = valuePlayer(player, initialSettings, database);
    const counted = result.rows.filter((row) => !row.excluded && !row.optedOut);
    const club = counted
      .filter((row) => row.year <= result.clubControlThrough)
      .reduce((sum, row) => sum + row.surplus, 0);
    const option = counted
      .filter((row) => row.year > result.clubControlThrough)
      .reduce((sum, row) => sum + row.surplus, 0);
    assert.ok(
      Math.abs(club + option - result.total) < 0.05,
      `${name}: ${club} + ${option} vs ${result.total}`,
    );
    // The sentence reports total - club as the option effect.
    assert.ok(Math.abs(result.total - club - option) < 0.05);
  }
});
