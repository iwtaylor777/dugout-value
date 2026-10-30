import assert from 'node:assert/strict';
import test from 'node:test';
import {forecastWarPath,contractTerm,priceContract,marketReach} from '../lib/free-agent-pricing.mjs';
import {initialSettings,marketValueForSeason} from '../lib/value-model.mjs';
import {workloadRetention} from '../lib/aging-curve.mjs';

const hitter={name:'Example hitter',role:'position',position:'CF',age:25,agingModel:{baseAge:26,anchorYear:2027},threeYearProjection:[{year:2027,war:5},{year:2028,war:5}]};
const dv={war:{2027:3,2028:2.8,2029:2.6,2030:2.4,2031:2.2},rate:{2031:2.4},pt:{2031:550},unit:'600 PA'};

test('the complete DV horizon overrides an older two-year public baseline',()=>{
  const path=forecastWarPath(hitter,dv);
  assert.deepEqual(Object.fromEntries(Object.entries(path).slice(0,5)),dv.war);
  assert.equal(path[2029],2.6);
  assert.throws(()=>forecastWarPath(hitter,{...dv,war:{2027:3}}),/Missing DV season/);
});

test('reliever aging after the horizon uses WAR per 65 IP, not the stored per-180 scale',()=>{
  const player={name:'Example reliever',role:'reliever',position:'RP',age:27,agingModel:{baseAge:28,anchorYear:2027}};
  const projection={war:{2027:1.2,2028:1.2,2029:1.2,2030:1.2,2031:1.2},rate:{2031:3.6},pt:{2031:60},unit:'180 IP'};
  const path=forecastWarPath(player,projection);
  // At age 33 the fixed policy removes .10 WAR per 65 innings.
  const expected=(1.2-.10*60/65)*workloadRetention('reliever',33);
  assert.ok(Math.abs(path[2032]-expected)<.006);
});

test('a contract stops at the first below-threshold year even if a later year rebounds',()=>{
  assert.equal(contractTerm(hitter,{2027:3,2028:2,2029:.8,2030:2}),2);
});

test('the quoted flat AAV balances discounted seasonal values',()=>{
  const database={meta:{baseYear:2026}},path={2027:3,2028:2.8,2029:2.6,2030:2.4};
  const quote=priceContract(hitter,path,database);
  let value=0,annuity=0;
  for(let i=0;i<quote.years;i++) {
    const factor=1.1**(-i-1);
    value+=marketValueForSeason(hitter,{year:2027+i,war:path[2027+i]},initialSettings,database)*factor;
    annuity+=factor;
  }
  assert.ok(Math.abs(quote.aav_musd-value/annuity)<=.05);
});

test('an observed opt-out supersedes the market-reach assumption without changing prices',()=>{
  assert.equal(marketReach('optout 2y 58',{2027:20,2028:20}), 'likely stays');
  assert.equal(marketReach('optout 2y 58',{2027:20,2028:20},true),null);
  assert.equal(marketReach('club 21 buyout 0',{2027:22}), 'club option likely exercised');
});
