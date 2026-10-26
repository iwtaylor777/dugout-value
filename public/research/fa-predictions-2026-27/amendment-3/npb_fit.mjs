import fs from "node:fs";
const root=process.argv[2]; const vm=await import(`${root}/lib/value-model.mjs`); const ag=await import(`${root}/lib/aging-curve.mjs`);
const db0={meta:{baseYear:2026,seasonRemainingFraction:1}}; const S=vm.initialSettings;
function aav(w,age,yrs,pos="3B"){const player={role:"position",position:pos,depthPosition:pos};const r=ag.agingRole("position"),u=ag.agingUnit(r).amount;let rate=w,wl=u,pv=0,ann=0;
 for(let i=0;i<yrs;i++){if(i>0){const a=age+i;rate+=ag.empiricalRateChange(r,a,pos);wl*=ag.workloadRetention(r,a);}const ww=i?Math.max(-0.5,rate*wl/u):w;const f=1/Math.pow(1.1,i+1);pv+=vm.marketValueForSeason(player,{year:2026+i,war:ww},S,db0)*f;ann+=f;}return pv/ann;}
const sm=JSON.parse(fs.readFileSync("npb/summary.json"));
// last three NPB seasons before the move, 3:2:1 by recency (protocol rule)
const moves={"Seiya Suzuki":{to:2022,age:27,yrs:5,tot:85},"Masataka Yoshida":{to:2023,age:29,yrs:5,tot:90},"Munetaka Murakami":{to:2026,age:26,yrs:2,tot:34},"Kazuma Okamoto":{to:2026,age:30,yrs:4,tot:60},"Yoshi Tsutsugo":{to:2020,age:28,yrs:2,tot:12},"Shogo Akiyama":{to:2020,age:32,yrs:3,tot:21}};
const war=(wrc,pa=550)=>(((wrc-100)*0.7)-3+20)*(pa/600)/10;
const pts=[];
for(const p of sm){const m=moves[p.name]; if(!m) continue;
 const npb=p.foreign.filter(r=>r[1]==="NPB"&&r[0]<m.to).sort((a,b)=>b[0]-a[0]).slice(0,3);
 const ws=[3,2,1]; const x=npb.reduce((s,r,i)=>s+ws[i]*r[3],0)/ws.slice(0,npb.length).reduce((a,b)=>a+b,0);
 const ml=p.mlb.filter(r=>r[0]>=m.to).slice(0,2); const mpa=ml.reduce((s,r)=>s+r[1],0); const y=ml.reduce((s,r)=>s+r[1]*r[2],0)/mpa;
 pts.push({name:p.name,...m,npb:x,mlb:y,mpa,npbSeasons:npb.map(r=>r[0])});}
let num=0,den=0,num2=0,den2=0; for(const q of pts){num+=q.mpa*(q.npb-100)*(q.mlb-100);den+=q.mpa*(q.npb-100)**2; if(q.to>=2022){num2+=q.mpa*(q.npb-100)*(q.mlb-100);den2+=q.mpa*(q.npb-100)**2;}}
const k=num/den,k2=num2/den2; console.log("translation k, all 6:",k.toFixed(3),"| 2022+ moves (4):",k2.toFixed(3));
for(const q of pts) console.log(`${q.name} ${q.to}: NPB ${q.npb.toFixed(0)} (${q.npbSeasons}) -> MLB ${q.mlb.toFixed(0)} in ${q.mpa} PA, implied k ${((q.mlb-100)/(q.npb-100)).toFixed(2)}`);
// market: contracts vs model at translated WAR (k), AAV in 2026 dollars
for(const kk of [0.25,k2,k]){let a=0,mm=0;const rows=[];for(const q of pts.filter(q=>q.to>=2022)){const w=war(100+kk*(q.npb-100));const mod=aav(w,q.age,q.yrs);const act=q.tot/q.yrs*Math.pow(1.03,2026-q.to);a+=act;mm+=mod;rows.push(`${q.name.split(" ")[1]} war ${w.toFixed(1)} model ${mod.toFixed(1)} actual ${act.toFixed(1)}`);}
 console.log(`k=${kk.toFixed(3)}: recent NPB hitters signed for ${(a/mm).toFixed(2)}x model | `+rows.join("; "));}
// Sato
const satoNpb=181; for(const kk of [0.25,k2,k]){const w=war(100+kk*(satoNpb-100));console.log(`Sato k=${kk.toFixed(3)}: wRC+ ${(100+kk*81).toFixed(0)}, WAR ${w.toFixed(2)}`);}
