import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {forecastWarPath,priceContract} from './legacy/free-agent-pricing.mjs';
const H=path.dirname(fileURLToPath(import.meta.url)),read=f=>JSON.parse(fs.readFileSync(path.join(H,f),'utf8'));
const rows=read('private/dataset.json'),scored=read('private/scored.json');
const median=xs=>{const a=xs.toSorted((a,b)=>a-b);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
for(const r of scored){
 const past=rows.filter(x=>x.year<r.year&&x.role===r.role),med=median(past.map(x=>x.actualTotal*1.03**(2026-x.year))),years=Math.round(median(past.map(x=>x.actualYears)));
 r.referenceMedian={total:med*1.03**(r.year-2026),years,aav:med*1.03**(r.year-2026)/years};
 const pos=r.role==='starter'?'SP':r.role==='reliever'?'RP':r.features.bat_Positional>=9?'C':r.features.bat_Positional>0?'SS':'RF';
 const p={name:r.name,role:r.role,position:pos,age:r.age-1,threeYearProjection:[{year:2027,war:r.proxyWar}]};
 const quote=priceContract(p,forecastWarPath(p),{meta:{baseYear:2027}});
 r.referenceLegacy={total:Math.max(.78*quote.years,quote.total_musd)*1.03**(r.year-2026),years:quote.years,aav:Math.max(.78,quote.aav_musd)*1.03**(r.year-2026)};
}
fs.writeFileSync(path.join(H,'private/scored_with_baselines.json'),JSON.stringify(scored));
console.log('Baselines',scored.length);
