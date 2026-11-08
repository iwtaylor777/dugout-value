import type {GmContext,GmMoves} from './gm-sim.mjs';
export function createGame(team:string,seed:number,competitive?:boolean):GmMoves;
export function act(ctx:GmContext,state:GmMoves,action:unknown[]):{accepted:boolean;reason:string;moves?:GmMoves;news?:string[]};
export function encodeGame(state:GmMoves):string;
export function decodeGame(text:string):unknown;
export function replayGame(ctx:GmContext,save:unknown,options?:{repair?:boolean}):{moves:GmMoves|null;reason?:string;dropped?:number[]};
export function undoGame(ctx:GmContext,state:GmMoves,kind:string,index:number):{moves:GmMoves;removed:number};
