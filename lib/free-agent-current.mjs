import {forecastWarPath,priceContract} from './free-agent-pricing.mjs';

const editorialSources = new Set(['MLB Trade Rumors', 'FanGraphs — Ben Clemens']);

// Use the editorial average with a published whole-year term for gameplay.
// Keep the DV valuation separate for grading signed contracts.
export function marketTracker(tracker) {
  const players = tracker.players.map(row => {
    const { reference, consensus } = row.marketForecast ?? {};
    if (!reference) return row;
    const modelValue = row.modelValue ?? { years: row.years, total: row.total, aav: row.aav };
    const total = consensus?.total ?? reference.total;
    return { ...row, modelValue, ...reference, total, aav: consensus ? total / reference.years : reference.aav };
  });
  return { ...tracker, players };
}

export function currentFreeAgentValues({tracker,database,projections,frozen,market,terms,fallbacks,date}) {
  const dbPlayers=new Map(database.players.filter(p=>p.kind==='mlb').map(p=>[p.id,p]));
  const published=new Map(frozen.predictions.map(p=>[p.id,p]));
  const players=tracker.players.map(row=>{
    const old=published.get(row.id);
    const publishedForecast=old?{date:'2026-10-29',revision:'R2',rank:old.rank,years:old.years,total:old.total_musd,aav:old.aav_musd,war2027:old.war_2027,flag:old.flag||null}:null;
    const publicForecast = market.players[row.id];
    const editorial = publicForecast?.forecasts.filter(forecast => editorialSources.has(forecast.label)) ?? [];
    const quotedTerms = [...new Set(editorial.map(forecast => forecast.years))].sort((a, b) => a - b);
    const consensus = editorial.length ? {
      total: editorial.reduce((sum, forecast) => sum + forecast.total, 0) / editorial.length,
      minYears: quotedTerms[0],
      maxYears: quotedTerms.at(-1),
      sourceCount: editorial.length,
      singleSource: editorial.length === 1 ? editorial[0].label : null,
    } : null;
    const marketForecast = publicForecast ? {...publicForecast, consensus, alternateValues: []} : null;
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
    if (marketForecast) {
      marketForecast.alternateValues = quotedTerms.filter(years => years !== quote.years).map(years => {
        const alternate = priceContract(p, warPath, database, undefined, years);
        return {years: alternate.years, total: alternate.total_musd, aav: alternate.aav_musd};
      });
    }
    const war5=Object.fromEntries(Object.entries(warPath).filter(([year])=>+year<=2031));
    const flag=old&&/Term set|by hand|model's rule/.test(old.flag??'')?null:row.flag;
    return {...row,flag,basis:'live',war2027:warPath[2027],warPath:war5,years:quote.years,total:quote.total_musd,aav:quote.aav_musd,comparisonBasis:term.basis,publishedForecast,marketForecast};
  });
  players.sort((a,b)=>(b.total??-1)-(a.total??-1)||a.name.localeCompare(b.name));
  return {meta:{...tracker.meta,built:date,projections:projections.meta.model,priceBasis:'Current projected production over fixed comparison terms; public forecasts shown separately',marketAsOf:market.meta.asOf,scoredRelease:{revision:'R2',path:'/research/fa-predictions-2026-27',count:players.filter(p=>p.publishedForecast).length},players:players.length},players};
}
