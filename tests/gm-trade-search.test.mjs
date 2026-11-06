import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesTradePlayer } from '../lib/gm-trade-search.mjs';

test('trade autocomplete matches partial names, accents, punctuation and multiple words', () => {
  for (const [name, query] of [['Roman Anthony', 'anth'], ['Jovani Morán', 'moran'], ['Ha-Seong Kim', 'ha seong'], ['J.P. Crawford', 'j p craw'], ['Roman Anthony', '  anth roman '], ['Roman Anthony', '']]) {
    assert.equal(matchesTradePlayer(name, query), true, `${name}: ${query}`);
  }
  assert.equal(matchesTradePlayer('Roman Anthony', 'roman devers'), false);
});
