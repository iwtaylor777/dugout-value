// Independent scalar arithmetic for current FA values; no fitting or source writes.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {forecastWarPath} from '../lib/free-agent-pricing.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const tracker=read('app/data/free-agent-tracker.json'),db=read('app/data/player-database.json'),dv=read('app/data/dv-projections.json'),frozen=read('public/research/fa-predictions-2026-27/predictions_frozen.json'),terms=read('app/data/free-agent-comparison-terms.json');
const byId=new Map(db.players.map(p=>[p.id,p]));let quotes=0,alternateQuotes=0,marketSummaries=0,max=0,preserved=0;

function checkPrice(player, quote, war) {
 let value=0,annuity=0;
 for(let i=0;i<quote.years;i++){
  const w=war[2027+i],rp=player.role==='reliever';if(!Number.isFinite(w))throw Error('Missing season '+player.name);
  const net=Math.max(0,w-(rp?.2:.5)),mv=(Math.min(2,net)*11+Math.max(0,net-2)*13.2)*(rp&&w>.8?1.5:1)*1.03**(i+1),f=1.1**(-i-1);
  value+=mv*f;annuity+=f;
 }
 const total=value/annuity*quote.years;max=Math.max(max,Math.abs(total-quote.total));
 if(Math.abs(total-quote.total)>.050001||Math.abs(value/annuity-quote.aav)>.050001)throw Error('Quote differs '+player.name);
}

for(const r of tracker.players){
 if(r.total==null)continue;
 if(r.years!==terms.players[r.id].years)throw Error('Term changed '+r.name);
 const p=byId.get(r.id),full=dv.players[r.id]?forecastWarPath(p,dv.players[r.id]):r.warPath;
 checkPrice(r,r,full);quotes++;
 if(Object.keys(r.warPath).length!==5)throw Error('Incomplete five-year total '+r.name);
 if(r.publishedForecast){const old=frozen.predictions.find(p=>p.id===r.id);if(!old||r.publishedForecast.total!==old.total_musd||r.publishedForecast.years!==old.years)throw Error('Original changed');preserved++;}
 if(r.marketForecast){
  if(r.years!==r.marketForecast.reference.years)throw Error('Primary comparison term differs '+r.name);
  const {forecasts,consensus,alternateValues}=r.marketForecast;
  const editorial=forecasts.filter(f=>f.label==='MLB Trade Rumors'||f.label==='FanGraphs — Ben Clemens');
  const quotedYears=editorial.map(f=>f.years);
  assert.deepEqual(consensus, editorial.length ? {
   total: editorial.reduce((sum,f)=>sum+f.total,0)/editorial.length,
   minYears: Math.min(...quotedYears),
   maxYears: Math.max(...quotedYears),
   sourceCount: editorial.length,
   singleSource: editorial.length===1 ? editorial[0].label : null,
  } : null, 'Market summary differs '+r.name);
  const expected=[...new Set(quotedYears.filter(years=>years!==r.years))].sort((a,b)=>a-b);
  assert.deepEqual(alternateValues.map(q=>q.years),expected,'Alternate terms differ '+r.name);
  for(const quote of alternateValues){checkPrice(r,quote,full);alternateQuotes++;}
  marketSummaries++;
 }
}
if(preserved!==31)throw Error('Missing original forecasts');
console.log(JSON.stringify({status:'passed',current_price_checks:quotes,alternate_price_checks:alternateQuotes,market_summary_checks:marketSummaries,preserved_original_forecasts:preserved,maximum_rounding_difference_musd:max,projection_sha256:crypto.createHash('sha256').update(fs.readFileSync('app/data/dv-projections.json')).digest('hex'),frozen_sha256:crypto.createHash('sha256').update(fs.readFileSync('public/research/fa-predictions-2026-27/predictions_frozen.json')).digest('hex')},null,2));
