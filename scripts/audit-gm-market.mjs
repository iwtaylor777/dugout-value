// Repeatable game-behavior audit, not a calibration to real free-agent decisions.
import fs from 'node:fs';
import { allocate } from '../lib/depth-chart.mjs';
import * as g from '../lib/gm-sim.mjs';
import * as m from '../lib/gm-market.mjs';
import { marketTracker } from '../lib/free-agent-current.mjs';
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ctx = { players: read('../app/data/depth-chart.json').players, tracker: marketTracker(read('../app/data/free-agent-tracker.json')), signings: read('../app/data/free-agent-signings.json'), sim: read('../app/data/gm-sim.json'), payroll: read('../app/data/team-payroll.json').cbt };
const results = [];
const seed = Number(process.env.GM_AUDIT_SEED ?? 42);
for (const team of ['BOS', 'LAD', 'SEA', 'MIL', 'ATH', 'COL']) for (const room of [5, 25, 75]) {
  let game = { team, seed, budget: 480, signings: [], trades: [], market: m.newMarket() };
  const original = g.buildLeague(ctx, game), pay = g.payrollFor(ctx, original, team);
  game.budget = Math.min(480, Math.ceil(pay + room));
  const roster = g.rosterOf(ctx, original.teamOf, team), war = allocate(roster).total;
  const board = m.marketBoard(ctx, game);
  const candidates = ctx.tracker.players.flatMap(row => {
    if (!ctx.players.some(p => p.pid === row.id && original.freeAgents.has(p.i))) return [];
    const years = row.years ?? 1, total = Math.ceil(g.askFor(row, game.seed).total * 1.08 * 10) / 10;
    if (total / years > game.budget - pay) return [];
    const gain = allocate([...roster, ...ctx.players.filter(p => p.pid === row.id)]).total - war;
    return [{ row, bid: { pid: row.id, years, total }, gain }];
  }).sort((a, b) => b.gain - a.gain);
  const target = candidates[0];
  const market = target && board.find(p => p.pid === target.row.id);
  if (target) {
    const answer = m.submitMarketBid(ctx, game, target.bid);
    if (!answer.accepted) throw new Error(answer.reason);
    game = answer.moves;
  }
  const violations = [];
  for (let round = 0; round < 3; round++) {
    game = m.advanceMarket(ctx, game).moves;
    const league = g.buildLeague(ctx, game);
    if (new Set([...game.signings, ...game.market.deals].map(s => s.pid)).size !== game.signings.length + game.market.deals.length) violations.push('duplicate player');
    for (const club of Object.keys(ctx.sim.teams)) {
      const limit = club === team ? game.budget : Math.max(g.payrollFor(ctx, original, club), ctx.sim.teams[club].cbt2026 * 1.02);
      if (g.payrollFor(ctx, league, club) > limit + 1e-7) violations.push(`over budget: ${club}`);
    }
  }
  const outcome = target && [...game.signings.map(s => ({ ...s, team })), ...game.market.deals].find(s => s.pid === target.row.id);
  const rivals = market?.rivals ?? [];
  results.push({ team, budget: game.budget, startingPayroll: +pay.toFixed(1), room, target: target?.row.name, gain: +target?.gain.toFixed(2), offer: target?.bid.total, rivals: rivals.length, openingLeader: rivals.length ? +Math.max(...rivals.map(r => r.total)).toFixed(1) : null, result: outcome?.team ?? 'unsigned', finalPrice: outcome?.total, signings: game.market.deals.length, violations });
}
console.log(JSON.stringify({ seed, scenarios: results.length, won: results.filter(r => r.result === r.team).length, budgetViolations: results.flatMap(r => r.violations).length, results }, null, 2));
