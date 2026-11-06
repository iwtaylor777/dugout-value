import {forecastWarPath,priceContract} from './free-agent-pricing.mjs';

// Game asking prices follow attributed market forecasts when covered. The model
// valuation remains available separately on each row.
export function marketTracker(tracker) {
  return {...tracker,players:tracker.players.map(row=>row.marketForecast?.reference
    ? {...row,modelValue:row.modelValue??{years:row.years,total:row.total,aav:row.aav},...row.marketForecast.reference}
    : row)};
}

export function currentFreeAgentValues({tracker,database,projections,frozen,market,terms,fallbacks,date}) {
  const dbPlayers=new Map(database.players.filter(p=>p.kind==='mlb').map(p=>[p.id,p]));
  const published=new Map(frozen.predictions.map(p=>[p.id,p]));
  const players=tracker.players.map(row=>{
    const old=published.get(row.id);
    const publishedForecast=old?{date:'2026-10-29',revision:'R2',rank:old.rank,years:old.years,total:old.total_musd,aav:old.aav_musd,war2027:old.war_2027,flag:old.flag||null}:null;
    const marketForecast=market.players[row.id]??null;
    if(row.market==='unmodeled'||row.total==null)return {...row,publishedForecast,marketForecast};
    const p=dbPlayers.get(row.id)??{id:row.id,name:row.name,age:row.age-1,position:row.pos,role:row.role};
    const canonical=projections.players[row.id],fallback=fallbacks.players[row.id];
    let warPath;
    if(canonical)warPath=forecastWarPath(p,canonical);
    else if(fallback){
      const baseline={...p,threeYearProjection:Object.entries(fallback.war).map(([year,war])=>({year:Number(year),war})),agingModel:{baseAge:row.age,anchorYear:2027}};
      warPath=forecastWarPath(baseline,null);
    } else throw new Error(`Missing current forecast for ${row.name}`);
    const term=terms.players[row.id];
    if(!term)throw new Error(`Choose a comparison term for ${row.name}`);
    const quote=priceContract(p,warPath,database,undefined,term.years);
    const war5=Object.fromEntries(Object.entries(warPath).filter(([year])=>+year<=2031));
    const flag=old&&/Term set|by hand|model's rule/.test(old.flag??'')?null:row.flag;
    return {...row,flag,basis:'live',war2027:warPath[2027],warPath:war5,years:quote.years,total:quote.total_musd,aav:quote.aav_musd,comparisonBasis:term.basis,publishedForecast,marketForecast};
  });
  players.sort((a,b)=>(b.total??-1)-(a.total??-1)||a.name.localeCompare(b.name));
  return {meta:{...tracker.meta,built:date,projections:projections.meta.model,priceBasis:'Current projected production over fixed comparison terms; public forecasts shown separately',marketAsOf:market.meta.asOf,scoredRelease:{revision:'R2',path:'/research/fa-predictions-2026-27',count:players.filter(p=>p.publishedForecast).length},players:players.length},players};
}
