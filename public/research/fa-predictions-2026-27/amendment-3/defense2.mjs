import fs from "node:fs";
const root=process.argv[2];
const vm=await import(`${root}/lib/value-model.mjs`); const ag=await import(`${root}/lib/aging-curve.mjs`);
const db0={meta:{baseYear:2026,seasonRemainingFraction:1}}; const S=vm.initialSettings;
function aav(w,age,yrs,pos){const player={role:"position",position:pos,depthPosition:pos};const r=ag.agingRole("position"),u=ag.agingUnit(r).amount;let rate=w,wl=u,pv=0,ann=0;
 for(let i=0;i<yrs;i++){if(i>0){const a=age+i;rate+=ag.empiricalRateChange(r,a,pos);wl*=ag.workloadRetention(r,a);}const ww=i?Math.max(-0.5,rate*wl/u):w;const f=1/Math.pow(1.1,i+1);pv+=vm.marketValueForSeason(player,{year:2026+i,war:ww},S,db0)*f;ann+=f;}return pv/ann;}
const rows=JSON.parse(fs.readFileSync("defense_rows.json"));
for(const [lab,R] of [["all",rows],["no catchers",rows.filter(r=>r.pos!=="C")],["2023-26, no C",rows.filter(r=>r.pos!=="C"&&r.t>=2023)],["catchers",rows.filter(r=>r.pos==="C")]]){
 const res=[];
 for(let th=0;th<=1.0001;th+=0.1){let l=0,a=0,m=0;for(const r of R){const wadj=r.war-(1-th)*(r.fld600/10)*(r.war? 1:1)*( (r.war&&1) ); const mod=Math.max(0.78,aav(Math.max(0.1,wadj),r.age,r.yrs,r.pos));const lr=Math.log(r.aav/mod);l+=lr*lr;a+=r.aav;m+=mod;}res.push(`θ=${th.toFixed(1)} mse ${(l/R.length).toFixed(3)} ratio ${(a/m).toFixed(2)}`);}
 console.log(lab,"n",R.length); console.log(" "+res.join("\n "));}
