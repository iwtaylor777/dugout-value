import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import * as g from '../lib/gm-sim.mjs';
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ctx = { players: read('../app/data/depth-chart.json').players, tracker: read('../app/data/free-agent-tracker.json'), signings: read('../app/data/free-agent-signings.json'), sim: read('../app/data/gm-sim.json'), payroll: read('../app/data/team-payroll.json').cbt };
const id = n => Object.entries(ctx.sim.players).find(([, v]) => v.n === n)[0];
const fa = n => ctx.tracker.players.find(r => r.name === n);
const base = { team: 'BOS', seed: 42, signings: [], trades: [] };

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
