// Repeatable adversarial audit of gameplay, not an empirical market calibration.
import fs from 'node:fs';
import * as g from '../lib/gm-sim.mjs';
import * as m from '../lib/gm-market.mjs';
const read = name => JSON.parse(fs.readFileSync(new URL(`../app/data/${name}.json`, import.meta.url)));
const ctx = { players: read('depth-chart').players, tracker: read('free-agent-tracker'), signings: read('free-agent-signings'), sim: read('gm-sim'), payroll: read('team-payroll').cbt };
const scenarios = [], failures = [];
for (const team of ['BOS', 'LAD', 'SEA', 'ATH']) for (const seed of [42, 137, 901]) {
  let game = { team, seed, budget: 480, signings: [], trades: [], market: m.newMarket() };
  const before = g.buildLeague(ctx, game);
  game.budget = Math.min(480, Math.ceil(g.payrollFor(ctx, before, team) + (seed === 42 ? 5 : seed === 137 ? 25 : 75)));
  for (let round = 0; round < 2; round++) game = m.advanceMarket(ctx, game).moves;
  const available = g.buildLeague(ctx, game);
  for (const row of ctx.tracker.players.filter(r => (r.war2027 >= 2 || r.aav >= 15) && ctx.players.some(p => p.pid === r.id && available.freeAgents.has(p.i)))) {
    const submitted = m.submitMarketBid(ctx, game, { pid: row.id, years: 1, total: .8 });
    if (submitted.accepted) game = submitted.moves;
  }
  game = m.advanceMarket(ctx, game).moves;
  const league = g.buildLeague(ctx, game), deals = [...game.signings, ...game.market.deals];
  const stars = deals.filter(s => { const r = ctx.tracker.players.find(r => r.id === s.pid); return r.war2027 >= 3 || r.aav >= 25; });
  const starRatios = stars.map(s => s.total / s.years / ctx.tracker.players.find(r => r.id === s.pid).aav);
  const badBudgets = Object.keys(ctx.sim.teams).filter(t => t !== team && g.payrollFor(ctx, league, t) > Math.max(g.payrollFor(ctx, before, t), ctx.sim.teams[t].cbt2026 * 1.02) + 1e-8);
  const restored = g.restoreMoves(ctx, g.decodeMoves(g.encodeMoves(game)));
  const result = { team, seed, budget: game.budget, remaining: league.freeAgents.size, lowballWins: game.signings.length, duplicates: deals.length - new Set(deals.map(s => s.pid)).size, badBudgets, restores: !!restored.moves, cheapestStarRatio: +Math.min(...starRatios).toFixed(3) };
  scenarios.push(result);
  if (result.lowballWins || result.duplicates || badBudgets.length || !restored.moves || result.cheapestStarRatio < .65) failures.push(result);
}
let cashAttempts = 0, cashAccepted = 0;
for (const team of ['BOS', 'LAD', 'SEA', 'ATH']) {
  const base = { team, seed: 42, budget: 480, signings: [], trades: [], market: m.newMarket() };
  const league = g.buildLeague(ctx, base), modes = g.teamModes(ctx, league.teamOf);
  for (const [pid, p] of Object.entries(ctx.sim.players).filter(([pid, p]) => p.v10 >= 25 && p.prot !== 'full' && league.owner.get(pid) && league.owner.get(pid) !== team)) {
    cashAttempts++;
    const proposal = { partner: league.owner.get(pid), give: [], get: [pid], cash: 100 };
    if (g.respondToTrade(ctx, league, base, 480, proposal, modes).accepted) { cashAccepted++; failures.push({ cashPurchase: p.n, team }); }
  }
}
console.log(JSON.stringify({ scenarios, cashAttempts, cashAccepted, failures }, null, 2));
if (failures.length) process.exitCode = 1;
