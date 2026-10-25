import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSeasonHistory, remainingSeasonProjection } from "../lib/refresh-history.mjs";
const row = extra => ({ xMLBAMID: 665742, Season: 2026, _stats: "bat", Team: "NYM", PA: 482, AB: 400, H: 110, HR: 27, WAR: 3.11, ...extra });

test("a total and repeated team rows never double a player's season", () => {
  const result = normalizeSeasonHistory([row({ Team: "TOT" }), row({}), row({})]);
  assert.equal(result.length, 1);
  assert.equal(result[0].PA, 482);
  assert.equal(result[0].HR, 27);
  assert.equal(result[0].WAR, 3.11);
});
test("distinct traded-player stints combine counts and historical outs correctly", () => {
  const result = normalizeSeasonHistory([row({ _stats: "pit", Team: "BOS", IP: 10.2, ER: 2 }), row({ _stats: "pit", Team: "NYM", IP: 20.1, ER: 4 })]);
  assert.equal(result[0].IP, 31);
  assert.equal(result[0].ERA, 54 / 31);
  assert.equal(normalizeSeasonHistory(result)[0].IP, 31);
});
test("two-way players retain separate batting and pitching histories", () => {
  assert.equal(normalizeSeasonHistory([row({}), row({ _stats: "pit", IP: 50.1 })]).length, 2);
});
test("conflicting duplicate totals or stints require source review", () => {
  assert.throws(() => normalizeSeasonHistory([row({}), row({ PA: 500 })]), /Conflicting/);
  assert.throws(() => normalizeSeasonHistory([row({ Team: "TOT" }), row({ Team: "TOT", PA: 500 })]), /Conflicting/);
});
test("completed seasons ignore stale remaining-season projections without mutating their source", () => {
  const stale = { PA: 630, WAR: 5.1 };
  assert.equal(remainingSeasonProjection(stale, 0), undefined);
  assert.equal(remainingSeasonProjection(stale, 0.3), stale);
  assert.equal(stale.WAR, 5.1);
});
