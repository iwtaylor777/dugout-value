import type { GmContext, GmMoves, GmSigning, GmMarket } from './gm-sim.mjs';
export const MARKET_ROUNDS: number;
export function newMarket(): GmMarket;
export type MarketEntry = { pid: string; preference: string; deadline: number; rivals: { pid: string; team: string; years: number; total: number; ceiling: number; score: number; gain: number }[] };
export function marketBoard(ctx: GmContext, moves: GmMoves): MarketEntry[];
export function submitMarketBid(ctx: GmContext, moves: GmMoves, bid: GmSigning): { accepted: boolean; reason: string; moves?: GmMoves };
export function advanceMarket(ctx: GmContext, moves: GmMoves): { moves: GmMoves; news: string[] };
export function standingPatMarket(ctx: GmContext, moves: GmMoves): GmMoves;
