import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyInSeasonTalentUpdate,
  buildInSeasonTalentUpdate,
  projectionRate,
  signalPersistence,
} from "../lib/in-season-projection.mjs";

test("normalizes talent to role-appropriate workloads", () => {
  assert.equal(projectionRate({ WAR: 3, PA: 600 }, "position"), 3);
  assert.equal(projectionRate({ WAR: 2, IP: 120 }, "starter"), 3);
  assert.equal(projectionRate({ WAR: 1, IP: 65 }, "reliever"), 1);
});

test("uses projection-to-projection changes rather than season-to-date WAR", () => {
  const update = buildInSeasonTalentUpdate({
    role: "position",
    providers: [
      {
        name: "ZiPS",
        preseason: { WAR: 3, PA: 600 },
        updated: { WAR: 2, PA: 300 },
        seasonToDateWar: 8,
      },
      {
        name: "Steamer",
        preseason: { WAR: 2.5, PA: 600 },
        updated: { WAR: 1.75, PA: 300 },
        seasonToDateWar: -2,
      },
    ],
  });

  assert.equal(update.rateChange, 1);
  assert.equal(update.providers[0].changeRate, 1);
  assert.equal(update.providers[1].changeRate, 1);
});

test("carries half of a valid ZiPS rate change into the next season", () => {
  const update = buildInSeasonTalentUpdate({
    role: "position",
    providers: [
      {
        name: "ZiPS",
        preseason: { WAR: 2.76516, PA: 650 },
        updated: { WAR: 1.84697, PA: 274 },
      },
    ],
  });
  const projection = applyInSeasonTalentUpdate({
    baselineWar: 2.96891,
    futureProjection: { PA: 650 },
    role: "position",
    year: 2027,
    baseYear: 2026,
    update,
  });

  assert.equal(update.providerCount, 1);
  assert.ok(update.rateChange > 1.4 && update.rateChange < 1.6);
  assert.ok(projection.adjustment > 0.75 && projection.adjustment < 0.9);
  assert.ok(projection.finalWar > 3.7 && projection.finalWar < 3.9);
});

test("does not mistake Hunter Goodman-style role changes for declining offense", () => {
  const update = buildInSeasonTalentUpdate({
    role: "position",
    providers: [
      {
        name: "ZiPS",
        preseason: {
          WAR: 2.25759,
          PA: 570,
          Off: -1.26445,
        },
        updated: {
          WAR: 0.759199,
          PA: 216,
          Off: 0.91842,
        },
      },
    ],
  });
  const projection = applyInSeasonTalentUpdate({
    baselineWar: 2.10489,
    futureProjection: { PA: 594 },
    role: "position",
    year: 2027,
    baseYear: 2026,
    update,
  });

  assert.equal(update.providers[0].roleGuarded, true);
  assert.ok(update.providers[0].rawChangeRate < -0.25);
  assert.ok(update.providers[0].offenseChangeRate > 0.35);
  assert.ok(update.rateChange > 0 && update.rateChange < 0.1);
  assert.ok(projection.adjustment > 0 && projection.adjustment < 0.05);
  assert.ok(projection.finalWar > 2.1);
});

test("future carry decays smoothly without reversing the signal", () => {
  assert.equal(signalPersistence(2027, 2026), 0.5);
  assert.equal(signalPersistence(2028, 2026), 0.5 * 0.85);
  assert.ok(signalPersistence(2030, 2026) < signalPersistence(2028, 2026));
});

test("caps extreme rate changes and safely skips missing pairs", () => {
  const update = buildInSeasonTalentUpdate({
    role: "starter",
    providers: [
      {
        name: "ZiPS",
        preseason: { WAR: -2, IP: 180 },
        updated: { WAR: 8, IP: 180 },
      },
      {
        name: "Missing",
        preseason: { WAR: 2, IP: 180 },
      },
    ],
  });

  assert.equal(update.providerCount, 1);
  assert.equal(update.rateChange, 3);
  assert.equal(update.capped, true);
});

test("does not mistake a near-zero injured-player workload for talent", () => {
  const update = buildInSeasonTalentUpdate({
    role: "starter",
    providers: [
      {
        name: "RoS after season-ending injury",
        preseason: { WAR: 4, IP: 180 },
        updated: { WAR: 0, IP: 1 },
      },
    ],
  });

  assert.equal(update, null);
});

test("the refreshed database keeps every displayed bridge internally consistent", async () => {
  const database = JSON.parse(
    await readFile(
      new URL("../app/data/player-database.json", import.meta.url),
      "utf8",
    ),
  );
  const adjustedSeasons = database.players
    .filter((player) => player.kind === "mlb")
    .flatMap((player) =>
      player.seasons.filter(
        (season) =>
          Number.isFinite(season.projectionBaselineWar) &&
          Number.isFinite(season.inSeasonAdjustment),
      ),
    );

  assert.ok(adjustedSeasons.length > 1000);
  for (const season of adjustedSeasons) {
    assert.equal(
      season.war,
      Number(
        (
          season.projectionBaselineWar + season.inSeasonAdjustment
        ).toFixed(1),
      ),
    );
  }
});

test("James Wood uses today's official baseline plus a visible talent update", async () => {
  const database = JSON.parse(
    await readFile(
      new URL("../app/data/player-database.json", import.meta.url),
      "utf8",
    ),
  );
  const wood = database.players.find(
    (player) => player.id === "mlb-695578",
  );
  const nextSeason = wood.seasons.find(
    (season) => season.year === database.meta.baseYear + 1,
  );

  assert.equal(wood.name, "James Wood");
  assert.match(wood.source.projection, /rolling talent update/);
  assert.equal(wood.talentUpdate.providers.length, 1);
  assert.ok(nextSeason.inSeasonAdjustment > 0);
  assert.equal(
    nextSeason.war,
    Number(
      (
        nextSeason.projectionBaselineWar + nextSeason.inSeasonAdjustment
      ).toFixed(1),
    ),
  );
});

test("every MLB player has a contract-independent three-year projection", async () => {
  const database = JSON.parse(
    await readFile(
      new URL("../app/data/player-database.json", import.meta.url),
      "utf8",
    ),
  );
  const mlbPlayers = database.players.filter(
    (player) => player.kind === "mlb",
  );

  assert.ok(mlbPlayers.length > 1000);
  for (const player of mlbPlayers) {
    assert.deepEqual(
      player.threeYearProjection.map((season) => season.year),
      [
        database.meta.baseYear,
        database.meta.baseYear + 1,
        database.meta.baseYear + 2,
      ],
    );
    assert.ok(
      player.threeYearProjection.every((season) =>
        Number.isFinite(season.war),
      ),
    );
  }
});
