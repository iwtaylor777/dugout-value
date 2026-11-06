import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import * as g from '../lib/gm-sim.mjs';
import * as m from '../lib/gm-market.mjs';
import { allocate } from '../lib/depth-chart.mjs';
import { marketTracker } from '../lib/free-agent-current.mjs';
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ctx = { players: read('../app/data/depth-chart.json').players, tracker: marketTracker(read('../app/data/free-agent-tracker.json')), signings: read('../app/data/free-agent-signings.json'), sim: read('../app/data/gm-sim.json'), payroll: read('../app/data/team-payroll.json').cbt };
const game = () => ({ team: 'BOS', seed: 42, budget: 400, signings: [], trades: [], market: m.newMarket() });
const row = name => ctx.tracker.players.find(p => p.name === name);

test('personal offers remain visible through losses, closeout, withdrawal, undo and sharing', () => {
  const star = row('Tarik Skubal'), regular = row('Edmundo Sosa');
  let state = game();
  state = m.submitMarketBid(ctx, state, { pid: star.id, years: star.years, total: .8 * star.years }).moves;
  state = m.submitMarketBid(ctx, state, { pid: regular.id, years: 1, total: 20 }).moves;
  assert.equal(m.userOfferOutcomes(ctx, state).length, 2);
  assert.ok(m.userOfferOutcomes(ctx, state).every(o => o.status === 'submitted'));
  const withdrawn = m.withdrawMarketBid(state, star.id);
  assert.equal(m.userOfferOutcomes(ctx, withdrawn).find(o => o.offer.pid === star.id).status, 'withdrawn');
  assert.equal(withdrawn.market.bids.length, 1);
  for (let i = 0; i < 3; i++) state = m.advanceMarket(ctx, state).moves;
  const outcomes = m.userOfferOutcomes(ctx, state);
  assert.equal(outcomes.find(o => o.offer.pid === regular.id).status, 'signed');
  const lost = outcomes.find(o => o.offer.pid === star.id);
  assert.equal(lost.status, 'lost');
  assert.ok(lost.deal.team !== state.team && lost.deal.total > lost.offer.total);
  const restored = g.restoreMoves(ctx, g.decodeMoves(g.encodeMoves(state)));
  assert.ok(restored.moves, restored.reason);
  assert.deepEqual(m.userOfferOutcomes(ctx, restored.moves), outcomes);
  const undone = g.undoMove(ctx, state, 'signing', state.signings.findIndex(s => s.pid === regular.id)).moves;
  assert.equal(m.userOfferOutcomes(ctx, undone).find(o => o.offer.pid === regular.id).status, 'undone');
});

test('revised bids replace their history and malformed histories are rejected', () => {
  const p = row('Edmundo Sosa');
  let state = m.submitMarketBid(ctx, game(), { pid: p.id, years: 1, total: 8 }).moves;
  state = m.submitMarketBid(ctx, state, { pid: p.id, years: 1, total: 10 }).moves;
  assert.equal(state.market.history.length, 1);
  assert.equal(state.market.history[0].total, 10);
  for (const history of [[{ ...state.market.history[0], total: -1 }], [state.market.history[0], state.market.history[0]], [{ ...state.market.history[0], round: 4 }]]) {
    assert.equal(g.decodeMoves(g.encodeMoves({ ...state, market: { ...state.market, history } })), null);
  }
});

test('older saves keep known offers when another bid is submitted or withdrawn', () => {
  const p = row('Edmundo Sosa'), star = row('Tarik Skubal');
  const old = { ...game(), market: { round: 0, bids: [{ pid: p.id, years: 1, total: 20 }], deals: [], offers: [] } };
  const next = m.submitMarketBid(ctx, old, { pid: star.id, years: star.years, total: star.total }).moves;
  assert.equal(m.userOfferOutcomes(ctx, next).length, 2);
  assert.equal(m.userOfferOutcomes(ctx, m.withdrawMarketBid(old, p.id))[0].status, 'withdrawn');
  const signed = { ...old, signings: old.market.bids, market: { ...old.market, round: 3, bids: [] } };
  assert.equal(m.userOfferOutcomes(ctx, g.undoMove(ctx, signed, 'signing', 0).moves)[0].status, 'undone');
});

test('final-round cleanup reports destinations even when a player was not won in the auctions', () => {
  const p = row('Sonny Gray');
  let state = { ...game(), market: { ...m.newMarket(), round: 2 } };
  state = m.submitMarketBid(ctx, state, { pid: p.id, years: 1, total: .8 }).moves;
  state = m.advanceMarket(ctx, state).moves;
  const outcome = m.userOfferOutcomes(ctx, state)[0];
  assert.ok(['lost', 'unsigned'].includes(outcome.status));
  if (outcome.status === 'lost') assert.deepEqual(outcome.deal, state.market.deals.find(d => d.pid === p.id));
  assert.equal(outcome.offer.total, .8);
});

test('FA reserves stay inside existing budgets and remain usable for trades', () => {
  const state = game(), league = g.buildLeague(ctx, state);
  for (const team of Object.keys(ctx.sim.teams)) {
    const plan = g.rivalBudget(ctx, league, team, state.seed);
    assert.equal(plan.limit, ctx.sim.teams[team].cbt2026 * 1.02);
    assert.ok(plan.reserve >= 5 && plan.reserve <= 15);
    assert.ok(Math.abs(plan.faLimit + plan.reserve - plan.limit) < 1e-8);
    assert.equal(plan.room, Math.max(0, plan.limit - plan.payroll));
    assert.deepEqual(plan, g.rivalBudget(ctx, league, team, state.seed));
  }
});

test('closeout floors prevent implausible star deals even when rival budgets are exhausted', () => {
  const start = game(), league = g.buildLeague(ctx, start), star = row('Tarik Skubal');
  const cramped = { ...ctx, sim: { ...ctx.sim, teams: Object.fromEntries(Object.entries(ctx.sim.teams).map(([t, info]) => [t, { ...info, cbt2026: (g.payrollFor(ctx, league, t) + .8) / 1.02 }])) } };
  start.market.round = 2;
  const submitted = m.submitMarketBid(cramped, start, { pid: star.id, years: 1, total: .8 }).moves;
  const result = m.advanceMarket(cramped, submitted);
  assert.ok(![...result.moves.signings, ...result.moves.market.deals].some(s => s.pid === star.id));
  assert.match(result.news.find(n => n.startsWith('Tarik Skubal did not')), /credible offer/);
  const forged = { ...game(), signings: [{ pid: star.id, years: 1, total: .8, closeout: true }], market: { ...m.newMarket(), round: 3 } };
  assert.equal(g.restoreMoves(ctx, forged).moves, null, 'saved games cannot bypass the floor');
  assert.ok(g.closeoutMinimumAav(star, 1, 42) >= .65 * star.aav);
  assert.ok(g.closeoutMinimumAav(star, 10, 42) >= .75 * star.aav);
});

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
  answer = m.submitMarketBid(ctx, start, { pid: jazz.id, years: jazz.years, total: jazz.years*20 });
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
  for (const signing of [...result.moves.market.deals, ...result.moves.market.offers]) {
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
  assert.deepEqual(undone.market.deals, current.market.deals);
  assert.deepEqual(undone.market.offers, current.market.offers);
  assert.equal(undone.market.round, current.market.round);
  assert.equal(undone.market.history[0].undone, true);
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
  // Public market asks can exceed every club's spending/fit ceiling. The
  // closeout must report that outcome rather than force a star into a minimum deal.
  const remaining = new Set(ctx.players.filter(p => after.freeAgents.has(p.i)).map(p => p.pid));
  for (const pid of remaining) {
    const player = ctx.tracker.players.find(p => p.id === pid);
    assert.ok(g.closeoutMinimumAav(player, 1, start.seed) > .8, player.name);
    assert.ok(news.some(line => line.startsWith(`${player.name} did not find a credible offer`)), player.name);
  }
  for (const deal of current.market.deals.filter(d => d.closeout)) {
    const player = ctx.tracker.players.find(p => p.id === deal.pid);
    assert.ok(deal.total / deal.years + 1e-9 >= g.closeoutMinimumAav(player, deal.years, start.seed), player.name);
  }
  assert.ok(current.market.deals.some(d => d.closeout && d.total < g.askFor(ctx.tracker.players.find(r => r.id === d.pid), start.seed).total));
  for (const team of Object.keys(ctx.sim.teams).filter(t => t !== start.team)) {
    assert.ok(g.payrollFor(ctx, after, team) <= Math.max(g.payrollFor(ctx, before, team), ctx.sim.teams[team].cbt2026 * 1.02) + 1e-7, team);
  }
  const rivalPlans = Object.keys(ctx.sim.teams).filter(t => t !== start.team).map(t => g.rivalBudget(ctx, after, t, start.seed));
  assert.ok(rivalPlans.filter(p => p.room >= 5 - 1e-8).length >= 5, 'the closed market retains multiple salary-dump destinations');
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
