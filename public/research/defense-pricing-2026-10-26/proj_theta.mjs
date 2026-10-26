import fs from "node:fs";
const root=process.env.HOME+"/build/model"; const cal=process.env.HOME+"/mnt/Baseball/analysis/fa_market_calibration";
const vm=await import(`${root}/lib/value-model.mjs`); const ag=await import(`${root}/lib/aging-curve.mjs`);
const db0={meta:{baseYear:2026,seasonRemainingFraction:1}}; const S=vm.initialSettings;
function aav(w,age,yrs,pos){const player={role:"position",position:pos,depthPosition:pos};const r=ag.agingRole("position"),u=ag.agingUnit(r).amount;let rate=w,wl=u,pv=0,ann=0;
 for(let i=0;i<yrs;i++){if(i>0){const a=age+i;rate+=ag.empiricalRateChange(r,a,pos);wl*=ag.workloadRetention(r,a);}const ww=i?Math.max(-0.5,rate*wl/u):w;const f=1/Math.pow(1.1,i+1);pv+=vm.marketValueForSeason(player,{year:2026+i,war:ww},S,db0)*f;ann+=f;}return Math.max(0.78,pv/ann);}
const fg={}; for(let y=2023;y<=2025;y++) for(const r of JSON.parse(fs.readFileSync(`../proj/raw/fg_bat_${y}.json`)).data) (fg[r.playerid]??={})[y]=r;
const raw=JSON.parse(fs.readFileSync(`${cal}/raw/fg_fa_tracker_2020_2027.json`));
const rows=[];
for(const d of raw){ if(d.tracker_season!==2026||d.ContractType!=="Free Agent"||!d.ContractTotal||d.war_proj==null) continue; const pos=(d.position||"").split("/")[0]; if(["SP","RP","CL","P","C"].includes(pos)) continue;
 const h=fg[d.playerId]; if(!h) continue; let F=0,PA=0; for(const [y,w] of [[2025,5],[2024,4],[2023,3]]){const s=h[y]; if(!s) continue; F+=w*(s.Fielding??0); PA+=w*s.PA;} if(!PA) continue;
 if(d.war_proj<1) continue; rows.push({name:d.playerName,age:d.age,yrs:d.YearsTotal,pos,w:d.war_proj,fld:F/PA*600,aav:d.ContractTotal/d.YearsTotal/1e6});}
const TH=[0,0.25,0.5,0.75,1,1.25];
for(const th of TH){const l=rows.map(r=>Math.log(r.aav/aav(Math.max(0.1,r.w-(1-th)*r.fld/10),r.age,r.yrs,r.pos)));const m=l.reduce((a,b)=>a+b,0)/l.length;console.log(`θ=${th} resid var ${(l.reduce((a,b)=>a+(b-m)**2,0)/l.length).toFixed(4)} mean ratio ${Math.exp(m).toFixed(2)}`);}
console.log("n",rows.length, rows.map(r=>`${r.name} fld${r.fld.toFixed(0)}`).join("; "));
