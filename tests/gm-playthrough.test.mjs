import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as g from '../lib/gm-sim.mjs';
import { createGame, act, gameSave, replayGame } from '../lib/gm-game.mjs';
import { marketTracker } from '../lib/free-agent-current.mjs';
import { userOfferOutcomes } from '../lib/gm-market.mjs';
import { allocate } from '../lib/depth-chart.mjs';
import { tradeRosterImpact } from '../lib/gm-experience.mjs';

// Real-data regression journals from independent rebuilding/contending playtests.
// Test decisions and bookkeeping, not exact Monte Carlo outcomes or letter grades.
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const ctx = {
  players: read('../app/data/depth-chart.json').players,
  tracker: marketTracker(read('../app/data/free-agent-tracker.json')),
  signings: read('../app/data/free-agent-signings.json'),trades:read('../app/data/trades.json'),
  sim: read('../app/data/gm-sim.json'),
  payroll: read('../app/data/team-payroll.json').cbt,
};
const seed = 20261109;
const id = name => {
  const pid = Object.keys(ctx.sim.players).find(pid => ctx.sim.players[pid].n === name)
    ?? ctx.tracker.players.find(row => row.name === name)?.id;
  assert.ok(pid, `Missing playtest player: ${name}`);
  return pid;
};
const trade = (partner, give, get, cash = 0) => ['trade', { partner, give: give.map(id), get: get.map(id), cash }];
const bid = (name, years, total) => ['bid', { pid: id(name), years, total }];
function play(team, actions) {
  let state = createGame(team, seed);
  const responses = [];
  for (const action of actions) {
    const response = act(ctx, state, action);
    assert.ok(response.accepted, `${team} ${JSON.stringify(action)}: ${response.reason}`);
    responses.push(response);
    state = response.moves;
  }
  return { state, responses };
}
function assertComplete(state, tradeCount, signingNames) {
  assert.equal(state.budget, null, 'uses the default ownership budget');
  assert.equal(state.market.round, 3);
  assert.equal(state.market.bids.length, 0);
  assert.equal(state.trades.length, tradeCount);
  assert.deepEqual(state.signings.map(s => s.pid).sort(), signingNames.map(id).sort());
  const readiness = g.seasonReadiness(ctx, state);
  assert.ok(readiness.ready, JSON.stringify(readiness));
  assert.equal(readiness.marketOpen, false);
  assert.ok(readiness.payroll <= readiness.budget);
  const restored = replayGame(ctx, gameSave(state));
  assert.deepEqual(restored.dropped, []);
  assert.deepEqual(restored.moves, state, 'replay reproduces the complete market and user ledger');
  assert.ok(Object.values(g.teamStrengths(ctx, g.buildLeague(ctx, state).teamOf)).every(s => Number.isFinite(s.war) && Number.isFinite(s.sd)));
}

test('Angels retool completes with clear closeout outcomes and honest buyer feedback', () => {
  const { state, responses } = play('LAA', [
    // Boston has less room after signing Jake Bauers, so the Angels send more cash.
    trade('BOS', ['Yusei Kikuchi'], ['Blake Wehunt'], 14),
    bid('Jonathan India', 2, 18), bid('Brandon Woodruff', 1, 12), bid('Edmundo Sosa', 1, 9.5), ['advance'],
    bid('Jonathan India', 2, 20), ['advance'], bid('Brusdar Graterol', 2, 12), ['advance'],
  ]);
  assertComplete(state, 1, ['Jonathan India', 'Brandon Woodruff', 'Edmundo Sosa', 'Brusdar Graterol']);
  assert.match(responses[0].reason, /improves their projected 2027 roster/);
  assert.doesNotMatch(responses[0].reason, /losing current production/);
  const league = g.buildLeague(ctx, state);
  assert.equal(league.owner.get(id('Yusei Kikuchi')), 'BOS');
  assert.equal(league.owner.get(id('Blake Wehunt')), 'LAA');
  assert.equal(league.cash.get('LAA'), 14);
  assert.equal(league.cash.get('BOS'), -14);
  const graterolNews = responses.at(-1).news.filter(line => line.includes('Brusdar Graterol'));
  assert.equal(graterolNews.length, 1, 'only the final Graterol decision remains');
  assert.match(graterolNews[0], /signed with Los Angeles Angels/);
  assert.doesNotMatch(graterolNews[0], /has not accepted|still listening/);
  assert.equal(userOfferOutcomes(ctx, state).find(o => o.offer.pid === id('Brusdar Graterol')).status, 'signed');
});

test('Yankees contender can buy Neto, move Volpe, and finish after losing a free-agent auction', () => {
  const first = act(ctx, createGame('NYY', seed), trade('LAA', ['Carlos Lagrange', 'Ben Hess'], ['Zach Neto']));
  assert.equal(first.accepted, false, 'the first, weaker prospect offer still falls short');
  const { state } = play('NYY', [
    trade('LAA', ['Carlos Lagrange', 'Ben Hess', 'Spencer Jones'], ['Zach Neto']),
    bid('Jazz Chisholm Jr.', 2, 40), bid('Teruaki Sato', 5, 95), ['advance'],
    bid('Teruaki Sato', 5, 100), ['advance'],
    trade('PIT', ['Anthony Volpe'], ['Termarr Johnson']),
    bid('Teruaki Sato', 5, 105), ['advance'],
  ]);
  assertComplete(state, 2, ['Jazz Chisholm Jr.']);
  const league = g.buildLeague(ctx, state);
  assert.equal(league.owner.get(id('Zach Neto')), 'NYY');
  assert.equal(league.owner.get(id('Anthony Volpe')), 'PIT');
  assert.equal(league.owner.get(id('Termarr Johnson')), 'NYY');
  const sato = userOfferOutcomes(ctx, state).find(o => o.offer.pid === id('Teruaki Sato'));
  assert.equal(sato.status, 'lost');
  // The winning club depends on the live free-agent market, which changes as signings are reported.
  assert.ok(sato.deal.team && sato.deal.team !== 'NYY', sato.deal.team);
});

test('Neto preview matches allocated roster WAR and uses realistic secondary infield roles', () => {
  const state = createGame('NYY', seed);
  const proposal = trade('LAA', ['Carlos Lagrange', 'Ben Hess', 'Spencer Jones'], ['Zach Neto']);
  const before = g.buildLeague(ctx, state);
  const proposed = g.buildLeague(ctx, { ...state, trades: [proposal[1]] });
  const preview = tradeRosterImpact(allocate(g.rosterOf(ctx, before.teamOf, 'NYY')), allocate(g.rosterOf(ctx, proposed.teamOf, 'NYY')), proposal[1].get);
  const response = act(ctx, state, proposal);
  assert.ok(response.accepted, response.reason);
  const actual = g.buildLeague(ctx, response.moves);
  const actualChange = g.teamWar(ctx, actual.teamOf, 'NYY') - g.teamWar(ctx, before.teamOf, 'NYY');
  assert.ok(Math.abs(preview.warChange - actualChange) < 1e-10);
  assert.ok(Math.abs(preview.positions.reduce((sum, p) => sum + p.change, 0) - actualChange) < 1e-10);
  const neto = preview.incoming.find(p => p.pid === id('Zach Neto'));
  assert.equal(neto.unit, 'PA');
  assert.ok(!neto.roles.some(r => r.pos === 'DH' && r.pt > 0));
  assert.ok(neto.roles.some(r => ['2B','3B'].includes(r.pos) && r.pt > 0 && r.inferred));
  assert.ok(neto.roles.some(r => r.pos === 'SS' && r.pt > 0));
  assert.ok(actualChange>.5,'secondary positions recover meaningful roster fit without altering the trade price model');
  assert.equal(neto.pt, neto.roles.reduce((sum, r) => sum + r.pt, 0));
  assert.ok(preview.displaced.length > 0, 'the user sees incumbents losing playing time');
});

test('Athletics rebuild can retain salary, add short-term veterans and finish below budget', () => {
  const first = act(ctx, createGame('ATH', seed), trade('BAL', ['Luis Severino'], ['JT Quinn'], 10));
  assert.equal(first.accepted, false);
  const { state } = play('ATH', [
    bid('Chris Bassitt', 1, 13), bid('Andrew Kittredge', 1, 4.5), ['advance'],
    trade('BOS', ['Luis Severino'], ['Blake Wehunt'], 15), ['advance'], ['advance'],
  ]);
  assertComplete(state, 1, ['Chris Bassitt', 'Andrew Kittredge']);
  assert.equal(g.offseasonObjective(ctx, state).label, 'Build for the future');
  const league = g.buildLeague(ctx, state);
  assert.equal(league.owner.get(id('Luis Severino')), 'BOS');
  assert.equal(league.owner.get(id('Blake Wehunt')), 'ATH');
  assert.equal(league.cash.get('ATH'), 15);
  assert.equal(league.cash.get('BOS'), -15);
});
