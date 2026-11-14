import fs from 'node:fs';
import * as g from '../lib/gm-sim.mjs';
import * as m from '../lib/gm-market.mjs';
import { marketTracker } from '../lib/free-agent-current.mjs';
const read = name => JSON.parse(fs.readFileSync(new URL(`../app/data/${name}.json`, import.meta.url)));
const ctx = { players: read('depth-chart').players, tracker: marketTracker(read('free-agent-tracker')), signings: read('free-agent-signings'),trades:read('trades'), sim: read('gm-sim'), payroll: read('team-payroll').cbt };
const scenarios = [];
for (const team of ['BOS', 'LAD', 'SEA', 'ATH']) for (const seed of [42, 137, 901]) {
  let moves = { team, seed, signings: [], trades: [], market: m.newMarket() };
  const before = g.buildLeague(ctx, moves);
  for (let round = 0; round < 3; round++) moves = m.advanceMarket(ctx, moves).moves;
  const league = g.buildLeague(ctx, moves), modes = g.teamModes(ctx, league.teamOf);
  const budgets = Object.keys(ctx.sim.teams).filter(t => t !== team).map(t => ({ team: t, ...g.rivalBudget(ctx, league, t, seed) })).sort((a,b) => b.room - a.room);
  const budgetViolations = budgets.filter(p => p.payroll > Math.max(g.payrollFor(ctx, before, p.team), p.limit - 5) + 1e-8).map(p => p.team);
  const own = Object.entries(ctx.sim.players).filter(([pid,p]) => league.owner.get(pid) === team && p.prot !== 'full');
  const prospects = own.filter(([,p]) => p.k === 'p' && p.v10 > 0 && p.v10 <= 50).sort((a,b) => a[1].v10-b[1].v10).filter((_,i)=>i%4===0).slice(0,5);
  let dump = null;
  for (const [pid,p] of own.filter(([pid,p]) => p.k === 'm' && p.v10 < 0 && g.playerContract(ctx,league,pid).hit >= 5).slice(0,3)) {
    if (dump) break;
    for (const plan of budgets.filter(b=>b.room>=5).slice(0,8)) {
      if (dump) break;
      for (const cash of [0,5,10,15]) {
        if (dump) break;
        for (const prospect of [null,...prospects]) {
          const proposal={partner:plan.team,give:[pid,...(prospect?[prospect[0]]:[])],get:[],cash};
          const answer=g.respondToTrade(ctx,league,moves,480,proposal,modes);
          if (!answer.accepted) continue;
          const cleared=g.payrollFor(ctx,league,team)-g.payrollFor(ctx,g.buildLeague(ctx,{...moves,trades:[proposal]}),team);
          if (cleared>=5) {dump={player:p.n,prospect:prospect?.[1].n??null,partner:plan.team,cash,cleared:+cleared.toFixed(1)};break;}
        }
      }
    }
  }
  const restored=g.restoreMoves(ctx,g.decodeMoves(g.encodeMoves(moves)));
  scenarios.push({team,seed,clubsWith5M:budgets.filter(b=>b.room>=5-1e-8).length,clubsWith10M:budgets.filter(b=>b.room>=10).length,budgetViolations,restores:!!restored.moves,remaining:league.freeAgents.size,dump});
  console.error(`${team}/${seed} complete`);
}
console.log(JSON.stringify(scenarios,null,2));
if(scenarios.some(s=>s.clubsWith5M<5||s.budgetViolations.length||!s.restores)) process.exitCode=1;
if(new Set(scenarios.filter(s=>s.dump).map(s=>s.team)).size<3) process.exitCode=1;
