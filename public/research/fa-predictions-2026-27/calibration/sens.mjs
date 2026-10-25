import fs from "node:fs";
const root = process.argv[2];
const vm = await import(`${root}/lib/value-model.mjs`); const ag = await import(`${root}/lib/aging-curve.mjs`);
const raw = JSON.parse(fs.readFileSync("raw/fg_fa_tracker_2020_2027.json","utf8"));
const db = { meta: { baseYear: 2026, seasonRemainingFraction: 1 } };
const roleOf = p => { const f=(p||"").toUpperCase().split("/")[0]; return f==="RP"||f==="CL"?"reliever":f==="SP"?"starter":"position"; };
function aav(d,S){ const player={role:d.role,position:d.pos,depthPosition:d.role==="reliever"?"RP":d.role==="starter"?"SP":d.pos};
  const r=ag.agingRole(d.role),u=ag.agingUnit(r).amount; let rate=d.w,wl=u,pv=0,ann=0;
  for(let i=0;i<d.yrs;i++){ if(i>0){const a=d.age+i; rate+=ag.empiricalRateChange(r,a,d.pos); wl*=ag.workloadRetention(r,a);} const w=i?Math.max(-0.5,rate*wl/u):d.w;
    const Ss=(d.role==="reliever"&&w>0.8)?{...S,relieverPremium:50}:S; const f=1/Math.pow(1.1,i+1); pv+=vm.marketValueForSeason(player,{year:2026+i,war:w},Ss,db)*f; ann+=f; } return pv/ann; }
const deals=raw.filter(r=>r.ContractType==="Free Agent"&&r.ContractTotal&&r.YearsTotal&&r.tracker_season===2026&&r.war_proj!=null).map(r=>({name:r.playerName,role:roleOf(r.position),pos:(r.position||"").split("/")[0],age:r.age,w:r.war_proj,yrs:r.YearsTotal,aav:r.ContractTotal/r.YearsTotal/1e6})).filter(d=>d.aav>=2);
const groups={nonRP:deals.filter(d=>d.role!=="reliever"&&d.w>=1), stars:deals.filter(d=>d.role!=="reliever"&&d.w>=3.5), RP:deals.filter(d=>d.role==="reliever"&&d.w>0.8)};
for (const D of [10,10.5,11,12]) { const S={...vm.initialSettings,dollarsPerWar:D,starPremium:20};
  const line=Object.entries(groups).map(([k,g])=>{ let m=0,a=0,l=0; for(const d of g){const x=aav(d,S); m+=x; a+=d.aav; l+=Math.log(d.aav/x)**2;} return `${k} n=${g.length} actual/model ${(a/m).toFixed(2)} mse ${(l/g.length).toFixed(3)}`; }).join(" | ");
  console.log(`$${D}M/WAR, 20% star: ${line}`); }
