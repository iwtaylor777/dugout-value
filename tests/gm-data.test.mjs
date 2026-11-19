import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withReportedGmContract, contractNameKey } from '../scripts/gm-contract-inputs.mjs';
import { valuePlayer, initialSettings } from '../lib/value-model.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../app/data/${name}.json`, import.meta.url)));
const db = read('player-database'), reports = read('free-agent-signings').entries;
const dv = read('dv-projections').players, sim = read('gm-sim');
const reconcile = name => {
  const p = db.players.find(p => contractNameKey(p.name) === contractNameKey(name));
  const reported = reports.find(s => contractNameKey(s.player) === contractNameKey(name));
  return withReportedGmContract(p, reported, dv[p.id]);
};

test('GM values resolve reported opt-ins into guaranteed club control', () => {
  for (const [name, end] of [['Bo Bichette', 2028], ['Ryan Helsley', 2027], ['Tatsuya Imai', 2028], ['Luis Severino', 2027], ['Yuki Matsui', 2028]]) {
    const p = reconcile(name);
    const future = p.seasons.filter(s => s.year >= 2027);
    assert.equal(Math.max(...future.map(s => s.year)), end, name);
    assert.ok(future.every(s => s.contractType === 'fixed'), name);
    assert.equal(valuePlayer(p, initialSettings, db).clubControlThrough, end, name);
    assert.equal(sim.players[p.id].ctl, end, name);
  }
});

test('GM inputs use reviewed option salaries and preserve future club options', () => {
  assert.equal(reconcile('Drew Rasmussen').seasons.find(s => s.year === 2027).salary, 20);
  assert.equal(reconcile('Andres Muñoz').seasons.find(s => s.year === 2027).salary, 9);
  const acuna = reconcile('Ronald Acuña Jr.');
  assert.equal(acuna.seasons.find(s => s.year === 2027).contractType, 'fixed');
  assert.equal(acuna.seasons.find(s => s.year === 2028).contractType, 'clubOption');
  // Keep uneven guarantees and separately modeled incentives, not invented AAV schedules.
  assert.deepEqual(reconcile('Yuki Matsui').seasons.filter(s => s.year >= 2027).map(s => s.salary), [6.5, 7]);
  assert.equal(reconcile('Tatsuya Imai').seasons.find(s => s.year === 2027).salary, 19.1);
});

test('unresolved or declined decisions do not become guaranteed contracts', () => {
  const p = { kind: 'mlb', seasons: [{ year: 2027, salary: 10, war: 1 }] };
  assert.equal(withReportedGmContract(p, { outcome: 'option-declined', years: 1, total_musd: 10 }), p);
  assert.equal(withReportedGmContract(p, { outcome: 'option-exercised', years: null, total_musd: null }), p);
});

test('reported pitching deals replace stale options and preserve Gray’s opt-out', () => {
  const may = reconcile('Dustin May');
  assert.deepEqual(may.seasons.filter(s => s.year >= 2027).map(s => [s.year, s.salary, s.contractType]), [
    [2027, 17.5, 'fixed'], [2028, 17.5, 'fixed'], [2029, 17.5, 'fixed'],
  ]);
  assert.equal(sim.players[may.id].ctl, 2029);
  assert.deepEqual(sim.players[may.id].contract, [2027, 2028, 2029].map(year => ({year, salary: 17.5, type: 'fixed'})));
  const gray = reconcile('Sonny Gray');
  assert.deepEqual(gray.seasons.filter(s => s.year >= 2027).map(s => [s.year, s.salary, s.contractType]), [
    [2027, 27.5, 'fixed'], [2028, 27.5, 'playerOption'],
  ]);
  assert.equal(sim.players[gray.id].ctl, 2027);
  assert.equal(sim.players[gray.id].contract[1].type, 'playerOption');
});
