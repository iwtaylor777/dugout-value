import { agingRole, agingUnit, empiricalRateChange, workloadRetention } from './aging-curve.mjs';
import { initialSettings, isReliever, marketValueForSeason } from './value-model.mjs';

export const nameKey = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/gi,'').toLowerCase();
export const projectionAge = player => player.agingModel?.baseAge != null
  ? player.agingModel.baseAge + 2027 - player.agingModel.anchorYear : player.age + 1;

export function forecastWarPath(player, dv, years=12) {
  const role=agingRole(player.role ?? 'position'), unit=agingUnit(role).amount;
  const age=projectionAge(player), out={};
  if (dv?.war && dv.rate && dv.pt) {
    for(let y=2027;y<=2031;y++) {
      if(!Number.isFinite(dv.war[y])) throw new Error(`Missing DV season ${player.name} ${y}`);
      out[y]=dv.war[y];
    }
    const dvUnit=dv.unit==='180 IP'?180:600;
    let rate=dv.rate['2031']*unit/dvUnit, workload=dv.pt['2031'];
    for(let y=2032;y<2027+years;y++) {
      rate+=empiricalRateChange(role,age+y-2027,player.position);
      workload*=workloadRetention(role,age+y-2027);
      out[y]=Math.max(-.5,Math.round(rate*workload/unit*100)/100);
    }
    return out;
  }
  // Players outside DV coverage retain their published baseline; Sato uses the separately frozen translation.
  const published=Object.fromEntries((player.threeYearProjection??[]).filter(s=>s.year>=2027).map(s=>[s.year,s.war]));
  const last=Math.max(...Object.keys(published).map(Number));
  if(!Number.isFinite(last)) throw new Error(`No projection for ${player.name}`);
  const am=player.agingModel??{};
  for(let y=2027;y<2027+years;y++) {
    if(published[y]!=null){out[y]=published[y];continue;}
    let rate=published[last],workload=unit;
    for(let k=1;k<=y-last;k++) {
      const a=age+last-2027+k,tw=am.rateTrend==null?0:.35*.6**(k-1),rw=am.workloadRetention==null?0:.5*.6**(k-1);
      rate+=empiricalRateChange(role,a,player.position)*(1-tw)+(am.rateTrend??0)*tw;
      workload*=workloadRetention(role,a)*(1-rw)+(am.workloadRetention??1)*rw;
    }
    out[y]=Math.max(-.5,Math.round(rate*workload/unit*10)/10);
  }
  return out;
}

export function contractTerm(player,path) {
  const age=projectionAge(player),reliever=isReliever(player),pitcher=['starter','reliever'].includes(player.role),w0=path[2027];
  let cap=reliever?(w0<1?2:w0<1.5?3:4):pitcher?(w0<2?2:w0<3?4:w0<4.5?6:8):(w0<2?2:w0<3?4:w0<4?6:w0<5?8:10);
  if(age>=36)cap=1;else if(age>=34)cap=Math.min(cap,2);
  const elite=w0>=4.5;if(elite)cap=10;
  const limit=(pitcher?36:37)+(elite?3:0),minimum=reliever?.5:1;
  let n=0;
  for(const y of Object.keys(path).map(Number).sort((a,b)=>a-b)) {
    if(path[y]<minimum||age+y-2027>limit||n>=cap)break;
    n++;
  }
  return Math.max(1,n);
}

export function priceContract(player,path,database,settings=initialSettings) {
  const years=contractTerm(player,path),discount=settings.timingPreference/100;
  const mv=Object.fromEntries(Object.entries(path).map(([year,war])=>[year,marketValueForSeason(player,{year:Number(year),war},settings,database)]));
  let value=0,annuity=0;
  for(let i=0;i<years;i++){const factor=(1+discount)**(-i-1);value+=mv[2027+i]*factor;annuity+=factor;}
  const aav=value/annuity;
  return {years,total_musd:+(aav*years).toFixed(1),aav_musd:+aav.toFixed(1),war_2027:path[2027],war_path:Object.fromEntries(Object.entries(path).slice(0,years)),market_values:mv};
}

export function marketReach(note,values,confirmedFreeAgent=false) {
  if(confirmedFreeAgent)return null;
  let m=/^club ([\d.]+)(?: buyout ([\d.]+))?/.exec(note??'');
  if(m&&values[2027]>=Number(m[1])-Number(m[2]??0))return 'club option likely exercised';
  m=/^(?:optout (\d+)y |playeroption )([\d.]+)/.exec(note??'');
  if(m){const years=Number(m[1]??1),remaining=Array.from({length:years},(_,i)=>values[2027+i]??0).reduce((a,b)=>a+b,0);if(remaining<=Number(m[2]))return 'likely stays';}
  return null;
}
