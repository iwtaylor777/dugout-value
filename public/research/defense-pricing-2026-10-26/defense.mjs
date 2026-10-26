import fs from "node:fs";
const root=process.argv[2], cal=process.argv[3];
const vm=await import(`${root}/lib/value-model.mjs`); const ag=await import(`${root}/lib/aging-curve.mjs`);
const db0={meta:{baseYear:2026,seasonRemainingFraction:1}}; const S=vm.initialSettings;
const fg={}; for(let y=2015;y<=2026;y++) for(const r of JSON.parse(fs.readFileSync(`raw/fg_bat_${y}.json`)).data) (fg[r.playerid]??={})[y]=r;
function aav(w,age,yrs,pos){const player={role:"position",position:pos,depthPosition:pos};const r=ag.agingRole("position"),u=ag.agingUnit(r).amount;let rate=w,wl=u,pv=0,ann=0;
 for(let i=0;i<yrs;i++){if(i>0){const a=age+i;rate+=ag.empiricalRateChange(r,a,pos);wl*=ag.workloadRetention(r,a);}const ww=i?Math.max(-0.5,rate*wl/u):w;const f=1/Math.pow(1.1,i+1);pv+=vm.marketValueForSeason(player,{year:2026+i,war:ww},S,db0)*f;ann+=f;}return pv/ann;}
const raw=JSON.parse(fs.readFileSync(`${cal}/raw/fg_fa_tracker_2020_2027.json`));
const rows=[];
for(const d of raw){ if(d.ContractType!=="Free Agent"||!d.ContractTotal||!d.YearsTotal) continue; const pos=(d.position||"").split("/")[0]; if(["SP","RP","CL","P"].includes(pos)) continue;
 const h=fg[d.playerId]; if(!h) continue; const t=d.tracker_season; let W=0,PA=0,O=0,D=0,Fl=0,Ps=0,wt=0;
 for(const [k,w] of [[1,5],[2,4],[3,3]]){const s=h[t-k]; if(!s) continue; const sc=(t-k)===2020?162/60:1; W+=w*s.WAR*sc; PA+=w*s.PA*sc; O+=w*(s.Offense??0)*sc; D+=w*(s.Defense??0)*sc; Fl+=w*(s.Fielding??0)*sc; Ps+=w*(s.Positional??0)*sc; wt+=w;}
 if(PA<300*wt/ (wt||1) ) {} if(wt===0||PA/wt<250) continue;
 const war=W/wt, aavAct=d.ContractTotal/d.YearsTotal/1e6*Math.pow(1.03,2026-t); if(war<1||aavAct<2) continue;
 const model=aav(war,d.age,d.YearsTotal,pos);
 rows.push({name:d.playerName,t,pos,age:d.age,yrs:d.YearsTotal,war:+war.toFixed(2),off600:O/PA*600,def600:D/PA*600,fld600:Fl/PA*600,pos600:Ps/PA*600,lr:Math.log(aavAct/model),aav:aavAct,model});
}
function ols(X,y){const n=X.length,k=X[0].length;const XtX=Array.from({length:k},()=>Array(k).fill(0)),Xty=Array(k).fill(0);
 for(let i=0;i<n;i++)for(let a=0;a<k;a++){Xty[a]+=X[i][a]*y[i];for(let b=0;b<k;b++)XtX[a][b]+=X[i][a]*X[i][b];}
 // solve
 const M=XtX.map((r,i)=>[...r,Xty[i]]);for(let i=0;i<k;i++){let p=i;for(let j=i+1;j<k;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;[M[i],M[p]]=[M[p],M[i]];for(let j=0;j<k;j++)if(j!==i){const f=M[j][i]/M[i][i];for(let c=i;c<=k;c++)M[j][c]-=f*M[i][c];}}
 return M.map((r,i)=>r[k]/r[i]);}
function boot(fn,n=2000){let s=1;const rnd=()=>((s=(s*16807)%2147483647)/2147483647);const out=[];for(let b=0;b<n;b++){const R=Array.from({length:rows.length},()=>rows[Math.floor(rnd()*rows.length)]);out.push(fn(R));}out.sort((a,b)=>a-b);return [out[Math.floor(n*.025)],out[Math.floor(n*.975)]];}
const yrs=[...new Set(rows.map(r=>r.t))].sort();
const fit=(R)=>{const X=R.map(r=>[1,r.def600/10,r.war,...yrs.slice(1).map(y=>r.t===y?1:0)]);return ols(X,R.map(r=>r.lr));};
const b=fit(rows); const ci=boot(R=>fit(R)[1]);
console.log("n",rows.length,"hitter FA deals 2020-26 (3-yr WAR>=1)");
console.log("log(actual/model) per +1 win of defense per 600 PA (controls: WAR, signing year):",b[1].toFixed(3),"95% CI",ci.map(x=>x.toFixed(3)).join(" to "));
// also split fielding vs positional
const fit2=(R)=>{const X=R.map(r=>[1,r.fld600/10,r.pos600/10,r.war,...yrs.slice(1).map(y=>r.t===y?1:0)]);return ols(X,R.map(r=>r.lr));};
const b2=fit2(rows); const ci2a=boot(R=>fit2(R)[1]), ci2b=boot(R=>fit2(R)[2]);
console.log("fielding per win/600:",b2[1].toFixed(3),ci2a.map(x=>x.toFixed(3)).join(" to "),"| positional per win/600:",b2[2].toFixed(3),ci2b.map(x=>x.toFixed(3)).join(" to "));
// terciles of defensive share
const share=r=>r.def600/(Math.abs(r.off600)+Math.abs(r.def600)+1e-9);
const srt=[...rows].sort((a,b)=>share(a)-share(b)); const q=Math.floor(srt.length/3);
for(const [lab,g] of [["offense-heavy",srt.slice(0,q)],["middle",srt.slice(q,2*q)],["defense-heavy",srt.slice(2*q)]]){const a=g.reduce((s,r)=>s+r.aav,0),m=g.reduce((s,r)=>s+r.model,0);console.log(lab,"n",g.length,"actual/model",(a/m).toFixed(2),"mean WAR",(g.reduce((s,r)=>s+r.war,0)/g.length).toFixed(2));}
fs.writeFileSync("defense_rows.json",JSON.stringify(rows));
const top=rows.filter(r=>r.def600>=12).sort((a,b)=>b.def600-a.def600).slice(0,12).map(r=>`${r.name} ${r.t} def${r.def600.toFixed(0)} ${Math.exp(r.lr).toFixed(2)}`); console.log(top.join("; "));
