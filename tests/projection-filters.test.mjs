import test from "node:test";
import assert from "node:assert/strict";
import { matchesProjectionSearch as search, matchesProjectionRole as role, laterProjectionWar } from "../lib/projection-filters.mjs";
import { compareTableValues } from "../lib/table-sort.mjs";

const catcher = { name: "Willson Contreras", team: "BOS", position: "C/1B", role: "position" };
const outfielder = { name: "Julio Rodríguez", team: "SEA", position: "CF/RF", role: "position" };
const starter = { name: "Chris Sale", team: "ATL", position: "P", role: "starter" };
const reliever = { name: "Aroldis Chapman", team: "BOS", position: "P", role: "reliever" };

test("projection search recognizes names, teams, position names and abbreviations", () => {
  for (const query of ["C", "catcher", "catchers", "1B", "first base", "first baseman", "first basemen", "BOS catcher", "Boston first baseman", "Willson Contreras"]) {
    assert.ok(search(catcher, query, "Boston Red Sox"), query);
  }
  assert.ok(search(outfielder, "Julio Rodriguez"));
  for (const query of ["OF", "outfielder", "center field", "CF", "right fielder", "SEA CF"]) assert.ok(search(outfielder, query), query);
  assert.ok(search(starter, "starting pitcher"));
  assert.ok(search(reliever, "relief pitchers"));
  assert.ok(search(starter, "P"));
  assert.equal(search(catcher, "shortstop"), false);
  assert.equal(search(starter, "C"), false, "C must not match Chris or a team name");
  assert.equal(search(outfielder, "LF"), false, "do not invent unlisted eligibility");
  assert.ok(search(catcher, ""));
});

test("dropdown handles every listed position, outfield groups and pitching roles", () => {
  assert.ok(role(catcher, "C")); assert.ok(role(catcher, "1B"));
  assert.equal(role(catcher, "CF"), false);
  assert.ok(role(outfielder, "OF")); assert.ok(role(outfielder, "RF"));
  assert.ok(role(starter, "SP")); assert.equal(role(starter, "RP"), false);
  assert.ok(role(reliever, "RP")); assert.equal(role(reliever, "SP"), false);
  assert.ok(role({ position: "SP/RP", role: "starter" }, "RP"));
  assert.ok(role({ position: "TWP", role: "two-way" }, "two-way"));
  assert.ok(role({ position: "DH/OF", role: "position" }, "DH"));
});

test("later-year sorting uses the complete displayed total, leaving missing after negative WAR", () => {
  const records = [
    { name: "Missing", war: undefined },
    { name: "Partial", war: { 2029: 5, 2030: 5 } },
    { name: "High", war: { 2029: 3, 2030: 2, 2031: 1 } },
    { name: "Negative", war: { 2029: -1, 2030: -1, 2031: -1 } },
    { name: "Zero", war: { 2029: 0, 2030: 0, 2031: 0 } },
  ];
  const result = records.map(r => ({ ...r, total: laterProjectionWar(r.war) }))
    .sort((a, b) => compareTableValues(a.total, b.total) || a.name.localeCompare(b.name));
  assert.deepEqual(result.map(r => r.name), ["High", "Zero", "Negative", "Missing", "Partial"]);
  assert.equal(result[0].total, 6);
  assert.equal(laterProjectionWar({ 2029: NaN, 2030: 2, 2031: 3 }), null);
});
