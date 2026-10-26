import fs from "node:fs";
const root=process.env.HOME+"/build/model";
const vm=await import(`${root}/lib/value-model.mjs`); const ag=await import(`${root}/lib/aging-curve.mjs`);
const db0={meta:{baseYear:2026,seasonRemainingFraction:1}}; const S=vm.initialSettings;
function aav(w,age,yrs,pos){const player={role:"position",position:pos,depthPosition:pos};const r=ag.agingRole("position"),u=ag.agingUnit(r).amount;let rate=w,wl=u,pv=0,ann=0;
 for(let i=0;i<yrs;i++){if(i>0){const a=age+i;rate+=ag.empiricalRateChange(r,a,pos);wl*=ag.workloadRetention(r,a);}const ww=i?Math.max(-0.5,rate*wl/u):w;const f=1/Math.pow(1.1,i+1);pv+=vm.marketValueForSeason(player,{year:2026+i,war:ww},S,db0)*f;ann+=f;}return Math.max(0.78,pv/ann);}
const rows=JSON.parse(fs.readFileSync("fa_rows.json"));
const TH=[0.2,0.35,0.5,0.65,0.8,1.0,1.2], PH=[0.6,0.8,1.0,1.2,1.4];
const L=rows.map(r=>TH.map(th=>PH.map(ph=>Math.log(r.aav/aav(Math.max(0.1,r.war-(1-th)*r.fld/10-(1-ph)*r.off/10),r.age,r.yrs,r.pos)))));
function score(idx,j,k){const g={};for(const i of idx)(g[rows[i].t]??=[]).push(L[i][j][k]);let ss=0,n=0;for(const v of Object.values(g)){const m=v.reduce((a,b)=>a+b,0)/v.length;for(const x of v){ss+=(x-m)**2;n++;}}return ss/n;}
function best(idx){let b=[0,0],bv=1e9;for(let j=0;j<TH.length;j++)for(let k=0;k<PH.length;k++){const v=score(idx,j,k);if(v<bv){bv=v;b=[TH[j],PH[k]];}}return b;}
const all=[...rows.keys()]; const b0=best(all); console.log("best (fielding credit, offense credit):",b0,"ratio",(b0[0]/b0[1]).toFixed(2));
let s=7;const rnd=()=>((s=(s*16807)%2147483647)/2147483647);const rs=[];for(let k=0;k<400;k++){const b=best(Array.from({length:rows.length},()=>Math.floor(rnd()*rows.length)));rs.push(b[0]/b[1]);}rs.sort((a,b)=>a-b);
console.log("ratio bootstrap 95%:",rs[10].toFixed(2),"-",rs[389].toFixed(2));
