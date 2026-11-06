// Refresh production values without overwriting any previously scored forecast.
import fs from 'node:fs';
import {currentFreeAgentValues} from '../lib/free-agent-current.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const out=currentFreeAgentValues({tracker:read('app/data/free-agent-tracker.json'),database:read('app/data/player-database.json'),projections:read('app/data/dv-projections.json'),frozen:read('public/research/fa-predictions-2026-27/predictions_frozen.json'),market:read('app/data/free-agent-market.json'),terms:read('app/data/free-agent-comparison-terms.json'),fallbacks:read('app/data/free-agent-projection-fallbacks.json'),date:process.env.DV_FA_DATE??new Date().toISOString().slice(0,10)});
fs.writeFileSync('app/data/free-agent-tracker.json',JSON.stringify(out)+'\n');
console.log(JSON.stringify({players:out.players.length,published:out.meta.scoredRelease.count,market:out.players.filter(p=>p.marketForecast).length,focus:out.players.filter(p=>['Seiya Suzuki','Trevor Rogers'].includes(p.name))},null,2));
