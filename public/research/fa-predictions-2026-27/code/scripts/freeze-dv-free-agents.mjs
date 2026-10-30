import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {nameKey,projectionAge,forecastWarPath,priceContract,marketReach} from '../lib/free-agent-pricing.mjs';
import {initialSettings} from '../lib/value-model.mjs';
const [root,listFile,satoFile,actualDirectory,output]=process.argv.slice(2);
if(!output)throw new Error('Usage: ROOT MLBTR_LIST SATO_JSON RAW_DIRECTORY OUTPUT_DIRECTORY');
const db=JSON.parse(fs.readFileSync(path.join(root,'app/data/player-database.json'))),dv=JSON.parse(fs.readFileSync(path.join(root,'app/data/dv-projections.json')));
const extras=JSON.parse(fs.readFileSync(satoFile));
const players=new Map(db.players.filter(p=>p.kind==='mlb').map(p=>[nameKey(p.name),p]));
for(const e of extras)players.set(nameKey(e.player.name),e.player);
if(process.env.DV_FA_EXTRA_PLAYERS)for(const p of JSON.parse(fs.readFileSync(process.env.DV_FA_EXTRA_PLAYERS)))players.set(nameKey(p.name),p);
const additionalProjections=process.env.DV_FA_EXTRA_PROJECTIONS?JSON.parse(fs.readFileSync(process.env.DV_FA_EXTRA_PROJECTIONS)).players:{};
const list=fs.readFileSync(listFile,'utf8').trim().split('\n').map(line=>{const [position,name,note='']=line.split('|');return {position,name,note};});
for(const e of extras)list.push({position:e.listPos,name:e.player.name,note:e.note});
const actual={bat:{},pit:{}};
for(const kind of ['bat','pit'])for(const r of JSON.parse(fs.readFileSync(path.join(actualDirectory,`fg_${kind}_2026.json`))).data)actual[kind][String(r.playerid)]=r.WAR??0;
const knownDecisions={'Michael King':{decision:'reported opt-out',source:'https://www.mlb.com/amp/news/michael-king-free-agent-2027.html',checked:'2026-10-29'}};
const eligible=[],excluded=[],missing=[],unmodeled=[];
for(const item of list) {
  const p=players.get(nameKey(item.name));if(!p){missing.push(item.name);continue;}
  const projection=dv.players[p.id]??additionalProjections[p.id];
  if(!projection&&!(p.threeYearProjection?.length)){unmodeled.push({player:item.name,reason:'Insufficient recent MLB history and no current public baseline in the database.'});continue;}
  const war=forecastWarPath(p,projection),price=priceContract(p,war,db);
  let reason=item.name==='Emmanuel Clase'?'availability outside the model':marketReach(item.note,price.market_values,item.name==='Michael King');
  const actualWar=actual[['starter','reliever'].includes(p.role)?'pit':'bat'][String(p.fangraphsId)];
  const row={player:item.name,team_2026:p.team,position:item.position,age_2027:projectionAge(p),role:p.role,id:p.id,war_2026:actualWar!=null?+actualWar.toFixed(1):null,projection_source:projection?dv.meta.model:p.id==='npb-sato'?'separate NPB translation':'ZiPS fallback',...price,contract_note:item.note};
  if(reason)excluded.push({...row,reason});else eligible.push(row);
}
if(missing.length)throw new Error('Unmatched class players: '+missing.join(', '));
const surname=s=>s.split(' ').slice(1).join(' ');
const order=(a,b)=>b.total_musd-a.total_musd||b.aav_musd-a.aav_musd||surname(a.player).localeCompare(surname(b.player));
const mlb=eligible.filter(r=>r.player!=='Teruaki Sato').sort(order),extra=eligible.filter(r=>r.player==='Teruaki Sato');
const flags={
 'Adrian Morejon':['below','A premium price for a reliever; the market may pay less for a setup role.'],
 'Teruaki Sato':['below','The signing club also owes a posting fee; the NPB translation has a small comparison sample.'],
 'Michael King':['','Included following the reported opt-out, checked against MLB reporting on October 29.'],
};
const predictions=[...mlb.slice(0,30),...extra].sort(order).map((r,i)=>{const [flag_direction='',flag='']=flags[r.player]??[];return {rank:i+1,...r,flag_direction,flag};});
const result={model_version:`2026-10-25.1 with ${dv.meta.model}`,generated_utc:new Date().toISOString(),price_settings:initialSettings,list_rule:'Top 30 modeled MLB players by predicted total among the dated class expected to reach the market, plus Teruaki Sato.',known_decisions:knownDecisions,projections_through:2026,predictions,excluded,unmodeled,cut_next:mlb.slice(30,33)};
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'predictions_frozen.json'),JSON.stringify(result,null,2)+'\n');
const columns=['rank','player','position','age_2027','war_2026','war_2027','years','total_musd','aav_musd','projection_source','flag_direction','flag'];
const cell=v=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
fs.writeFileSync(path.join(output,'predictions_frozen.csv'),[columns.join(','),...predictions.map(r=>columns.map(k=>cell(r[k])).join(','))].join('\n')+'\n');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const inputs={};for(const f of [path.join(root,'app/data/player-database.json'),path.join(root,'app/data/dv-projections.json'),path.join(root,'lib/free-agent-pricing.mjs'),path.join(root,'lib/value-model.mjs'),path.join(root,'lib/aging-curve.mjs'),path.join(root,'scripts/freeze-dv-free-agents.mjs'),path.join(root,'scripts/build-fa-class-coverage.py'),listFile,satoFile])inputs[path.basename(f)]=sha(f);
for(const key of ['DV_FA_EXTRA_PLAYERS','DV_FA_EXTRA_PROJECTIONS'])if(process.env[key])inputs[key]=sha(process.env[key]);
const lock={locked_utc:result.generated_utc,model_version:result.model_version,inputs,files:Object.fromEntries(['predictions_frozen.json','predictions_frozen.csv'].map(f=>[f,sha(path.join(output,f))])),note:'Dated estimates for subsequent signings; original dated projections are retained separately. No contract outcomes from this class were used to fit prices or terms.'};
fs.writeFileSync(path.join(output,'LOCK-DV-20261029.json'),JSON.stringify(lock,null,2)+'\n');
console.log(JSON.stringify({top:predictions.slice(0,10).map(r=>[r.player,r.years,r.total_musd,r.aav_musd]),count:predictions.length,excluded:excluded.filter(r=>r.total_musd>=15).map(r=>[r.player,r.reason,r.total_musd])},null,2));
