// Saves contain intentions, never trusted market outcomes. One reducer serves
// play, undo and replay; changing an action recomputes the subsequent world.
import {buildLeague, signFreeAgent, respondToTrade, openingTeamModes} from './gm-sim.mjs';
import {newMarket, submitMarketBid, withdrawMarketBid, advanceMarket} from './gm-market.mjs';
export const GAME_VERSION = 3;
export const createGame = (team,seed,competitive=true) => ({team,seed,budget:null,signings:[],trades:[],journal:[],...(competitive?{market:newMarket()}:{})});
export function act(ctx,state,action) {
  try {
    if (!Array.isArray(action) || (state.journal?.length ?? 0)>=200) throw Error('Invalid action or offseason action limit reached.');
    const [kind,payload]=action;
    const budget=state.budget ?? Math.round(ctx.sim.teams[state.team].cbt2026);
    let answer, next, clean;
    if(kind==='budget') {
      if(payload!==null&&(!Number.isFinite(payload)||payload<60||payload>480)) throw Error('Budget must be between $60M and $480M.');
      next={...state,budget:payload};clean=[kind,payload];
    } else if(kind==='bid'||kind==='sign') {
      const bid={pid:payload.pid,years:payload.years,total:payload.total}; clean=[kind,bid];
      if(kind==='bid') {answer=submitMarketBid(ctx,state,bid);next=answer.moves;}
      else {
        if(state.market&&state.market.round<3) throw Error('Submit a bid while the market is open.');
        const offer={...bid,...(state.market?{closeout:true}:{})};
        answer=signFreeAgent(ctx,buildLeague(ctx,state),state,budget,ctx.tracker.players.find(p=>p.id===bid.pid),offer,state.seed);
        if(answer.accepted) next={...state,signings:[...state.signings,offer]};
      }
    } else if(kind==='trade') {
      const trade={partner:payload.partner,give:payload.give,get:payload.get,cash:payload.cash??0};clean=[kind,trade];
      answer=respondToTrade(ctx,buildLeague(ctx,state),state,budget,trade,openingTeamModes(ctx));
      if(answer.accepted) next={...state,trades:[...state.trades,trade]};
    } else if(kind==='withdraw') {
      if(!state.market?.bids.some(b=>b.pid===payload)) throw Error('No pending offer to withdraw.');
      next=withdrawMarketBid(state,payload);clean=[kind,payload];
    } else if(kind==='advance') {
      if(!state.market||state.market.round>=3) throw Error('The market cannot advance.');
      answer=advanceMarket(ctx,state);next=answer.moves;clean=[kind];
    } else throw Error('Unknown offseason action.');
    if(!next) return {...answer,accepted:false};
    return {...answer,accepted:true,reason:answer?.reason??'Updated.',moves:{...next,journal:[...(state.journal??[]),clean]}};
  } catch(error) {return {accepted:false,reason:error.message??'This action could not be applied.'};}
}
export function replayGame(ctx,save,{repair=false}={}) {
  if(save?.v!==GAME_VERSION||!ctx.sim.teams[save.team]||!Number.isInteger(save.seed)||save.seed<1||save.seed>0xffffffff||typeof save.competitive!=='boolean'||!Array.isArray(save.actions)||save.actions.length>200) return {moves:null,reason:'This save predates verified action replay or has invalid data. Keep a backup; its final roster cannot be treated as a verified game.'};
  let state=createGame(save.team,save.seed,save.competitive);const dropped=[];
  for(const [index,action] of save.actions.entries()) {
    const result=act(ctx,state,action);
    if(!result.accepted) {if(!repair) return {moves:null,reason:`Action ${index+1} cannot replay: ${result.reason}`};dropped.push(index);}
    else state=result.moves;
  }
  return {moves:state,dropped};
}
export const gameSave = state => ({v:GAME_VERSION,team:state.team,seed:state.seed,competitive:!!state.market,actions:state.journal??[]});
export function encodeGame(state) {
  const json=JSON.stringify(gameSave(state));
  return (typeof Buffer!=='undefined'?Buffer.from(json).toString('base64'):btoa(unescape(encodeURIComponent(json)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeGame(text) {
  try {if(typeof text!=='string'||text.length>100000)return null;const raw=text.replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(typeof Buffer!=='undefined'?Buffer.from(raw,'base64').toString():decodeURIComponent(escape(atob(raw))));}catch{return null;}
}
export function undoGame(ctx,state,kind,index) {
  const actions=state.journal??[];let seen=-1;const pid=state.signings[index]?.pid;
  const retained=actions.filter(a=>kind==='trade' ? !(a[0]==='trade'&&++seen===index) : !(['bid','sign'].includes(a[0])&&a[1]?.pid===pid) && !(a[0]==='withdraw'&&a[1]===pid));
  const result=replayGame(ctx,{...gameSave(state),actions:retained},{repair:true});
  if(!result.moves) throw Error(result.reason);
  return {moves:result.moves,removed:1+result.dropped.length};
}
