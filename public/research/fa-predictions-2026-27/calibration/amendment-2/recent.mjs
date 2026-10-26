import fs from "node:fs";
const root=process.argv[2], cal=process.argv[3];
const vm=await import(`${root}/lib/value-model.mjs`); const ag=await import(`${root}/lib/aging-curve.mjs`);
const db0={meta:{baseYear:2026,seasonRemainingFraction:1}};
function aav(d,S){const role=d.role==="SP"?"starter":d.role==="RP"?"reliever":"position";const player={role,position:role==="position"?"SS":"P",depthPosition:role==="reliever"?"RP":role==="starter"?"SP":"SS"};
 const r=ag.agingRole(role),u=ag.agingUnit(r).amount;let rate=d.w,wl=u,pv=0,ann=0;
 for(let i=0;i<d.yrs;i++){if(i>0){const a=d.age+i;rate+=ag.empiricalRateChange(r,a,player.position);wl*=ag.workloadRetention(r,a);}const w=i?Math.max(-0.5,rate*wl/u):d.w;
  const f=1/Math.pow(1.1,i+1);pv+=vm.marketValueForSeason(player,{year:2026+i,war:w},S,db0)*f;ann+=f;}return pv/ann;}
const all=JSON.parse(fs.readFileSync(`${cal}/raw/signings_marcel.json`,"utf8")).filter(d=>d.role!=="RP"&&d.aav>=2&&!/Ohtani|Yamamoto/.test(d.name));
const G={
 "2026 class, FG projections, w>=1":all.filter(d=>d.season===2026&&d.wp!=null&&d.wp>=1).map(d=>({...d,w:d.wp})),
 "2026 class, FG projections, w>=3":all.filter(d=>d.season===2026&&d.wp!=null&&d.wp>=3).map(d=>({...d,w:d.wp})),
 "2025-26, proxy, w>=1":all.filter(d=>d.season>=2025&&d.w>=1),
 "2025-26, proxy, w>=3":all.filter(d=>d.season>=2025&&d.w>=3),
 "2025-26, proxy, $100M+ deals":all.filter(d=>d.season>=2025&&d.w>=2.5&&d.tot>=100),
 "2025-26, proxy, 5+ years":all.filter(d=>d.season>=2025&&d.w>=2&&d.yrs>=5),
};
for(const [k,g] of Object.entries(G)) console.log(k, "n="+g.length, g.filter(d=>d.yrs>=5||d.w>=3.5).map(d=>`${d.name} ${d.season} ${d.yrs}y ${d.aav.toFixed(1)}`).slice(0,14).join("; "));
const grid=[[10.5,10],[11,20],[11,30],[11.5,30],[12,30]];
for(const [D,P] of grid){const S={...vm.initialSettings,dollarsPerWar:D,starPremium:P};
 console.log(`$${D}/${P}%: `+Object.entries(G).map(([k,g])=>{let a=0,m=0,l=0;for(const d of g){const x=aav(d,S);a+=d.aav;m+=x;l+=Math.log(d.aav/x)**2;}return `${k.split(",").slice(-1)[0].trim()}|${k.slice(0,7)} ${(a/m).toFixed(2)} (mse ${(l/g.length).toFixed(2)})`;}).join("  "));}
