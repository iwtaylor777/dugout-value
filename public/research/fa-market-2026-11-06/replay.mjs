import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const H=path.dirname(fileURLToPath(import.meta.url));
const rows=JSON.parse(fs.readFileSync(path.join(H,'private/js_replay_input.json'),'utf8'));
let count=0,max=0;
for(const r of rows){
 const m=r.meta,a=r.features.map((x,i)=>((x??m.medians[i])-m.means[i])/m.scales[i]);
 const out=Object.fromEntries(Object.entries(m.models).map(([key,v])=>[key,v.intercept+v.coefficients.reduce((s,b,i)=>s+b*a[i],0)]));
 const d=Math.max(1,Math.min(12,r.variant==='original'?Math.exp(out.years):out.years));
 const years=Math.floor(d+.5),total=Math.max(.78*years,(r.variant==='original'?Math.exp(out.total):Math.exp(out.aav)*d)*1.03**(r.year-2026));
 max=Math.max(max,Math.abs(total-r.prediction.total));if(Math.abs(total-r.prediction.total)>1e-8||years!==r.prediction.years)throw Error('Replay differs');count++;
}
fs.writeFileSync(path.join(H,'javascript_verification.json'),JSON.stringify({status:'passed',prediction_replays:count,maximum_difference_musd:max},null,2)+'\n');
console.log(JSON.stringify({status:'passed',prediction_replays:count,maximum_difference_musd:max}));
