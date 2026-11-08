import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as g from '../lib/gm-sim.mjs';
import * as m from '../lib/gm-market.mjs';
import { marketTracker } from '../lib/free-agent-current.mjs';
import { gradeContext } from '../lib/gm-experience.mjs';
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const ctx = { players: read('../app/data/depth-chart.json').players, tracker: marketTracker(read('../app/data/free-agent-tracker.json')), signings: read('../app/data/free-agent-signings.json'), sim: read('../app/data/gm-sim.json'), payroll: read('../app/data/team-payroll.json').cbt };
const id = name => Object.keys(ctx.sim.players).find(id => ctx.sim.players[id].n === name);
const start = { team:'BOS', seed:42, budget:400, signings:[], trades:[], market:m.newMarket() };

test('depth piles and salary offsets cannot buy a controllable ace', () => {
  const league=g.buildLeague(ctx,start);
  const fringe=[...league.owner].filter(([pid,t])=>t==='BOS' && ctx.sim.players[pid]?.v10>0 && ctx.sim.players[pid].v10<14 && ctx.sim.players[pid].prot!=='full').map(([pid])=>pid);
  const proposal={partner:'PIT',give:fringe.slice(0,13),get:[id('Paul Skenes')]};
  assert.ok(proposal.give.length>5);
  assert.match(g.respondToTrade(ctx,league,start,400,proposal,{}).reason,/five players/);
  assert.equal(g.respondToTrade(ctx,league,start,400,{...proposal,give:fringe.slice(0,5)},{}).accepted,false);
  assert.equal(g.restoreMoves(ctx,{...start,trades:[proposal]}).moves,null);
  assert.equal(g.packageValue([10,10,10,10,10]),35);
  assert.equal(g.packageValue([10,-10,-10]),-10,'negative contracts count in full');
});

test('an edited link cannot replay a rejected free star trade', () => {
  const proposal={partner:'PIT',give:[],get:[id('Paul Skenes')]};
  assert.equal(g.respondToTrade(ctx,g.buildLeague(ctx,start),start,400,proposal,{}).accepted,false);
  assert.equal(g.restoreMoves(ctx,g.decodeMoves(g.encodeMoves({...start,trades:[proposal]}))).moves,null);
});

test('a middle-market club cannot dump its current core in one lopsided package', () => {
  const state={...start,team:'BAL'}, league=g.buildLeague(ctx,state);
  const prospect=Object.entries(ctx.sim.players).find(([pid,p])=>league.owner.get(pid)==='BAL' && p.k==='p' && Number(p.fv)===55);
  assert.ok(prospect);
  const reply=g.respondToTrade(ctx,league,state,480,{partner:'ATL',give:[prospect[0]],get:[id('Austin Riley'),id('Ronald Acuña Jr.'),id('Michael Harris II')]},{});
  assert.equal(reply.accepted,false);
  assert.match(reply.reason,/projected WAR|centerpiece|salary/);
});

test('cash is salary coverage, not an unlimited payroll credit', () => {
  const league=g.buildLeague(ctx,start);
  assert.match(g.respondToTrade(ctx,league,start,400,{partner:'BAL',give:[id('Roman Anthony')],get:[],cash:-10},{}).reason,/Cash can cover only/);
  assert.match(g.respondToTrade(ctx,league,start,400,{partner:'BAL',give:[id('Trevor Story')],get:[],cash:24},{}).reason,/Cash can cover only/);
  const prior={...start,trades:[{partner:'PIT',give:[],get:[],cash:49}]};
  assert.match(g.respondToTrade(ctx,league,prior,400,{partner:'BAL',give:[id('Trevor Story')],get:[],cash:2},{}).reason,/payment limit/);
});

test('opening strategies are immutable and rebuilders have a genuine prospect preference', () => {
  const modes=g.openingTeamModes(ctx);
  const changed=g.buildLeague(ctx,{...start,trades:[{partner:'BAL',give:[id('Trevor Story')],get:[id('Gunnar Henderson')]}]});
  g.teamModes(ctx,changed.teamOf);
  assert.equal(g.openingTeamModes(ctx),modes);
  const p={k:'p',v10:20,v05:20,v20:15,eta:2029};
  assert.ok(g.tradePlayerValue(p,'rebuild')>g.tradePlayerValue(p,'middle'));
  assert.ok(g.tradePlayerValue(p,'middle')>g.tradePlayerValue(p,'contend'));
});

test('shorter allowed deals cost less total but more per year', () => {
  const row={id:'test',years:3,total:60,aav:20};
  const two=g.requiredOfferTotal(row,2,42),three=g.requiredOfferTotal(row,3,42);
  assert.ok(two<three);assert.ok(two/2>three/3);
  assert.equal(g.respondToOffer(row,{years:2,total:two},42).accepted,true);
  assert.equal(g.respondToOffer(row,{years:2,total:two-.1},42).accepted,false);
});

test('midpriced closeouts retain a floor, and minimum offers cannot flood the roster', () => {
  for(const aav of [3,5,9.9,10,25]) assert.ok(g.closeoutMinimumAav({id:'test',years:2,total:2*aav,aav,war2027:1},1,42)>=aav*.4);
  let state={...start,market:{...m.newMarket(),round:2}};
  const league=g.buildLeague(ctx,state);
  const rows=ctx.tracker.players.filter(r=>ctx.players.some(p=>p.pid===r.id&&league.freeAgents.has(p.i))).slice(0,13);
  for(const row of rows.slice(0,12)) {const reply=m.submitMarketBid(ctx,state,{pid:row.id,years:1,total:.8});assert.equal(reply.accepted,true);state=reply.moves;}
  assert.equal(m.submitMarketBid(ctx,state,{pid:rows[12].id,years:1,total:.8}).accepted,false);
  assert.match(m.submitMarketBid(ctx,state,{pid:rows[0].id,years:1,total:.8}).reason,/below the public annual estimate/);
  const closed=m.advanceMarket(ctx,state).moves;
  assert.ok(closed.signings.length<=12);
  for(const deal of [...closed.signings,...closed.market.deals]) {
    const row=ctx.tracker.players.find(r=>r.id===deal.pid);
    if(deal.closeout) assert.ok(deal.total/deal.years+1e-9>=g.closeoutMinimumAav(row,deal.years,state.seed),row.name);
  }
});

test('different budgets and forced salary cuts do not receive misleading grades', () => {
  assert.match(gradeContext(480,271,254,'contend'),/Custom-budget/);
  assert.match(gradeContext(100,100,120,'middle'),/Payroll-cut/);
  assert.match(gradeContext(100,100,90,'rebuild'),/Rebuilding/);
  assert.equal(gradeContext(271,271,254,'contend'),null);
});
