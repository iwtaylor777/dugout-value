import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesTradePlayer, matchesTradeChoice } from '../lib/gm-trade-search.mjs';

test('trade autocomplete matches partial names, accents, punctuation and multiple words', () => {
  for (const [name, query] of [['Roman Anthony', 'anth'], ['Jovani Morán', 'moran'], ['Ha-Seong Kim', 'ha seong'], ['J.P. Crawford', 'j p craw'], ['Roman Anthony', '  anth roman '], ['Roman Anthony', '']]) {
    assert.equal(matchesTradePlayer(name, query), true, `${name}: ${query}`);
  }
  assert.equal(matchesTradePlayer('Roman Anthony', 'roman devers'), false);
});

test('trade autocomplete also searches public position, prospect and FV descriptions', () => {
  const prospect = { name: 'Miguel Bleis', position: 'Prospect · OF · age 22 · 40+ FV · ETA 2027', contract: 'No MLB charge' };
  for (const query of ['prospect', 'OF', '40+ FV', 'prospect 40', 'bleis of', 'ETA 2027']) {
    assert.equal(matchesTradeChoice(prospect, query), true, query);
  }
  assert.equal(matchesTradeChoice(prospect, 'SP'), false);
  assert.equal(matchesTradeChoice(prospect, 'C'), false);
  assert.equal(matchesTradeChoice(prospect, '50 FV'), false);
  assert.equal(matchesTradeChoice(prospect, 'MLB charge'), false);
  assert.equal(matchesTradeChoice({ name: 'Trevor Story', position: 'SS/2B' }, '2b story'), true);
  assert.equal(matchesTradeChoice({ name: 'Trevor Story', position: 'SS/2B' }, 'prospect'), false);
  assert.equal(matchesTradeChoice({ name: 'Roman Anthony', position: 'LF/RF' }, 'OF'), true);
});
