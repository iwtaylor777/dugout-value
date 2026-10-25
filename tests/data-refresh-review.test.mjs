import test from "node:test";
import assert from "node:assert/strict";
import { reviewDataRefresh } from "../lib/data-refresh-review.mjs";

const baseline = () => ({ meta: { baseYear: 2026, refreshed: "2026-07-31", mlbCount: 1, prospectCount: 0, seasonRemainingFraction: 0.3 }, players: [{ id: "p1", name: "Player", kind: "mlb", seasons: [{ year: 2026, war: 1, salary: 2, ros: true }], contractScenario: { selectedId: "stays", options: [{ id: "stays" }, { id: "walks" }] } }] });

test("refresh review rejects lost contract paths and nonzero remaining-season value after season end", () => {
  const current = baseline(), candidate = baseline();
  delete candidate.players[0].contractScenario;
  candidate.meta.seasonRemainingFraction = 0;
  const review = reviewDataRefresh(current, candidate);
  assert.equal(review.readyForPromotion, false);
  assert.ok(review.blockers.some(line => line.includes("Contract paths removed")));
  assert.ok(review.blockers.some(line => line.includes("Remaining-season WAR")));
});

test("refresh review does not approve unexplained missing records or duplicate IDs", () => {
  const current = baseline(), candidate = baseline();
  candidate.players[0].id = "other";
  assert.equal(reviewDataRefresh(current, candidate).readyForPromotion, false);
  candidate.players.push(candidate.players[0]);
  assert.ok(reviewDataRefresh(current, candidate).blockers.some(line => line.includes("duplicate")));
});

test("unchanged coherent inputs pass the structural review", () => {
  assert.equal(reviewDataRefresh(baseline(), baseline()).readyForPromotion, true);
});

test("review checks option paths for expired WAR and salary", () => {
  const current = baseline(), candidate = baseline();
  candidate.meta.seasonRemainingFraction = 0;
  candidate.players[0].seasons[0] = { year: 2026, ros: true, war: 0, salary: 0 };
  candidate.players[0].contractScenario.options[0].seasons = [{ year: 2026, ros: true, war: 1, salary: 4 }];
  const review = reviewDataRefresh(current, candidate);
  assert.ok(review.blockers.some(line => line.includes("Remaining-season WAR")));
  assert.ok(review.blockers.some(line => line.includes("Remaining-season salary")));
});
test("stale carried records and silent MLB reclassifications block promotion", () => {
  const current = baseline(), candidate = baseline();
  candidate.players[0].refreshStatus = "carried-forward";
  assert.ok(reviewDataRefresh(current, candidate).blockers.some(line => line.includes("carried-forward")));
  delete candidate.players[0].refreshStatus;
  candidate.players[0].kind = "prospect";
  assert.ok(reviewDataRefresh(current, candidate).blockers.some(line => line.includes("reclassification")));
});
test("two records cannot represent the same MLBAM person", () => {
  const candidate = baseline();
  candidate.players[0].mlbamId = "123";
  candidate.players.push({ id: "prospect-1234", mlbamId: "123", kind: "prospect", name: "Duplicate" });
  assert.ok(reviewDataRefresh(baseline(), candidate).blockers.some(line => line.includes("Duplicate MLBAM")));
});
