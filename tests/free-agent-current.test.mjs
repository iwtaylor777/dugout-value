import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {currentFreeAgentValues,marketTracker} from '../lib/free-agent-current.mjs';
import {movesValue} from '../lib/gm-sim.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const tracker=read('../app/data/free-agent-tracker.json');
const args={tracker,database:read('../app/data/player-database.json'),projections:read('../app/data/dv-projections.json'),frozen:read('../public/research/fa-predictions-2026-27/predictions_frozen.json'),market:read('../app/data/free-agent-market.json'),terms:read('../app/data/free-agent-comparison-terms.json'),fallbacks:read('../app/data/free-agent-projection-fallbacks.json'),date:tracker.meta.built};
test('refreshing current values is reproducible and does not mutate archived forecasts',()=>{
  const before=JSON.stringify(args.frozen);
  assert.deepEqual(currentFreeAgentValues(args),tracker);
  assert.equal(JSON.stringify(args.frozen),before);
});
test('a forecast update refreshes both WAR and value while the comparison term and original quote stay fixed',()=>{
  const input=structuredClone(args),id='mlb-673548';
  for(const year of Object.keys(input.projections.players[id].war))input.projections.players[id].war[year]+=.01;
  const before=tracker.players.find(p=>p.id===id),after=currentFreeAgentValues(input).players.find(p=>p.id===id);
  assert.equal(after.years,before.years);assert.equal(after.publishedForecast.total,48.3);
  assert.ok(after.total>before.total&&after.total-before.total<1);
});
test('game asking prices use attributed market forecasts while the grade retains model value',()=>{
  const game=marketTracker(tracker),row=game.players.find(p=>p.id==='mlb-673548');
  assert.equal(row.total,105);assert.equal(row.modelValue.total,73.8);
  assert.equal(marketTracker(game).players.find(p=>p.id===row.id).modelValue.total,73.8);
  const result=movesValue({tracker:game,sim:{players:{}}},{signings:[{pid:row.id,total:105,years:4}],trades:[]});
  assert.ok(Math.abs(result.signings-(73.8-105))<1e-9);
});
