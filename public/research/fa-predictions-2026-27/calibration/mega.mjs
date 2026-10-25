import fs from "node:fs";
const root = process.argv[2], cal = process.argv[3];
const vm = await import(`${root}/lib/value-model.mjs`); const ag = await import(`${root}/lib/aging-curve.mjs`);
const db = { meta: { baseYear: 2026, seasonRemainingFraction: 1 } };
const roleOf = p => { const f=(p||"").toUpperCase().split("/")[0]; return f==="RP"||f==="CL"?"reliever":f==="SP"?"starter":"position"; };
function aav(d,S){ const player={role:d.role,position:d.pos,depthPosition:d.role==="reliever"?"RP":d.role==="starter"?"SP":d.pos};
  const r=ag.agingRole(d.role),u=ag.agingUnit(r).amount; let rate=d.w,wl=u,pv=0,ann=0;
  for(let i=0;i<d.yrs;i++){ if(i>0){const a=d.age+i; rate+=ag.empiricalRateChange(r,a,d.pos); wl*=ag.workloadRetention(r,a);} const w=i?Math.max(-0.5,rate*wl/u):d.w;
    const Ss=(d.role==="reliever"&&w>0.8)?{...S,relieverPremium:50}:S; const f=1/Math.pow(1.1,i+1); pv+=vm.marketValueForSeason(player,{year:2026+i,war:w},Ss,db)*f; ann+=f; } return pv/ann; }
const raw = JSON.parse(fs.readFileSync(`${cal}/raw/fg_fa_tracker_2020_2027.json`,"utf8"));
const marcel = JSON.parse(fs.readFileSync(`${cal}/raw/signings_marcel.json`,"utf8"));
// 2026 class with projections at signing
const c26=raw.filter(r=>r.ContractType==="Free Agent"&&r.ContractTotal&&r.YearsTotal&&r.tracker_season===2026&&r.war_proj!=null).map(r=>({name:r.playerName,role:roleOf(r.position),pos:(r.position||"").split("/")[0],age:r.age,w:r.war_proj,yrs:r.YearsTotal,aav:r.ContractTotal/r.YearsTotal/1e6})).filter(d=>d.aav>=2);
const groups={nonRP:c26.filter(d=>d.role!=="reliever"&&d.w>=1), stars26:c26.filter(d=>d.role!=="reliever"&&d.w>=3.5), RP:c26.filter(d=>d.role==="reliever"&&d.w>0.8)};
// mega deals 2020-26, >= $150M nominal, proxy WAR, AAV in 2026 dollars
const mega=marcel.filter(m=>m.tot/Math.pow(1.03,2026-m.season)>=149e0 && m.role!=="RP" && m.w>=2.5 && !/Ohtani|Yamamoto/.test(m.name)).map(m=>({name:m.name,season:m.season,role:m.role==="SP"?"starter":"position",pos:"",age:m.age,w:m.w,yrs:m.yrs,aav:m.aav}));
groups.mega=mega; groups.megaSP=mega.filter(d=>d.role==="starter"); groups.megaLong=mega.filter(d=>d.yrs>=7);
const grid=[[11,20],[10.5,20],[10.5,10],[10,20],[10,10],[10,0],[10.5,0]];
const sk={name:"Skubal",role:"starter",pos:"P",age:30,yrs:10};
const out=[];
for (const [D,P] of grid){ const S={...vm.initialSettings,dollarsPerWar:D,starPremium:P};
  const row={D,P}; for(const [k,g] of Object.entries(groups)){ let m=0,a=0,l=0; for(const d of g){const x=aav(d,S); m+=x;a+=d.aav;l+=Math.log(d.aav/x)**2;} row[k]={n:g.length,ratio:+(a/m).toFixed(3),mse:+(l/g.length).toFixed(3)}; }
  out.push(row); console.log(JSON.stringify(row)); }
console.log("mega deals:"); const S0={...vm.initialSettings,dollarsPerWar:11,starPremium:20};
for(const d of mega) console.log(d.season,d.name,d.role,d.age,d.w.toFixed(1),d.yrs,"actual(2026$)",d.aav.toFixed(1),"model@11/20",aav(d,S0).toFixed(1));
fs.writeFileSync("grid.json",JSON.stringify({grid:out,mega},null,1));
