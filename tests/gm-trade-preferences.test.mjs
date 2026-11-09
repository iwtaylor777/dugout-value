import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as g from '../lib/gm-sim.mjs';
import * as game from '../lib/gm-game.mjs';
import {marketTracker} from '../lib/free-agent-current.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const ctx={players:read('../app/data/depth-chart.json').players,tracker:marketTracker(read('../app/data/free-agent-tracker.json')),signings:read('../app/data/free-agent-signings.json'),sim:read('../app/data/gm-sim.json'),payroll:read('../app/data/team-payroll.json').cbt};
const id=name=>{const pid=Object.keys(ctx.sim.players).find(pid=>ctx.sim.players[pid].n===name);assert.ok(pid,name);return pid;};
const state=game.createGame('BOS',42),league=g.buildLeague(ctx,state);
const trio=['Franklin Arias','Justin Gonzales','John Holobetz'];
const elite=['Roman Anthony','Franklin Arias','Payton Tolle'];
const quote=(name,names,s=state)=>{const l=g.buildLeague(ctx,s),pid=id(name);return g.respondToTrade(ctx,l,s,400,{partner:l.owner.get(pid),get:[pid],give:names.map(id)});};

test('Neto can move for the specified prospect package despite a three-WAR roster loss',()=>{
  const answer=quote('Zach Neto',trio);
  assert.ok(answer.accepted,answer.reason);assert.ok(answer.warLoss>3);
  assert.ok(answer.winCost>0&&answer.winCost<10);
  assert.equal(quote('Zach Neto',trio.slice(1)).accepted,false);
  assert.equal(quote('Zach Neto',['Franklin Arias']).accepted,false,'one excellent prospect still falls short of the complete return');
});

test('top stars have reachable prices, with stronger packages required than the Neto offer',()=>{
  for(const name of ['James Wood','Paul Skenes','Corbin Carroll']){
    const ordinary=quote(name,trio),strong=quote(name,elite);
    assert.equal(ordinary.accepted,false,`${name}: insufficient package`);
    assert.ok(strong.accepted,`${name}: ${strong.reason}`);
    const pid=id(name),outlook=g.tradeOutlook(ctx,league.owner.get(pid));
    assert.ok(strong.need>g.tradeAssetValue(ctx.sim.players[pid],outlook.urgency)*1.25,`${name} retains a premium`);
    const accepted=game.act(ctx,state,['trade',{partner:league.owner.get(pid),get:[pid],give:elite.map(id)}]);
    assert.ok(accepted.accepted);
    assert.deepEqual(game.replayGame(ctx,game.gameSave(accepted.moves)).moves,accepted.moves);
    assert.equal(game.undoGame(ctx,accepted.moves,'trade',0).moves.trades.length,0);
  }
});

test('cheap depth, cash-only bids and no-trade-clause bypasses remain rejected',()=>{
  const depth=[...league.owner].filter(([pid,t])=>t==='BOS'&&ctx.sim.players[pid]?.k==='p'&&ctx.sim.players[pid].v10<15).slice(0,5).map(([pid])=>pid);
  assert.equal(depth.length,5);
  for(const name of ['Zach Neto','James Wood','Paul Skenes','Corbin Carroll']){
    const pid=id(name),partner=league.owner.get(pid);
    assert.equal(g.respondToTrade(ctx,league,state,400,{partner,give:depth,get:[pid]}).accepted,false,name);
    assert.equal(g.respondToTrade(ctx,league,state,400,{partner,give:[],get:[pid],cash:50}).accepted,false,name);
  }
  assert.match(quote('Bobby Witt Jr.',elite).reason,/no-trade clause/);
});

test('payroll ambition does not turn a weak club into an untouchable win-now roster',()=>{
  for(const team of ['LAA','CHC','SDP','HOU']){
    assert.ok(g.tradeOutlook(ctx,team).wins<80,team);
    assert.ok(g.tradeOutlook(ctx,team).urgency<1/3,team);
  }
  const rich={...ctx,sim:{...ctx.sim,teams:{...ctx.sim.teams,LAA:{...ctx.sim.teams.LAA,cbt2026:480}}}};
  assert.equal(g.openingTeamModes(rich).LAA,'contend','spending plan changes');
  assert.deepEqual(g.tradeOutlook(rich,'LAA'),g.tradeOutlook(ctx,'LAA'),'trade horizon does not');
  assert.ok(quote('Yordan Alvarez',['Wilyer Abreu','Curtis Mead']).accepted);
});

test('a genuine contender charges for current wins but is not barred from trading a regular',()=>{
  const answer=quote('Austin Wells',['Franklin Arias']);
  assert.ok(g.tradeOutlook(ctx,'NYY').urgency>.9);
  assert.ok(answer.warLoss>.75&&answer.winCost>20);
  assert.ok(answer.accepted,answer.reason);
  assert.equal(quote('Austin Wells',['Justin Gonzales','John Holobetz']).accepted,false);
});

test('current-win premiums are smooth, monotonic, finite, and cannot be bypassed by splitting losses',()=>{
  const star=ctx.sim.players[id('Zach Neto')];
  for(let i=0;i<=100;i++){
    const u=i/100,cost=g.tradeWinCost(u,3),premium=g.starPremium(star,u);
    assert.ok(Number.isFinite(cost));assert.ok(Number.isFinite(premium));
    if(i){assert.ok(cost>=g.tradeWinCost(u-.01,3));assert.ok(premium>=g.starPremium(star,u-.01)-1e-10);}
    let paid=0,before=0;
    for(const loss of [1.2,2.4,.8]){paid+=g.tradeWinCost(u,before+loss)-g.tradeWinCost(u,before);before+=loss;}
    assert.ok(Math.abs(paid-g.tradeWinCost(u,4.4))<1e-8);
    assert.ok(g.tradeWinCost(u,4.4)>=g.tradeWinCost(u,1.2)+g.tradeWinCost(u,2.4)+g.tradeWinCost(u,.8)-1e-8);
  }
  assert.equal(g.tradeWinCost(1,-2),0);
});

test('all team outlooks and representative star premiums stay finite and independent of trade order',()=>{
  for(const team of Object.keys(ctx.sim.teams)){
    const outlook=g.tradeOutlook(ctx,team);
    assert.ok(Number.isFinite(outlook.wins)&&outlook.urgency>=0&&outlook.urgency<=1);
    for(const years of [1,2,3,4,6]){
      const v={...ctx.sim.players[id('Zach Neto')],ctl:2026+years};
      assert.ok(g.starPremium(v,outlook.urgency)>=0&&g.starPremium(v,outlook.urgency)<=.75);
    }
  }
  const before=quote('Zach Neto',trio),reverse=quote('Zach Neto',[...trio].reverse());
  assert.equal(before.accepted,reverse.accepted);assert.equal(before.received,reverse.received);assert.equal(before.need,reverse.need);
});
