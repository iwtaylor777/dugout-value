import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedMarket, prospectBrief } from '../lib/gm-experience.mjs';

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
