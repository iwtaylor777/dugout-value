import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedMarket, prospectBrief, ownedRoster, couldFitBudget } from '../lib/gm-experience.mjs';
import { playerContract } from '../lib/gm-sim.mjs';

test('expected market uses broad public ranges, never a private asking threshold', () => {
  const row = { years: 2, aav: 13, marketForecast: { reference: { years: 2, aav: 13 } } };
  const range = expectedMarket(row);
  assert.deepEqual(range, { lowYears: 1, highYears: 3, lowAav: 10, highAav: 16, basis: 'Based on public contract forecasts' });
  assert.deepEqual(expectedMarket({ ...row, seed: 901, privateAsk: 15.2 }), range);
  const uncertain = expectedMarket({ years: 2, aav: 13 });
  assert.ok(uncertain.highAav - uncertain.lowAav > range.highAav - range.lowAav);
  assert.ok(uncertain.highYears > range.highYears);
});

test('range covers disagreement in public forecasts and handles thin markets', () => {
  const range = expectedMarket({ years: 5, aav: 25, marketForecast: { reference: { years: 5, aav: 25 }, forecasts: [{ aav: 20 }, { aav: 30 }] } });
  assert.ok(range.lowAav < 20 && range.highAav > 30);
  assert.deepEqual(expectedMarket({ aav: .8, years: 1 }), { lowYears: 1, highYears: 1, lowAav: .8, highAav: 2, basis: 'Minimum-salary / depth market' });
  assert.equal(expectedMarket({}).lowAav, null);
  assert.equal(expectedMarket({ years: 13, aav: 40 }).highYears, 13);
});

test('prospect description only shows known scouting information', () => {
  assert.equal(prospectBrief({ pos: 'OF', age: 22 }), 'OF · age 22');
  assert.equal(prospectBrief({ pos: 'SS', age: 20, fv: '45+', eta: 2028 }), 'SS · age 20 · 45+ FV · ETA 2028');
});

test('signed players without trade valuations remain on the roster with their actual contract', () => {
  const ctx = { players: [{ pid: 'leo', n: 'Leo Jimenez', e: ['SS', '2B'] }], tracker: { players: [{ id: 'leo', name: 'Leo Jimenez', pos: 'SS/2B', age: 26 }] }, sim: { players: { known: { n: 'Known prospect', pos: 'OF', k: 'p', age: 21, fv: 45, v20: 1, v10: 1, v05: 1 } } } };
  const league = { owner: new Map([['leo', 'PIT'], ['known', 'PIT'], ['other', 'BOS']]), newContracts: new Map([['leo', { years: 1, total: 6 }]]) };
  const roster = ownedRoster(ctx, league.owner, 'PIT');
  assert.equal(roster.length, 2);
  const leo = roster.find(player => player.pid === 'leo');
  assert.equal(leo.v.n, 'Leo Jimenez');
  assert.equal(leo.v.pos, 'SS/2B');
  assert.equal(leo.priced, false);
  assert.equal('v10' in leo.v, false);
  assert.equal(roster.find(player => player.pid === 'known').priced, true);
  assert.equal(playerContract(ctx, league, 'leo').hit, 6);
  assert.deepEqual(playerContract(ctx, league, 'leo').seasons, [{ year: 2027, salary: 6, type: 'fixed' }]);
});

test('budget discovery uses public low range, preserves pending bids and unknown markets', () => {
  assert.equal(couldFitBudget({ aav: 10, years: 1 }, 16.3), true);
  assert.equal(couldFitBudget({ aav: 10, years: 1 }, 16.3 - 9 - 6), false);
  assert.equal(couldFitBudget({ aav: 10, years: 1 }, 1.3, true), true);
  assert.equal(couldFitBudget({}, 1.3), true);
  assert.equal(couldFitBudget({}, .3), false);
  assert.equal(couldFitBudget({}, .8), true);
  assert.equal(couldFitBudget({}, -1, true), true);
  assert.equal(couldFitBudget({ aav: .8, years: 1 }, -1), false);
});
