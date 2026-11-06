import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import * as g from '../lib/gm-sim.mjs';
import * as m from '../lib/gm-market.mjs';
import { allocate } from '../lib/depth-chart.mjs';
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ctx = { players: read('../app/data/depth-chart.json').players, tracker: read('../app/data/free-agent-tracker.json'), signings: read('../app/data/free-agent-signings.json'), sim: read('../app/data/gm-sim.json'), payroll: read('../app/data/team-payroll.json').cbt };
const game = () => ({ team: 'BOS', seed: 42, budget: 400, signings: [], trades: [], market: m.newMarket() });
const row = name => ctx.tracker.players.find(p => p.name === name);

test('rival bids are seeded, affordable, and reserve one target per club', () => {
  const start = game(), league = g.buildLeague(ctx, start), board = m.marketBoard(ctx, start);
  assert.deepEqual(m.marketBoard(ctx, start), board);
  const offers = board.flatMap(p => p.rivals);
  assert.ok(offers.length > 10);
  assert.equal(new Set(offers.map(o => o.team)).size, offers.length);
  for (const offer of offers) {
    assert.notEqual(offer.team, start.team);
    assert.ok(offer.total <= offer.ceiling);
    assert.ok(offer.gain >= .3);
    assert.ok(offer.ceiling / offer.years + g.payrollFor(ctx, league, offer.team) <= ctx.sim.teams[offer.team].cbt2026 * 1.02 + 1e-8);
  }
});

test('pending bids show combined exposure without a hard cap; revisions replace rather than duplicate', () => {
  let start = game();
  start.budget = g.payrollFor(ctx, g.buildLeague(ctx, start), start.team) + 50;
  const skubal = row('Tarik Skubal'), jazz = row('Jazz Chisholm Jr.');
  let answer = m.submitMarketBid(ctx, start, { pid: skubal.id, years: 10, total: 450 });
  assert.equal(answer.accepted, true);
  start = answer.moves;
  assert.equal(start.signings.length, 0, 'submission is not an instant signing');
  answer = m.submitMarketBid(ctx, start, { pid: jazz.id, years: 4, total: 80 });
  assert.equal(answer.accepted, true);
  assert.equal(answer.moves.market.bids.length, 2);
  assert.match(answer.reason, /clear \$15.0M before simulating/);
  answer = m.submitMarketBid(ctx, start, { pid: skubal.id, years: 10, total: 400 });
  assert.equal(answer.moves.market.bids.length, 1);
  assert.equal(answer.moves.market.bids[0].total, 400);
  assert.equal(m.submitMarketBid(ctx, start, { pid: skubal.id, years: 10.5, total: 400 }).accepted, false);
  assert.equal(m.submitMarketBid(ctx, start, { pid: skubal.id, years: 10, total: NaN }).accepted, false);
});

test('a strong offer can land a contested player and rivals cannot exceed ceilings', () => {
  const start = game(), skubal = row('Tarik Skubal');
  const submitted = m.submitMarketBid(ctx, start, { pid: skubal.id, years: 10, total: 700 }).moves;
  const result = m.advanceMarket(ctx, submitted);
  assert.ok(result.moves.signings.some(s => s.pid === skubal.id));
  assert.ok(!result.moves.market.deals.some(s => s.pid === skubal.id));
  assert.ok(!result.moves.market.bids.some(s => s.pid === skubal.id));
  assert.match(result.news.join(' '), /You got him/);
  assert.deepEqual(m.advanceMarket(ctx, submitted), result);
  const restored = g.restoreMoves(ctx, result.moves);
  assert.ok(restored.moves, restored.reason);
});

test('a strong opening bid can win below rival ceilings, without an automatic exact-price counter', () => {
  const start = game(), skubal = row('Tarik Skubal');
  const total = Math.ceil(g.askFor(skubal, start.seed).total * 1.15 * 10) / 10;
  const rivals = m.marketBoard(ctx, start).find(p => p.pid === skubal.id).rivals;
  assert.ok(rivals.some(r => r.ceiling > total));
  const submitted = m.submitMarketBid(ctx, start, { pid: skubal.id, years: 10, total }).moves;
  const result = m.advanceMarket(ctx, submitted);
  assert.ok(result.moves.signings.some(s => s.pid === skubal.id), result.news.join(' '));
});

test('rivals counter other rivals, but raises are bounded and invalid human bids do not move prices', () => {
  const start = game(), board = m.marketBoard(ctx, start), result = m.advanceMarket(ctx, start);
  let raises = 0;
  for (const signing of result.moves.market.deals) {
    const initial = board.find(p => p.pid === signing.pid).rivals.find(r => r.team === signing.team);
    assert.ok(signing.total <= initial.total * 1.06 + .051);
    assert.ok(signing.total <= initial.ceiling);
    if (signing.total > initial.total) raises++;
  }
  assert.ok(raises > 0, 'clubs compete without a human bidder');
  const skubal = row('Tarik Skubal');
  const invalid = m.submitMarketBid(ctx, start, { pid: skubal.id, years: 10, total: 8 }).moves;
  assert.deepEqual(m.advanceMarket(ctx, invalid).moves.market.deals, result.moves.market.deals);
});

test('over-budget offers can win, but the season waits for payroll repair; late undo preserves rival deals', () => {
  const start = game(), skubal = row('Tarik Skubal');
  start.budget = g.payrollFor(ctx, g.buildLeague(ctx, start), start.team) + 5;
  assert.equal(g.seasonReadiness(ctx, start).ready, false, 'open bidding blocks simulation');
  let current = m.submitMarketBid(ctx, start, { pid: skubal.id, years: 10, total: 700 }).moves;
  for (let i = 0; i < 3; i++) current = m.advanceMarket(ctx, current).moves;
  assert.ok(current.signings.some(s => s.pid === skubal.id));
  const check = g.seasonReadiness(ctx, current);
  assert.equal(check.marketOpen, false);
  assert.equal(check.ready, false);
  assert.ok(Math.abs(check.shortfall - 65) < 1e-8);
  const restored = g.restoreMoves(ctx, g.decodeMoves(g.encodeMoves(current)));
  assert.ok(restored.moves, restored.reason);
  assert.equal(g.seasonReadiness(ctx, restored.moves).ready, false);
  const undone = g.undoMove(ctx, current, 'signing', 0).moves;
  assert.deepEqual(undone.market, current.market);
  assert.equal(g.seasonReadiness(ctx, undone).ready, true);
  assert.ok(g.buildLeague(ctx, undone).freeAgents.has(ctx.players.find(p => p.pid === skubal.id).i));
});

test('competitive late signings defer the budget check; a salary-clearing trade can unlock the season', () => {
  const start = { ...game(), budget: 240, market: { ...m.newMarket(), round: 3 } };
  const league = g.buildLeague(ctx, start), player = row('Freddy Peralta'), ask = g.askFor(player, start.seed);
  assert.equal(g.signFreeAgent(ctx, league, start, start.budget, player, { years: ask.minYears, total: ask.total }, start.seed).accepted, true);
  const id = name => Object.entries(ctx.sim.players).find(([, p]) => p.n === name)[0];
  const proposal = { partner: 'BAL', give: [id('Trevor Story'), id('Roman Anthony')], get: [] };
  const answer = g.respondToTrade(ctx, league, start, start.budget, proposal, g.teamModes(ctx, league.teamOf));
  assert.equal(answer.accepted, true, answer.reason);
  assert.equal(g.seasonReadiness(ctx, start).ready, false);
  assert.equal(g.seasonReadiness(ctx, { ...start, trades: [proposal] }).ready, true);
  assert.equal(g.seasonReadiness(ctx, { ...start, budget: 200, trades: [proposal] }).ready, false, 'partial salary relief is not enough');
});

test('weak bids lose to actual rival offers and signed players leave the market', () => {
  const start = game(), skubal = row('Tarik Skubal');
  const submitted = m.submitMarketBid(ctx, start, { pid: skubal.id, years: 10, total: 8 }).moves;
  const result = m.advanceMarket(ctx, submitted);
  const signing = result.moves.market.deals.find(s => s.pid === skubal.id);
  assert.ok(signing);
  const board = m.marketBoard(ctx, start).find(p => p.pid === skubal.id);
  assert.ok(signing.total <= board.rivals.find(r => r.team === signing.team).ceiling);
  const league = g.buildLeague(ctx, result.moves);
  assert.equal(league.owner.get(skubal.id), signing.team);
  assert.equal(ctx.players.filter(p => p.pid === skubal.id).some(p => league.freeAgents.has(p.i)), false);
  assert.equal(m.submitMarketBid(ctx, result.moves, { pid: skubal.id, years: 10, total: 700 }).accepted, false);
});

test('counteroffers carry into the next round and survive saved-game replay', () => {
  const start = game(), player = row('Seiya Suzuki');
  const submitted = m.submitMarketBid(ctx, start, { pid: player.id, years: 3, total: 70 }).moves;
  const next = m.advanceMarket(ctx, submitted).moves;
  assert.ok(next.market.offers.length > 0);
  const board = m.marketBoard(ctx, next);
  let retained = 0;
  for (const entry of board) for (const rival of entry.rivals) {
    const previous = next.market.offers.find(o => o.pid === entry.pid && o.team === rival.team);
    if (previous && previous.total <= rival.ceiling) { retained++; assert.ok(rival.total >= previous.total); }
  }
  assert.ok(retained > 0);
  const restored = g.restoreMoves(ctx, g.decodeMoves(g.encodeMoves(next)));
  assert.ok(restored.moves, restored.reason);
  assert.deepEqual(m.marketBoard(ctx, restored.moves), board);
});

test('closing the market records late signings, honors budgets, and replays via a share link', () => {
  const start = game(), before = g.buildLeague(ctx, start);
  let current = start, news = [];
  for (let i = 0; i < 3; i++) { const result = m.advanceMarket(ctx, current); current = result.moves; news = result.news; }
  assert.equal(current.market.round, 3);
  assert.equal(current.market.bids.length, 0);
  assert.ok(current.market.deals.length > 20);
  assert.match(news.join(' '), /Late signing/);
  assert.equal(new Set(current.market.deals.map(d => d.pid)).size, current.market.deals.length);
  const after = g.buildLeague(ctx, current);
  assert.equal(after.freeAgents.size, 0, 'the normal market clears instead of stranding affordable players');
  assert.ok(current.market.deals.some(d => d.closeout && d.total < g.askFor(ctx.tracker.players.find(r => r.id === d.pid), start.seed).total));
  for (const team of Object.keys(ctx.sim.teams).filter(t => t !== start.team)) {
    assert.ok(g.payrollFor(ctx, after, team) <= Math.max(g.payrollFor(ctx, before, team), ctx.sim.teams[team].cbt2026 * 1.02) + 1e-7, team);
  }
  const decoded = g.decodeMoves(g.encodeMoves(current));
  assert.deepEqual(decoded, current);
  const restored = g.restoreMoves(ctx, decoded);
  assert.ok(restored.moves, restored.reason);
  assert.deepEqual(restored.moves, current);
  assert.deepEqual(m.standingPatMarket(ctx, start), current);
  assert.deepEqual(m.advanceMarket(ctx, current).moves, current);
});

test('a below-ask final offer can win the closeout and survives save/restore', () => {
  const start = game(), player = row('Sonny Gray'), ask = g.askFor(player, start.seed);
  const bid = { pid: player.id, years: 1, total: Math.round((ask.total - .1) * 10) / 10 };
  assert.equal(g.respondToOffer(player, bid, start.seed).accepted, false);
  let current = m.submitMarketBid(ctx, start, bid).moves;
  for (let i = 0; i < 3; i++) current = m.advanceMarket(ctx, current).moves;
  const signing = current.signings.find(s => s.pid === player.id);
  assert.ok(signing, 'a final offer just below the old ask beats the discounted rival market');
  assert.equal(signing.closeout, true);
  assert.ok(g.restoreMoves(ctx, current).moves);
  assert.equal([...current.signings, ...current.market.deals].filter(s => s.pid === player.id).length, 1);
});

test('malformed market saves and duplicate commitments are rejected', () => {
  const start = game();
  assert.equal(g.decodeMoves(g.encodeMoves({ ...start, market: { ...start.market, round: 4 } })), null);
  const bid = { pid: row('Tarik Skubal').id, years: 10, total: 450 };
  assert.equal(g.decodeMoves(g.encodeMoves({ ...start, market: { ...start.market, bids: [bid, bid] } })), null);
  assert.equal(g.decodeMoves(g.encodeMoves({ ...start, market: { round: 1, bids: [], deals: [{ ...bid, team: 'BOS', round: 1 }] } })), null);
  assert.equal(g.decodeMoves(g.encodeMoves({ ...start, market: { round: 3, bids: [bid], deals: [] } })), null);
});

test('late signings cannot bypass a competitive club’s need-based spending limit', () => {
  const start = game(), league = g.buildLeague(ctx, start), modes = g.teamModes(ctx, league.teamOf);
  const cleanup = g.aiFreeAgency(ctx, league, start, start.seed);
  const replay = game();
  for (const deal of cleanup.signings) {
    const before = g.buildLeague(ctx, replay), player = ctx.tracker.players.find(r => r.id === deal.pid);
    const roster = g.rosterOf(ctx, before.teamOf, deal.team);
    const gain = allocate([...roster, ...ctx.players.filter(p => p.pid === deal.pid)]).total - allocate(roster).total;
    const rate = modes[deal.team] === 'contend' ? 14 : 11;
    const taste = .94 + .12 * g.hash(`${start.seed}:${deal.pid}:${deal.team}:taste`) / 0xffffffff;
    const ceiling = Math.min(player.aav * 1.35, (gain * rate + 5) * taste);
    assert.ok(deal.total / deal.years <= ceiling + 1e-8, player.name);
    replay.market.deals.push({ ...deal, round: 3 });
  }
});
