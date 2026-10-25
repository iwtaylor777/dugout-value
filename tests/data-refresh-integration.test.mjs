import test from "node:test";
import assert from "node:assert/strict";
import database from "../app/data/player-database.json" with { type: "json" };
import previous from "../public/research/snapshots/2026-10-17/app/data/player-database.json" with { type: "json" };
import { reviewDataRefresh } from "../lib/data-refresh-review.mjs";
import { valuePlayer, initialSettings } from "../lib/value-model.mjs";

test("offseason refresh accounts for every prior identity and all valuation ranges remain finite", () => {
  const review = reviewDataRefresh(previous, database);
  assert.deepEqual(review.blockers, []);
  assert.deepEqual(review.warnings, []);
  assert.equal(review.readyForPromotion, true);
  assert.equal(database.meta.seasonRemainingFraction, 0);
  for (const player of database.players) {
    const value = valuePlayer(player, initialSettings, database);
    assert.ok([value.total, value.low, value.high].every(Number.isFinite), player.id);
    assert.ok(value.low <= value.total && value.total <= value.high, player.id);
  }
});
test("Soto keeps four option paths and observed platform statistics without stale forecasts", () => {
  const soto = database.players.find(player => player.id === "mlb-665742");
  const current = soto.seasons.find(season => season.year === 2026);
  assert.equal(current.war, 0);
  assert.equal(current.salary, 0);
  assert.equal(current.arbMetrics.pa, 482);
  assert.deepEqual(soto.contractScenario.options.map(option => option.id), ["option", "walks", "stays", "voided"]);
});
test("promoted provider IDs preserve published forecasts and old saved links", () => {
  const kade = database.players.find(player => player.id === "mlb-807739");
  assert.ok(kade.previousIds.includes("prospect-sa3026056"));
  assert.equal(kade.futureProjectionUpdate.rank, 39);
  assert.equal(kade.threeYearProjection.find(row => row.year === 2027).war, kade.futureProjectionUpdate.projections[2027]);
});
test("older grades remain dated and unsigned or released records are archived", () => {
  const retained = database.players.filter(player => player.refreshStatus === "retained-grade");
  assert.equal(retained.length, 4);
  assert.ok(retained.every(player => player.source.refreshed === "2026-07-31" && player.refreshNote));
  assert.equal(retained.find(player => player.name === "Peyton Pallette").team, "CHW");
  assert.equal(retained.find(player => player.name === "Cody Laweryson").team, "MIN");
  for (const id of ["prospect-2852654", "prospect-sa3015282", "prospect-25714"]) {
    assert.ok(!database.players.some(player => player.id === id));
    assert.ok(database.archivedPlayers.some(player => player.id === id && player.disposition.evidenceVerified));
  }
});
