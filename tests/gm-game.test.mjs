import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as g from '../lib/gm-sim.mjs';
import * as game from '../lib/gm-game.mjs';
import {marketTracker} from '../lib/free-agent-current.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const ctx={players:read('../app/data/depth-chart.json').players,tracker:marketTracker(read('../app/data/free-agent-tracker.json')),signings:read('../app/data/free-agent-signings.json'),trades:read('../app/data/trades.json'),sim:read('../app/data/gm-sim.json'),payroll:read('../app/data/team-payroll.json').cbt};
const id=name=>Object.keys(ctx.sim.players).find(pid=>ctx.sim.players[pid].n===name);
const step=(state,action)=>{const result=game.act(ctx,state,action);assert.ok(result.accepted,result.reason);return result.moves;};
const roundtrip=state=>assert.deepEqual(game.replayGame(ctx,game.decodeGame(game.encodeGame(state))).moves,state);

test('undo rechecks roster-dependent later trades and the resulting game reloads',()=>{
  // A boundary-value fixture keeps this a dependency test, not an assertion
  // that the real 60-FV Arias can never buy Wells without an earlier trade.
  const fixture={...ctx,sim:{...ctx.sim,players:{...ctx.sim.players,[id('Franklin Arias')]:{...ctx.sim.players[id('Franklin Arias')],v10:60,v05:60,v20:60}}}};
  let state=game.createGame('BOS',42);
  const dump={partner:'NYY',give:[id('Adley Rutschman')],get:[]};
  const wells={partner:'NYY',give:[id('Franklin Arias')],get:[id('Austin Wells')]};
  assert.equal(game.act(fixture,state,['trade',wells]).accepted,false);
  state=game.act(fixture,state,['trade',dump]).moves;
  const second=game.act(fixture,state,['trade',wells]);
  assert.ok(second.accepted,second.reason);state=second.moves;
  const undone=game.undoGame(fixture,state,'trade',0);
  assert.equal(undone.moves.trades.length,0);
  assert.equal(g.buildLeague(ctx,undone.moves).owner.get(id('Austin Wells')),'NYY');
  roundtrip(undone.moves);
});

test('links replay actions and cannot supply forged market outcomes or a cheap Skubal',()=>{
  const state=game.createGame('NYM',42),pid=id('Tarik Skubal');
  assert.equal(game.replayGame(ctx,{...state,market:{round:3,deals:[]},signings:[{pid,years:1,total:29}]}).moves,null);
  const forged={...game.gameSave(state),market:{round:3,deals:[]},signings:[{pid,years:1,total:29}]};
  assert.deepEqual(game.replayGame(ctx,forged).moves,state,'untrusted outcomes have no effect');
  assert.equal(game.replayGame(ctx,{...game.gameSave(state),actions:[['sign',{pid,years:1,total:29}]]}).moves,null);
  assert.equal(game.replayGame(ctx,{...game.gameSave(state),actions:[['advance'],['advance'],['advance'],['sign',{pid,years:1,total:29}]]}).moves,null);
});

test('undoing hoarded signings restores the no-bids rival market, not empty roster slots',()=>{
  let state=game.createGame('BOS',42);
  const league=g.buildLeague(ctx,state);
  const rows=ctx.tracker.players.filter(r=>r.aav>3&&ctx.players.some(p=>p.pid===r.id&&league.freeAgents.has(p.i))).slice(0,12);
  for(const r of rows) state=step(state,['bid',{pid:r.id,years:r.years,total:Math.min(999,Math.ceil(g.requiredOfferTotal(r,r.years,42)*1.4))}]);
  for(let i=0;i<3;i++)state=step(state,['advance']);
  assert.ok(state.signings.length>0);
  while(state.signings.length)state=game.undoGame(ctx,state,'signing',0).moves;
  // Remove any losing bids as well to compare exactly the same intentions.
  const clean=game.replayGame(ctx,{...game.gameSave(state),actions:state.journal.filter(a=>a[0]==='advance')}).moves;
  let control=game.createGame('BOS',42);for(let i=0;i<3;i++)control=step(control,['advance']);
  assert.deepEqual(state.market,control.market,'undo alone restores the rival market after hoarding');
  assert.deepEqual(clean.market,control.market);
  assert.equal(g.movesValue(ctx,clean).total,0);
  roundtrip(state);
});

test('term prices preserve Jazz quotes and increase with added years despite conflicting Skubal forecasts',()=>{
  const jazz=ctx.tracker.players.find(r=>r.name==='Jazz Chisholm Jr.');
  assert.equal(jazz.years,2);assert.equal(jazz.total,40);
  const scale=g.askMultiplier(42,jazz.id);
  assert.ok(Math.abs(g.requiredOfferTotal(jazz,2,42)-40*scale)<.051);
  assert.ok(Math.abs(g.requiredOfferTotal(jazz,4,42)-92*scale)<.051);
  for(const r of ctx.tracker.players.filter(r=>r.aav>=1)){
    const ask=g.askFor(r,42);let prior=0;
    for(let years=ask.minYears;years<=ask.maxYears;years++){
      const price=g.requiredOfferTotal(r,years,42);
      assert.ok(price>prior,`${r.name}: term ${years} must cost more`);prior=price;
    }
  }
});

test('all 30 clubs have an objective and a finite grade, including expensive low-WAR clubs',()=>{
  for(const team of Object.keys(ctx.sim.teams)){
    const state=game.createGame(team,42),score=g.objectiveGrade(ctx,state,0,0);
    assert.ok(score.label);assert.ok(Number.isFinite(score.points));assert.match(score.letter,/^[ABCDF]/);
  }
  for(const team of ['TOR','CHC','SDP','HOU','SFG','TEX'])assert.notEqual(g.openingTeamModes(ctx)[team],'rebuild',team);
});

test('outgoing packages are valued in full and grade cannot change by partitioning identical moves',()=>{
  const state=game.createGame('BOS',42),league=g.buildLeague(ctx,state);
  const get=[...league.owner].filter(([pid,t])=>t==='NYY'&&ctx.sim.players[pid]?.k==='p'&&ctx.sim.players[pid]?.v10>0).slice(0,5).map(([pid])=>pid);
  assert.equal(get.length,5);
  const proposal={partner:'NYY',give:[id('Roman Anthony')],get};
  const response=g.respondToTrade(ctx,league,state,480,proposal,{});
  const value=pid=>g.tradeAssetValue(ctx.sim.players[pid],g.tradeOutlook(ctx,'NYY').urgency);
  assert.ok(response.need>=get.reduce((sum,pid)=>sum+value(pid),0),response.reason);
  const grouped={...state,trades:[proposal]};
  const split={...state,trades:get.map((pid,i)=>({...proposal,give:i?[]:proposal.give,get:[pid]}))};
  assert.ok(Math.abs(g.movesValue(ctx,grouped).total-g.movesValue(ctx,split).total)<1e-8);
});

test('partner roster-loss protection considers earlier trades, not just the latest deal',()=>{
  const state={...game.createGame('BOS',42),trades:[{partner:'ATL',give:[],get:[id('Austin Riley'),id('Ronald Acuña Jr.'),id('Michael Harris II')]}]};
  const proposal={partner:'ATL',give:[id('Franklin Arias')],get:[id('Matt Olson')]};
  const response=g.respondToTrade(ctx,g.buildLeague(ctx,state),state,480,proposal,{});
  const fresh=game.createGame('BOS',42),single=g.respondToTrade(ctx,g.buildLeague(ctx,fresh),fresh,480,proposal,{});
  assert.ok(response.winCost>single.winCost,'earlier roster depletion increases the next price');
  assert.ok(response.need>single.need);
});

for(const [team,seed,budget] of [['BOS',42,300],['ATH',73,147],['TBR',91,110]])test(`${team} full offseason: bids, three rounds, undo, reload, budget, season and compact share`,()=>{
  let state=step(game.createGame(team,seed),['budget',budget]);
  const opening=g.buildLeague(ctx,state),pay=g.payrollFor(ctx,opening,team);
  const candidates=ctx.tracker.players.filter(r=>r.aav>=2&&r.aav<=Math.max(5,(budget-pay)/3)&&ctx.players.some(p=>p.pid===r.id&&opening.freeAgents.has(p.i))).slice(0,2);
  for(const r of candidates)state=step(state,['bid',{pid:r.id,years:r.years,total:Math.ceil(g.requiredOfferTotal(r,r.years,seed)*1.08)}]);
  const counts=[];
  for(let i=0;i<3;i++){const before=state.market.deals.length;state=step(state,['advance']);counts.push(state.market.deals.length-before);roundtrip(state);}
  assert.ok(counts[0]>5&&counts[1]>5,`market pacing ${counts}`);
  if(state.signings.length){state=game.undoGame(ctx,state,'signing',0).moves;roundtrip(state);}
  while(!g.seasonReadiness(ctx,state).ready&&state.signings.length)state=game.undoGame(ctx,state,'signing',0).moves;
  if(!g.seasonReadiness(ctx,state).ready){
    const league=g.buildLeague(ctx,state);
    const outgoing=[...league.owner].filter(([pid,t])=>t===team&&ctx.sim.players[pid]?.v10>2).sort((a,b)=>g.playerContract(ctx,league,b[0]).hit-g.playerContract(ctx,league,a[0]).hit);
    search:for(const [pid] of outgoing)for(const cash of [0,Math.round(g.playerContract(ctx,league,pid).hit*.25*10)/10])for(const partner of Object.keys(ctx.sim.teams).filter(t=>t!==team)){
      const net=g.playerContract(ctx,league,pid).hit-cash;
      if(net<g.seasonReadiness(ctx,state).shortfall||g.rivalBudget(ctx,league,partner,seed).room<net)continue;
      const prospect=[...league.owner].find(([p,t])=>t===partner&&ctx.sim.players[p]?.k==='p'&&ctx.sim.players[p]?.v10>0&&ctx.sim.players[p]?.v10<2)?.[0];
      if(!prospect)continue;
      const answer=game.act(ctx,state,['trade',{partner,give:[pid],get:[prospect],cash}]);
      if(answer.accepted&&g.seasonReadiness(ctx,answer.moves).ready){state=answer.moves;console.log(`${team} payroll repair: ${ctx.sim.players[pid].n} and $${cash}M to ${partner} for ${ctx.sim.players[prospect].n}`);break search;}
    }
  }
  assert.ok(g.seasonReadiness(ctx,state).ready,`${team} budget ${budget}`);
  const league=g.buildLeague(ctx,state),strengths=g.teamStrengths(ctx,league.teamOf),results=g.simulateSeasons(ctx,strengths,200,seed);
  assert.ok(Number.isFinite(results[team].mean));
  assert.ok(game.encodeGame(state).length<2500);
  assert.equal(new Set([...state.signings,...state.market.deals].map(s=>s.pid)).size,state.signings.length+state.market.deals.length);
  console.log(`${team}: rounds ${counts.join('/')}, ${state.signings.length} user signings, ${results[team].mean.toFixed(1)} expected wins, ${game.encodeGame(state).length}-character save`);
});
