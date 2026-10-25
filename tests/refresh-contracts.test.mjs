import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyReviewedContractPaths, reconcileMlbUniverse, depthChartControlContract } from "../lib/refresh-contracts.mjs";
const registry = JSON.parse(readFileSync(new URL("../data/reviewed-contract-paths.json", import.meta.url)));
test("offseason controlled players start estimates next year; veterans and unknown service do not get invented control", () => {
  const assignment = { on40Man: true, activeRoster: false, serviceTimeKnown: true, serviceTime: 3.025, team: "ARI" };
  const contract = depthChartControlContract(assignment, { baseYear: 2026, remainingFraction: 0 });
  assert.deepEqual(contract.years.map(row => [row.Season, row.Type]), [[2027, "ARB 1"], [2028, "ARB 2"], [2029, "ARB 3"]]);
  assert.equal(contract.estimatedControl, true);
  assert.equal(depthChartControlContract({ ...assignment, serviceTime: 6.01 }, { baseYear: 2026, remainingFraction: 0 }), null);
  assert.equal(depthChartControlContract({ ...assignment, serviceTimeKnown: false }, { baseYear: 2026, remainingFraction: 0 }), null);
});
test("Soto paths survive missing source notes and use fresh performance estimates", () => {
  const incoming = { id: "mlb-665742", name: "Juan Soto", team: "NYM", seasons: [{ year: 2029, war: 4, salary: 46 }, { year: 2030, war: 3, salary: 46 }] };
  const result = applyReviewedContractPaths(incoming, registry, 2026, year => ({ year, war: 2.5, projectionBaselineWar: 2.6 }));
  assert.deepEqual(result.contractScenario.options.map(o => o.id), ["option", "walks", "stays", "voided"]);
  assert.equal(result.seasons.length, 1);
  assert.equal(result.contractScenario.options[0].seasons[0].war, 2.5);
  assert.equal(result.contractScenario.options[3].seasons[0].salary, 50);
  assert.equal(result.contractScenario.options[0].seasons[0].contractType, "playerOption");
  assert.equal(incoming.seasons.length, 2);
  assert.throws(() => applyReviewedContractPaths({ ...incoming, team: "BOS" }, registry, 2026, () => ({ war: 2 })), /reconciliation/);
  const conflicting = structuredClone(result);
  conflicting.contractScenario.options[0].seasons[0].salary = 99;
  assert.throws(() => applyReviewedContractPaths(conflicting, registry, 2026, () => ({ war: 2 })), /Changed source contract terms/);
});
test("flat option years with missing provider notes must fit one reviewed path", () => {
  const player = { id: "mlb-665742", name: "Juan Soto", team: "NYM", seasons: [
    { year: 2029, war: 4, salary: 61.88 },
    { year: 2030, war: 3, salary: 46, annualSalary: 46, contractType: "fixed", optionBuyout: 0 },
    { year: 2031, war: 3, salary: 46, annualSalary: 46, contractType: "fixed", optionBuyout: 0 },
  ] };
  const project = year => ({ year, war: 2.5 });
  assert.equal(applyReviewedContractPaths(player, registry, 2026, project).contractScenario.options.length, 4);
  const changedSalary = structuredClone(player);
  changedSalary.seasons[1].salary = 51;
  assert.throws(() => applyReviewedContractPaths(changedSalary, registry, 2026, project), /Changed flat contract terms/);
  const mixedPaths = structuredClone(player);
  mixedPaths.seasons[2].salary = 50;
  assert.throws(() => applyReviewedContractPaths(mixedPaths, registry, 2026, project), /Changed flat contract terms/);
  const extraYear = structuredClone(player);
  extraYear.seasons.push({ year: 2040, war: 2, salary: 46, annualSalary: 46 });
  assert.throws(() => applyReviewedContractPaths(extraYear, registry, 2026, project), /Changed flat contract terms/);
  const voided = structuredClone(player);
  voided.seasons[1].salary = voided.seasons[2].salary = 50;
  assert.equal(applyReviewedContractPaths(voided, registry, 2026, project).contractScenario.options.length, 4);
});
test("conditional flat schedules may omit option years", () => {
  const project = year => ({ year, war: 1 });
  for (const [id, name, team, year, salary] of [
    ["mlb-621242", "Edwin Díaz", "LAD", 2029, 21.11],
    ["mlb-677594", "Julio Rodríguez", "SEA", 2030, 30],
  ]) {
    const player = { id, name, team, seasons: [{ year, war: 1, salary, annualSalary: salary, contractType: "fixed" }] };
    assert.ok(applyReviewedContractPaths(player, registry, 2026, project).contractScenario);
    assert.ok(applyReviewedContractPaths({ ...player, seasons: [] }, registry, 2026, project).contractScenario);
  }
});
test("missing MLB players retain identity and honest source date for review", () => {
  const old = { id: "mlb-1", kind: "mlb", name: "Missing Player", source: { refreshed: "2026-07-31" }, seasons: [{ year: 2026, war: 2, salary: 5, ros: true }, { year: 2027, war: 3, salary: 10 }], seasonToDateWar: 1 };
  const result = reconcileMlbUniverse([old], [], { baseYear: 2026, remainingFraction: 0 });
  assert.deepEqual(result.carriedIds, ["mlb-1"]);
  assert.equal(result.players[0].source.refreshed, "2026-07-31");
  assert.equal(result.players[0].refreshStatus, "carried-forward");
  assert.equal(result.players[0].seasons[0].war, 0);
  assert.equal(result.players[0].seasons[1].war, 3);
  assert.equal(old.seasons[0].war, 2);
});

test("dated roster dispositions archive records without deleting history and expire on the next snapshot", () => {
  const old = { id: "mlb-1", kind: "mlb", name: "Released", seasons: [] };
  const dispositions = { validThrough: "2026-10-18", entries: [{ id: old.id, effectiveDate: "2026-09-30", transactionId: 1, reason: "Released" }] };
  const options = { baseYear: 2026, remainingFraction: 0, snapshotDate: "2026-10-18", dispositions };
  const reviewed = reconcileMlbUniverse([old], [], options);
  assert.equal(reviewed.archived[0].id, old.id);
  assert.equal(reviewed.players.length, 0);
  const expired = reconcileMlbUniverse([old], [], { ...options, snapshotDate: "2026-10-19" });
  assert.equal(expired.carriedIds.length, 1);
  assert.equal(reconcileMlbUniverse([old], [old], options).archived.length, 0);
});
