import fs from "node:fs";
const root=process.env.HOME+"/build/model";
const vm=await import(`${root}/lib/value-model.mjs`); const ag=await import(`${root}/lib/aging-curve.mjs`);
const db0={meta:{baseYear:2026,seasonRemainingFraction:1}}; const S=vm.initialSettings;
function aav(w,age,yrs,pos){const player={role:"position",position:pos,depthPosition:pos};const r=ag.agingRole("position"),u=ag.agingUnit(r).amount;let rate=w,wl=u,pv=0,ann=0;
 for(let i=0;i<yrs;i++){if(i>0){const a=age+i;rate+=ag.empiricalRateChange(r,a,pos);wl*=ag.workloadRetention(r,a);}const ww=i?Math.max(-0.5,rate*wl/u):w;const f=1/Math.pow(1.1,i+1);pv+=vm.marketValueForSeason(player,{year:2026+i,war:ww},S,db0)*f;ann+=f;}return Math.max(0.78,pv/ann);}
const rows=JSON.parse(fs.readFileSync("fa_rows.json")); const yrs=[...new Set(rows.map(r=>r.t))];
const TH=Array.from({length:21},(_,i)=>i/20);
// log ratio for each row at each theta (fielding wins per season = fld600/10 * PA/600 ~ use fld600/10 at a full season)
const L=rows.map(r=>TH.map(th=>Math.log(r.aav/aav(Math.max(0.1,r.war-(1-th)*r.fld/10),r.age,r.yrs,r.pos))));
function best(idx){let bt=0,bv=1e9;for(let j=0;j<TH.length;j++){// residual variance after removing signing-year means
  const g={};for(const i of idx){(g[rows[i].t]??=[]).push(L[i][j]);} let ss=0,n=0;for(const v of Object.values(g)){const m=v.reduce((a,b)=>a+b,0)/v.length;for(const x of v){ss+=(x-m)**2;n++;}} if(ss/n<bv){bv=ss/n;bt=TH[j];}} return bt;}
const all=[...rows.keys()]; const b0=best(all);
let s=99;const rnd=()=>((s=(s*16807)%2147483647)/2147483647); const bs=[];
for(let k=0;k<1000;k++){bs.push(best(Array.from({length:rows.length},()=>Math.floor(rnd()*rows.length))));} bs.sort((a,b)=>a-b);
console.log(`market credit for a fielding run relative to the model's full credit: best ${b0} (bootstrap 95% ${bs[25]}–${bs[974]}), n=${rows.length}`);
// profile
console.log(TH.filter((_,j)=>j%2===0).map(th=>{const j=TH.indexOf(th);const g={};for(const i of all)(g[rows[i].t]??=[]).push(L[i][j]);let ss=0,n=0;for(const v of Object.values(g)){const m=v.reduce((a,b)=>a+b,0)/v.length;for(const x of v){ss+=(x-m)**2;n++;}}return `${th}:${(ss/n).toFixed(4)}`;}).join(" "));
