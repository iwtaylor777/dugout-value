import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {currentFreeAgentValues,marketTracker} from '../lib/free-agent-current.mjs';
import {askFor,askMultiplier,requiredOfferTotal,movesValue} from '../lib/gm-sim.mjs';
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
test('game asks preserve forecast terms and Rogers is graded at his signed term',()=>{
  const game = marketTracker(tracker);
  const suzuki = game.players.find(p => p.name === 'Seiya Suzuki');
  const rogers = game.players.find(p => p.name === 'Trevor Rogers');
  assert.deepEqual(marketTracker(game), game);
  assert.equal(suzuki.total, 106.5);
  assert.equal(rogers.total, rogers.marketForecast.forecasts.find(q=>q.years===rogers.years&&q.label==='MLB Trade Rumors').total);
  assert.equal(rogers.aav, rogers.total/rogers.years);
  const ask = askFor(rogers, 42);
  assert.equal(ask.total, requiredOfferTotal(rogers,rogers.years,42));
  assert.ok(ask.total >= Math.round(rogers.total * askMultiplier(42, rogers.id) * 10) / 10, 'contradictory quotes cannot make extra years free');
  assert.ok(ask.minYears <= 4 && ask.maxYears >= 5);
  const jazz = game.players.find(p => p.name === 'Jazz Chisholm Jr.');
  assert.equal(askFor(jazz, 42).maxYears, 4);
  const grade = (row, years, total) => movesValue({ tracker: game, sim: { players: {} } }, { signings: [{ pid: row.id, years, total }] }).signings;
  assert.equal(grade(suzuki, 4, 73.8), 0);
  assert.equal(grade(rogers, 4, 63.9), 0);
  assert.equal(grade(rogers, 5, 74.2), 0);
});
