import fs from "node:fs";
const root=process.env.HOME+"/build/model"; const cal=process.env.HOME+"/mnt/Baseball/analysis/fa_market_calibration";
const vm=await import(`${root}/lib/value-model.mjs`); const ag=await import(`${root}/lib/aging-curve.mjs`);
const db0={meta:{baseYear:2026,seasonRemainingFraction:1}}; const S=vm.initialSettings;
const P=JSON.parse(fs.readFileSync("predictive.json")); const bt=P.total; // off,fld,pos,age-29,ppa,const
const fg={}; for(let y=2015;y<=2026;y++) for(const r of JSON.parse(fs.readFileSync(`../proj/raw/fg_bat_${y}.json`)).data) (fg[r.playerid]??={})[y]=r;
function aav(w,age,yrs,pos){const player={role:"position",position:pos,depthPosition:pos};const r=ag.agingRole("position"),u=ag.agingUnit(r).amount;let rate=w,wl=u,pv=0,ann=0;
 for(let i=0;i<yrs;i++){if(i>0){const a=age+i;rate+=ag.empiricalRateChange(r,a,pos);wl*=ag.workloadRetention(r,a);}const ww=i?Math.max(-0.5,rate*wl/u):w;const f=1/Math.pow(1.1,i+1);pv+=vm.marketValueForSeason(player,{year:2026+i,war:ww},S,db0)*f;ann+=f;}return Math.max(0.78,pv/ann);}
const raw=JSON.parse(fs.readFileSync(`${cal}/raw/fg_fa_tracker_2020_2027.json`));
const rows=[];
for(const d of raw){ if(d.ContractType!=="Free Agent"||!d.ContractTotal||!d.YearsTotal) continue; const pos=(d.position||"").split("/")[0]; if(["SP","RP","CL","P","C"].includes(pos)) continue;
 const h=fg[d.playerId]; if(!h) continue; const t=d.tracker_season; let W=0,PA=0,O=0,F=0,Ps=0,wt=0;
 for(const [k,w] of [[1,5],[2,4],[3,3]]){const s=h[t-k]; if(!s||(t-k)===2020) continue; W+=w*s.WAR; PA+=w*s.PA; O+=w*((s.Batting??0)+(s.BaseRunning??0)); F+=w*(s.Fielding??0); Ps+=w*(s.Positional??0); wt+=w;}
 if(wt===0||PA/wt<250) continue;
 const war=W/wt, aavAct=d.ContractTotal/d.YearsTotal/1e6*Math.pow(1.03,2026-t); if(war<1||aavAct<2) continue;
 const off=O/PA*600, fld=F/PA*600, ps=Ps/PA*600, ppa=PA/12;
 const predTot=bt[0]*off+bt[1]*fld+bt[2]*ps+bt[3]*(d.age-29)+bt[4]*ppa+bt[5]; const pw=Math.max(0.1,predTot/3);
 rows.push({name:d.playerName,t,pos,age:d.age,yrs:d.YearsTotal,war,pw,off,fld,ps,aav:aavAct,mRaw:aav(war,d.age,d.YearsTotal,pos),mPred:aav(pw,d.age,d.YearsTotal,pos)});}
function ols(X,y){const k=X[0].length;const A=Array.from({length:k},()=>Array(k+1).fill(0));for(let i=0;i<X.length;i++)for(let a=0;a<k;a++){A[a][k]+=X[i][a]*y[i];for(let b=0;b<k;b++)A[a][b]+=X[i][a]*X[i][b];}
 for(let i=0;i<k;i++){let p=i;for(let j=i+1;j<k;j++)if(Math.abs(A[j][i])>Math.abs(A[p][i]))p=j;[A[i],A[p]]=[A[p],A[i]];for(let j=0;j<k;j++)if(j!==i){const f=A[j][i]/A[i][i];for(let c=i;c<=k;c++)A[j][c]-=f*A[i][c];}}return A.map((r,i)=>r[k]/r[i]);}
const yrs=[...new Set(rows.map(r=>r.t))].sort();
const fitB=(R,key)=>ols(R.map(r=>[1,r.fld/10,r.ps/10,...yrs.slice(1).map(y=>r.t===y?1:0)]),R.map(r=>Math.log(r.aav/r[key])));
let s=12345;const rnd=()=>((s=(s*16807)%2147483647)/2147483647);
const ci=(key,j)=>{const o=[];for(let b=0;b<2000;b++){const R=Array.from({length:rows.length},()=>rows[Math.floor(rnd()*rows.length)]);o.push(fitB(R,key)[j]);}o.sort((a,b)=>a-b);return [o[50],o[1949]].map(x=>x.toFixed(3));};
for(const key of ["mRaw","mPred"]){const b=fitB(rows,key);console.log(`${key==="mRaw"?"model on raw 3-yr WAR":"model on predicted WAR (each component weighted by its predictive value)"}: n=${rows.length} log(actual/model) per fielding win/600 = ${b[1].toFixed(3)} CI ${ci(key,1).join(" to ")} | per positional win/600 = ${b[2].toFixed(3)} CI ${ci(key,2).join(" to ")}`);}
// market's implied credit: grid on theta using predicted-WAR model (fielding coefficient scaled)
for(const th of [0,0.25,0.5,0.75,1.0]){let l=0;const R=rows.map(r=>{const pw=Math.max(0.1,r.pw-(1-th)*bt[1]*r.fld/3);const m=aav(pw,r.age,r.yrs,r.pos);return Math.log(r.aav/m);});const mu=R.reduce((a,b)=>a+b,0)/R.length;l=R.reduce((a,b)=>a+(b-mu)**2,0)/R.length;console.log(`  credit for predicted fielding value θ=${th}: residual variance ${l.toFixed(4)}`);}
fs.writeFileSync("fa_rows.json",JSON.stringify(rows));
