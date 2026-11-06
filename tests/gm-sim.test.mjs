import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import * as g from '../lib/gm-sim.mjs';
import { allocate } from '../lib/depth-chart.mjs';
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ctx = { players: read('../app/data/depth-chart.json').players, tracker: read('../app/data/free-agent-tracker.json'), signings: read('../app/data/free-agent-signings.json'), sim: read('../app/data/gm-sim.json'), payroll: read('../app/data/team-payroll.json').cbt };
const id = n => Object.entries(ctx.sim.players).find(([, v]) => v.n === n)[0];
const fa = n => ctx.tracker.players.find(r => r.name === n);
const base = { team: 'BOS', seed: 42, signings: [], trades: [] };

test('trade cash changes both budgets and trade value, survives sharing, and reverses on undo', () => {
  const before = g.buildLeague(ctx, base);
  const trade = { partner: 'BAL', give: [id('Trevor Story')], get: [], cash: 30 };
  const noCash = { ...base, trades: [{ ...trade, cash: 0 }] };
  const moves = { ...base, trades: [trade] }, after = g.buildLeague(ctx, moves), without = g.buildLeague(ctx, noCash);
  assert.ok(Math.abs(g.payrollFor(ctx, after, 'BOS') - g.payrollFor(ctx, without, 'BOS') - 30) < 1e-8);
  assert.ok(Math.abs(g.payrollFor(ctx, after, 'BAL') - g.payrollFor(ctx, without, 'BAL') + 30) < 1e-8);
  assert.equal(g.movesValue(ctx, moves).trades, g.movesValue(ctx, noCash).trades - 30);
  const modes = g.teamModes(ctx, before.teamOf);
  assert.equal(g.respondToTrade(ctx, before, base, 400, { ...trade, cash: 0 }, modes).accepted, false);
  assert.equal(g.respondToTrade(ctx, before, base, 400, trade, modes).accepted, true);
  const restored = g.restoreMoves(ctx, g.decodeMoves(g.encodeMoves(moves)));
  assert.ok(restored.moves, restored.reason);
  assert.equal(restored.moves.trades[0].cash, 30);
  const undone = g.undoMove(ctx, restored.moves, 'trade', 0).moves;
  assert.equal(g.payrollFor(ctx, g.buildLeague(ctx, undone), 'BOS'), g.payrollFor(ctx, before, 'BOS'));
  for (const cash of [NaN, Infinity, 101, -101, '20']) {
    assert.equal(g.respondToTrade(ctx, before, base, 400, { ...trade, cash }, modes).accepted, false);
    if (typeof cash === 'string' || Number.isFinite(cash)) assert.equal(g.decodeMoves(g.encodeMoves({ ...base, trades: [{ ...trade, cash }] })), null);
  }
  const received = { ...base, trades: [{ partner: 'BAL', give: [id('Roman Anthony')], get: [], cash: -10 }] };
  assert.equal(g.restoreMoves(ctx, received).moves.trades[0].cash, -10);
  assert.ok(Math.abs(g.payrollFor(ctx, g.buildLeague(ctx, received), 'BOS') - g.payrollFor(ctx, g.buildLeague(ctx, { ...base, trades: [{ ...received.trades[0], cash: 0 }] }), 'BOS') + 10) < 1e-8);
});

test('contract display separates annual salary, CBT budget charge, estimates and options', () => {
  const league = g.buildLeague(ctx, base), story = g.playerContract(ctx, league, id('Trevor Story'));
  assert.equal(story.salary, 25);
  assert.equal(story.hit, 23.33);
  assert.equal(story.seasons.find(s => s.year === 2028).type, 'clubOption');
  const anthony = g.playerContract(ctx, league, id('Roman Anthony'));
  assert.equal(anthony.hit, 16.25);
  assert.equal(anthony.salary, 4.63);
  assert.ok(g.playerContract(ctx, league, id('Gunnar Henderson')).seasons.every(s => s.type.startsWith('arb')));
  const prospect = g.playerContract(ctx, league, id('Franklin Arias'));
  assert.equal(prospect.prospect, true);
  assert.equal(prospect.hit, 0);
});

test('data covers 30 teams in six divisions and every depth-chart player', () => {
  assert.equal(Object.keys(ctx.sim.teams).length, 30);
  assert.equal(new Set(Object.values(ctx.sim.teams).map(t => t.division)).size, 6);
  for (const p of ctx.players) if (!p.fa || p.t) assert.ok(ctx.sim.players[p.pid] || p.fa, p.n);
});

test('free agents accept offers at or above a seeded private ask, and ownership enforces the budget', () => {
  const row = fa('Freddy Peralta'), ask = g.askFor(row, 42);
  assert.deepEqual(g.askFor(row, 42), ask, 'deterministic');
  assert.equal(g.respondToOffer(row, { years: ask.minYears, total: ask.total }, 42).accepted, true);
  assert.equal(g.respondToOffer(row, { years: ask.minYears, total: ask.total - 1 }, 42).accepted, false);
  assert.equal(g.respondToOffer(row, { years: Math.max(1, ask.minYears - 1), total: ask.total * 2 }, 42).accepted, ask.minYears === 1);
  const league = g.buildLeague(ctx, base);
  const tight = g.signFreeAgent(ctx, league, base, 100, row, { years: ask.minYears, total: ask.total }, 42);
  assert.equal(tight.accepted, false);
  assert.match(tight.reason, /ownership/);
});

test('trade responses honour no-trade clauses, star premiums and fairness', () => {
  const league = g.buildLeague(ctx, base), modes = g.teamModes(ctx, league.teamOf);
  assert.match(g.respondToTrade(ctx, league, base, 400, { partner: 'NYY', give: [id('Curtis Mead')], get: [id('Aaron Judge')] }, modes).reason, /no-trade/);
  assert.equal(g.respondToTrade(ctx, league, base, 400, { partner: 'PIT', give: [id('Curtis Mead')], get: [id('Paul Skenes')] }, modes).accepted, false);
  // A pure gift is accepted unless salary blocks it.
  const gift = g.respondToTrade(ctx, league, base, 400, { partner: 'PIT', give: [id('Roman Anthony')], get: [] }, modes);
  assert.equal(gift.accepted, true, gift.reason);
});

test('stars with years of control cost well beyond fair value; rentals on bad teams go near fair value', () => {
  const league = g.buildLeague(ctx, base), modes = g.teamModes(ctx, league.teamOf);
  const ask = (partner, give, get) => g.respondToTrade(ctx, league, base, 400, { partner, give: give.map(id), get: get.map(id) }, modes);
  assert.equal(modes.WSN, 'rebuild');
  // James Wood has four years of control. A package worth more than him to a rebuilding team still isn't enough.
  const wood = ask('WSN', ['Payton Tolle', 'Franklin Arias'], ['James Wood']);
  assert.ok(wood.received > ctx.sim.players[id('James Wood')].v05, 'offer beats his value');
  assert.equal(wood.accepted, false);
  assert.match(wood.reason, /well beyond fair value/);
  // Yordan Alvarez has two years left on a rebuilding team: a fair offer works.
  assert.equal(modes.HOU, 'rebuild');
  const yordan = ask('HOU', ['Wilyer Abreu', 'Curtis Mead'], ['Yordan Alvarez']);
  assert.equal(yordan.accepted, true, yordan.reason);
  assert.ok(yordan.received < 1.5 * ctx.sim.players[id('Yordan Alvarez')].v05);
});

test('contenders want MLB-ready talent back for a regular, not just prospects', () => {
  const league = g.buildLeague(ctx, base), modes = g.teamModes(ctx, league.teamOf);
  assert.equal(modes.PHI, 'contend');
  const wheeler = g.respondToTrade(ctx, league, base, 400, { partner: 'PHI', give: [id('Franklin Arias')], get: [id('Zack Wheeler')] }, modes);
  assert.ok(wheeler.received >= wheeler.need, 'the value alone would do it');
  assert.equal(wheeler.accepted, false);
  assert.match(wheeler.reason, /MLB-ready/);
  // A backup at a position where they have depth can go for a prospect.
  const backup = g.respondToTrade(ctx, league, base, 400, { partner: 'LAD', give: [id('Justin Gonzales')], get: [id('Hunter Feduccia')] }, modes);
  assert.equal(backup.accepted, true, backup.reason);
});

test('a moved player changes teams and payroll follows him', () => {
  const moves = { ...base, trades: [{ partner: 'PIT', give: [id('Roman Anthony')], get: [] }] };
  const before = g.buildLeague(ctx, base), after = g.buildLeague(ctx, moves);
  assert.equal(after.owner.get(id('Roman Anthony')), 'PIT');
  assert.ok(g.payrollFor(ctx, after, 'BOS') < g.payrollFor(ctx, before, 'BOS') - 10);
  assert.ok(g.payrollFor(ctx, after, 'PIT') > g.payrollFor(ctx, before, 'PIT') + 10);
});

test('season simulation is seeded, centred on 81 wins and fills 12 playoff spots', () => {
  const league = g.buildLeague(ctx, base), st = g.teamStrengths(ctx, league.teamOf);
  const a = g.simulateSeasons(ctx, st, 2000, 5), b = g.simulateSeasons(ctx, st, 2000, 5);
  assert.deepEqual(a, b);
  const teams = Object.values(a);
  assert.ok(Math.abs(teams.reduce((s, t) => s + t.mean, 0) / 30 - 81) < 0.01);
  assert.ok(Math.abs(teams.reduce((s, t) => s + t.playoffs, 0) - 12) < 1e-9);
  assert.ok(Math.abs(teams.reduce((s, t) => s + t.division, 0) - 6) < 1e-9);
  assert.ok(Math.abs(teams.reduce((s, t) => s + t.title, 0) - 1) < 1e-9);
  const sd = Object.values(st).map(s => s.sd).sort((x, y) => x - y)[15];
  assert.ok(sd > 5 && sd < 7.5, `team performance spread ${sd}`);
});

test('AI free agency only signs players to teams that can afford them', () => {
  const league = g.buildLeague(ctx, base), ai = g.aiFreeAgency(ctx, league, base, 42);
  assert.ok(ai.signings.length > 20);
  for (const s of ai.signings) assert.notEqual(s.team, 'BOS');
  for (const t of Object.keys(ctx.sim.teams)) if (t !== 'BOS') assert.ok(g.payrollFor(ctx, ai.league, t, ai.league.extraAav) <= Math.max(ctx.sim.teams[t].cbt2026 * 1.02, g.payrollFor(ctx, league, t)) + 0.5, t);
});

test('share links round-trip', () => {
  const moves = { team: 'SEA', budget: 210, seed: 99, signings: [{ pid: 'x', years: 2, total: 30 }], trades: [{ partner: 'BOS', give: ['a'], get: ['b'] }] };
  assert.deepEqual(g.decodeMoves(g.encodeMoves(moves)), moves);
  assert.equal(g.decodeMoves('not-valid'), null);
});

test('share decoder rejects malformed, nonfinite and duplicated move data', () => {
  for (const mutation of [
    { signings: [null] }, { trades: [null] }, { budget: -1 }, { seed: 0 },
    { signings: [{ pid: 'x', years: 0, total: 30 }] },
    { signings: [{ pid: 'x', years: 1.5, total: 30 }] },
    { signings: [{ pid: 'x', years: 1, total: Infinity }] },
    { trades: [{ partner: 'PIT', give: ['x', 'x'], get: ['y'] }] },
    { trades: [{ partner: 'PIT', give: ['x'], get: ['x'] }] },
  ]) assert.equal(g.decodeMoves(g.encodeMoves({ ...base, ...mutation })), null);
  assert.equal(g.restoreMoves(ctx, { ...base, team: 'ZZZ' }).moves, null);
  assert.ok(g.restoreMoves(ctx, base).moves);
});

test('no-trade clauses protect user players and duplicate trade assets cannot inflate value', () => {
  const moves = { ...base, team: 'NYY' }, league = g.buildLeague(ctx, moves), modes = g.teamModes(ctx, league.teamOf);
  const answer = g.respondToTrade(ctx, league, moves, 480, { partner: 'WSN', give: [id('Aaron Judge')], get: [] }, modes);
  assert.equal(answer.accepted, false); assert.match(answer.reason, /no-trade/);
  assert.equal(g.respondToTrade(ctx, league, moves, 480, { partner: 'ZZZ', give: [], get: ['fake'] }, modes).accepted, false);
  assert.equal(g.respondToTrade(ctx, league, moves, 480, { partner: 'WSN', give: [id('Aaron Judge'), id('Aaron Judge')], get: [] }, modes).accepted, false);
});

test('undo removes dependent trades but keeps independent moves', () => {
  const moves = { ...base, trades: [
    { partner: 'PIT', give: [id('Roman Anthony')], get: [id('Paul Skenes')] },
    { partner: 'WSN', give: [id('Paul Skenes')], get: [id('James Wood')] },
    { partner: 'WSN', give: [id('James Wood')], get: [] },
    { partner: 'PIT', give: [id('Curtis Mead')], get: [] },
  ] };
  const undo = g.undoMove(ctx, moves, 'trade', 0);
  assert.equal(undo.removed, 3);
  assert.equal(undo.moves.trades.length, 1);
  const league = g.buildLeague(ctx, undo.moves);
  assert.equal(league.owner.get(id('Roman Anthony')), 'BOS');
  assert.equal(league.owner.get(id('Paul Skenes')), 'PIT');
  assert.equal(league.owner.get(id('James Wood')), 'WSN');
  assert.equal(league.owner.get(id('Curtis Mead')), 'PIT');
});

test('free-agent engine rejects already owned players, duplicates and invalid contract numbers', () => {
  const row = fa('Freddy Peralta'), ask = g.askFor(row, 42);
  const signed = { ...base, signings: [{ pid: row.id, years: ask.minYears, total: ask.total }] };
  const league = g.buildLeague(ctx, signed);
  assert.equal(g.signFreeAgent(ctx, league, signed, 480, row, { years: ask.minYears, total: ask.total }, 42).accepted, false);
  assert.equal(g.respondToOffer(row, { years: 2.5, total: 100 }, 42).accepted, false);
  assert.equal(g.respondToOffer(row, { years: 5, total: Infinity }, 42).accepted, false);
});

test('extra contract years cannot dilute AAV at the same guaranteed asking price', () => {
  const row = fa('Tarik Skubal'), ask = g.askFor(row, 42);
  assert.equal(ask.maxYears, Math.min(13, row.years + 1));
  assert.equal(g.respondToOffer(row, { years: row.years, total: ask.total }, 42).accepted, true);
  assert.equal(g.respondToOffer(row, { years: ask.minYears, total: ask.total }, 42).accepted, true);
  const tooCheap = g.respondToOffer(row, { years: ask.maxYears, total: ask.total }, 42);
  assert.equal(tooCheap.accepted, false);
  assert.match(tooCheap.reason, /extra year needs more guaranteed money/);
  assert.equal(g.respondToOffer(row, { years: ask.maxYears, total: ask.total * ask.maxYears / row.years }, 42).accepted, true);
  assert.equal(g.respondToOffer(row, { years: ask.maxYears + 1, total: 999 }, 42).accepted, false);
});

test('paired regular-season draws stay identical even if playoff paths change', () => {
  const league = g.buildLeague(ctx, base), strengths = g.teamStrengths(ctx, league.teamOf);
  const edited = { ...strengths, BOS: { ...strengths.BOS, war: strengths.BOS.war + 10 } };
  const before = g.simulateSeasons(ctx, strengths, 500, 42);
  const after = g.simulateSeasons(ctx, edited, 500, 42);
  for (const team of Object.keys(strengths)) {
    const expected = team === 'BOS' ? 10 - 10 / 30 : -10 / 30;
    assert.ok(Math.abs(after[team].mean - before[team].mean - expected) < 1e-8, team);
  }
});

test('one player split between positions retains the same performance uncertainty', () => {
  const target = { i: 'target', pid: 'target', n: 'Target', t: 'BOS', k: 'b', e: ['LF'], r: 2, x: 600 };
  const blocker = { i: 'blocker', pid: 'blocker', n: 'Blocker', t: 'BOS', k: 'b', e: ['LF'], r: 3, x: 400 };
  const split = { ...ctx, players: [target, blocker] };
  const one = { ...ctx, players: [{ ...target, e: ['RF'] }, blocker] };
  assert.equal(Object.values(allocate(split.players).positions).filter(slot => slot.rows.some(row => row.p.i === 'target')).length, 2);
  const ownership = new Map([['target', 'BOS'], ['blocker', 'BOS']]);
  assert.equal(g.teamStrengths(split, ownership).BOS.sd, g.teamStrengths(one, ownership).BOS.sd);
});

test('trading an exercised option removes its reported payroll charge from the old team', () => {
  const pid = id('Drew Rasmussen'), moves = { ...base, team: 'TBR' };
  const before = g.buildLeague(ctx, moves);
  const after = g.buildLeague(ctx, { ...moves, trades: [{ partner: 'BOS', give: [pid], get: [] }] });
  assert.ok(Math.abs(g.payrollFor(ctx, before, 'TBR') - g.payrollFor(ctx, after, 'TBR') - 20) < 1e-9);
  assert.ok(Math.abs(g.payrollFor(ctx, after, 'BOS') - g.payrollFor(ctx, before, 'BOS') - 20) < 1e-9);
});

test('restore preserves valid sandbox budgets but rejects ownership theft', () => {
  assert.ok(g.restoreMoves(ctx, { ...base, budget: 60 }).moves, 'slider may sit below the starting payroll');
  assert.equal(g.restoreMoves(ctx, { ...base, trades: [{ partner: 'WSN', give: [id('Paul Skenes')], get: [id('James Wood')] }] }).moves, null);
});
