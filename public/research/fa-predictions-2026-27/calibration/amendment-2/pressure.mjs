import fs from "node:fs";
const root=process.argv[2], cal=process.argv[3];
const vm=await import(`${root}/lib/value-model.mjs`); const ag=await import(`${root}/lib/aging-curve.mjs`);
const db0={meta:{baseYear:2026,seasonRemainingFraction:1}};
function aav(d,S){const role=d.role==="SP"?"starter":d.role==="RP"?"reliever":"position";const player={role,position:role==="position"?"SS":"P",depthPosition:role==="reliever"?"RP":role==="starter"?"SP":"SS"};
 const r=ag.agingRole(role),u=ag.agingUnit(r).amount;let rate=d.w,wl=u,pv=0,ann=0;
 for(let i=0;i<d.yrs;i++){if(i>0){const a=d.age+i;rate+=ag.empiricalRateChange(r,a,player.position);wl*=ag.workloadRetention(r,a);}const w=i?Math.max(-0.5,rate*wl/u):d.w;
  const f=1/Math.pow(1.1,i+1);pv+=vm.marketValueForSeason(player,{year:2026+i,war:w},S,db0)*f;ann+=f;}return pv/ann;}
const s=JSON.parse(fs.readFileSync(`${cal}/raw/signings_marcel.json`,"utf8")).filter(d=>d.role!=="RP"&&d.w>=1&&d.aav>=2&&!/Ohtani|Yamamoto/.test(d.name));
const sets={"v1 11/20":{...vm.initialSettings,dollarsPerWar:11,starPremium:20},"v2 10.5/10":{...vm.initialSettings,dollarsPerWar:10.5,starPremium:10}};
const agg=(g,S)=>{let a=0,m=0,l=[];for(const d of g){const x=aav(d,S);a+=d.aav;m+=x;l.push(Math.log(d.aav/x));}l.sort((p,q)=>p-q);return `n=${String(g.length).padStart(3)} ratio ${(a/m).toFixed(2)} median ${Math.exp(l[l.length>>1]).toFixed(2)}`;};
for(const [k,S] of Object.entries(sets)){console.log(`== ${k} (proxy WAR, all years, 2026$)`);
 for(const y of [2020,2021,2022,2023,2024,2025,2026]) console.log(` ${y}: ${agg(s.filter(d=>d.season===y),S)}`);
 for(const [lab,f] of [["1 yr",d=>d.yrs===1],["2-3",d=>d.yrs>=2&&d.yrs<=3],["4-6",d=>d.yrs>=4&&d.yrs<=6],["7+",d=>d.yrs>=7]]) console.log(` term ${lab}: ${agg(s.filter(f),S)}`);
 for(const [lab,f] of [["w 1-2",d=>d.w<2],["w 2-3",d=>d.w>=2&&d.w<3],["w 3-4",d=>d.w>=3&&d.w<4],["w 4+",d=>d.w>=4],["w4+ short<=5y",d=>d.w>=4&&d.yrs<=5],["w4+ long>=7y",d=>d.w>=4&&d.yrs>=7]]) console.log(` ${lab}: ${agg(s.filter(f),S)}`);
 console.log(` 2025-26 w3+: ${agg(s.filter(d=>d.season>=2025&&d.w>=3),S)} | 2020-24 w3+: ${agg(s.filter(d=>d.season<=2024&&d.w>=3),S)}`);
}
// FA-equivalent prices from the live database for the top players
const DB=JSON.parse(fs.readFileSync(`${root}/app/data/player-database.json`,"utf8"));
const pick=["Bobby Witt Jr.","Juan Soto","Tarik Skubal","Paul Skenes","Gunnar Henderson","Aaron Judge"];
for(const [k,S] of Object.entries(sets)) for(const n of pick){const p=DB.players.find(x=>x.name===n);if(!p)continue;const w=p.threeYearProjection.find(x=>x.year===2027).war;const role=p.agingModel.role==="starter"?"SP":"H";
 for(const yrs of [8,10,12]) console.log(k,n,"age27",p.age+1,"w27",w,`${yrs}y AAV ${aav({role,age:p.age+1,w,yrs},S).toFixed(1)}`);}
