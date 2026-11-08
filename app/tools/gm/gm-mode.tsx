"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TradePlayerSearch } from "./trade-player-search";
import { createGmShareUrl, readGmSaveUrl } from "../../../lib/gm-share-url.mjs";
import { createGame, act, encodeGame, decodeGame, replayGame, undoGame } from "../../../lib/gm-game.mjs";
import depth from "../../data/depth-chart.json";
import trackerData from "../../data/free-agent-tracker.json";
import { marketTracker } from "../../../lib/free-agent-current.mjs";
import signingsData from "../../data/free-agent-signings.json";
import simData from "../../data/gm-sim.json";
import payrollData from "../../data/team-payroll.json";
import { allocate, bestAdditions, POSITIONS, PITCHING } from "../../../lib/depth-chart.mjs";
import { matchesProjectionRole } from "../../../lib/projection-filters.mjs";
import { expectedMarket, prospectBrief, ownedRoster, couldFitBudget, alternativeRole, isUsefulAlternative, resultImpact } from "../../../lib/gm-experience.mjs";
import { matchesTradePlayer } from "../../../lib/gm-trade-search.mjs";
import { advanceMarket, marketBoard, MARKET_ROUNDS, newMarket, userOfferOutcomes } from "../../../lib/gm-market.mjs";
import {
  aiFreeAgency, buildLeague, movesValue, payrollFor, rosterOf, offseasonObjective, objectiveGrade,
  simulateSeasons, openingTeamModes, teamStrengths, seasonReadiness, playerContract, rivalBudget,
} from "../../../lib/gm-sim.mjs";
import type { GmContext, GmMoves, GmTeamResult, TrackerRow } from "../../../lib/gm-sim.mjs";

const tracker = marketTracker(trackerData);
const ctx = { players: depth.players, tracker, signings: signingsData, sim: simData, payroll: payrollData.cbt } as unknown as GmContext;
const teams = Object.entries(ctx.sim.teams).sort((a, b) => a[1].name.localeCompare(b[1].name));
const faRows = new Map((tracker.players as TrackerRow[]).map((r) => [r.id, r]));
const V = ctx.sim.players;
const SIMS = 10000;
const money = (v: number) => `${v < 0 ? "−" : ""}$${Math.abs(v) >= 100 ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(1)}M`;
const signedMoney = (v: number) => `${v >= 0.05 ? "+" : v <= -0.05 ? "−" : ""}${money(Math.abs(v))}`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const signedPts = (v: number) => `${v >= 0.0005 ? "+" : v <= -0.0005 ? "−" : ""}${Math.abs(v * 100).toFixed(1)} pts`;
const signedWins = (v: number) => `${v >= 0.05 ? "+" : v <= -0.05 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
const yearsLabel = (years: number) => `${years} ${years === 1 ? "yr" : "yrs"}`;
const budgetRange = (value: number) => value < .05 ? "No room" : value < 5 ? "Under $5M" : `$${Math.floor(value / 5) * 5}–${Math.floor(value / 5) * 5 + 5}M`;
const outcomeLabels: Record<string, string> = { signed: "Signed with you", lost: "Signed elsewhere", minor: "Took a non-roster invite", submitted: "Offer submitted", pending: "Still considering", unsigned: "Not signed", withdrawn: "You withdrew", undone: "Signing undone" };
const newSeed = () => Math.floor(Math.random() * 1e9) + 1;
const label = (pid: string, i?: string) => `${V[pid]?.n ?? faRows.get(pid)?.name ?? ctx.players.find(p => p.pid === pid)?.n ?? pid}${i?.endsWith("-bat") ? " (hitting)" : i?.endsWith("-pit") ? " (pitching)" : ""}`;
const defaultOffer = () => ({ years: "", total: "" });
const TABS = ["fa", "trade", "roster", "moves"] as const;
const contractType = (type: string) => type.startsWith("arb") ? "arbitration estimate" : type === "preArb" || type === "prearb" ? "pre-arbitration estimate" : type === "clubOption" ? "club option" : type === "playerOption" ? "player option" : type === "mutualOption" ? "mutual option" : type === "fixed" ? "contract" : "estimate";
const contractBrief = (contract: ReturnType<typeof playerContract>) => contract.minorInvite ? "Non-roster invite · no MLB payroll charge modeled" : contract.prospect ? "Prospect · no MLB payroll charge modeled" : `${contract.salary != null ? `${money(contract.salary)} salary · ` : ""}${money(contract.hit)} budget hit in 2027`;

type Results = {
  you: GmTeamResult; base: GmTeamResult; all: Record<string, GmTeamResult>; baseAll: Record<string, GmTeamResult>;
  aiSignings: { pid: string; name: string; team: string; years: number; total: number }[];
  payroll: number; war: number; baseWar: number; value: { trades: number; signings: number; total: number }; grade: ReturnType<typeof objectiveGrade>;
};

export function GmMode() {
  const [moves, setMoves] = useState<GmMoves>(() => createGame("BOS", 1));
  const [recovery, setRecovery] = useState("");
  const [pendingReset,setPendingReset]=useState<{team:string;competitive:boolean}|null>(null);
  const [highOffer,setHighOffer]=useState("");
  const [tab, setTab] = useState<"roster" | "fa" | "trade" | "moves">("fa");
  const [offers, setOffers] = useState<Record<string, { years: string; total: string; note?: string; ok?: boolean }>>({});
  const [faQuery, setFaQuery] = useState("");
  const [faPos, setFaPos] = useState("All");
  const [faSort, setFaSort] = useState("gain");
  const [faBudgetOnly, setFaBudgetOnly] = useState(false);
  const [faAlternatives, setFaAlternatives] = useState(false);
  const [bidRoles, setBidRoles] = useState<Record<string, string>>({});
  const [faLimit, setFaLimit] = useState(20);
  const [rosterView, setRosterView] = useState("contracts");
  const [rosterQuery, setRosterQuery] = useState("");
  const [rosterSort, setRosterSort] = useState("salary");
  const [rosterLimit, setRosterLimit] = useState(30);
  const [giveQuery, setGiveQuery] = useState("");
  const [getQuery, setGetQuery] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [partner, setPartner] = useState("");
  const [give, setGive] = useState<string[]>([]);
  const [get, setGet] = useState<string[]>([]);
  const [cashAmount, setCashAmount] = useState("0");
  const [cashDirection, setCashDirection] = useState("send");
  const cash = (Number(cashAmount) || 0) * (cashDirection === "send" ? 1 : -1);
  const [tradeNote, setTradeNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState("");
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null);
  const [marketNews, setMarketNews] = useState<string[]>([]);
  const [showSigningLedger, setShowSigningLedger] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const autoRun = useRef<GmMoves | null>(null);
  const runVersion = useRef(0);

  const budget = moves.budget ?? Math.round(ctx.sim.teams[moves.team].cbt2026);
  useEffect(() => {
    const load = () => {
    setLoaded(true);
    try {
      setRecovery(window.sessionStorage.getItem("dugout-gm-recovery")??"");
      const shared = readGmSaveUrl(window.location.href);
      const s = shared ?? window.sessionStorage.getItem("dugout-gm-session-v2");
      const m = s ? decodeGame(s) : null;
      if (s) {
        const restored = m ? replayGame(ctx, m) : null;
        if (restored?.moves) { runVersion.current++; setResults(null); setRunning(false); setOffers({}); setTradeNote(null); setFeedback(null); setGive([]); setGet([]); setMarketNews([]); setMoves(restored.moves); if (shared && (!restored.moves.market || restored.moves.market.round === MARKET_ROUNDS)) autoRun.current = restored.moves; return; }
        setRecovery(s); window.sessionStorage.setItem("dugout-gm-recovery",s);
        setFeedback({ tone: "error", text: restored?.reason ?? "This saved offseason could not be loaded. Your original save is preserved below." });
      }
    } catch { /* ignore */ }
    setMoves((m) => ({ ...m, seed: newSeed() }));
    };
    const frame = requestAnimationFrame(load);
    const navigate = () => { if (readGmSaveUrl(window.location.href)) load(); };
    window.addEventListener("hashchange", navigate);
    window.addEventListener("popstate", navigate);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", navigate); window.removeEventListener("popstate", navigate); };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { window.sessionStorage.setItem("dugout-gm-session-v2", encodeGame(moves)); } catch { /* Private browsing may block storage; share links still work. */ }
  }, [loaded, moves]);

  const league = useMemo(() => buildLeague(ctx, moves), [moves]);
  const modes = openingTeamModes(ctx);
  const objective = useMemo(()=>offseasonObjective(ctx,moves),[moves.team,moves.budget]); // eslint-disable-line react-hooks/exhaustive-deps
  const payroll = useMemo(() => payrollFor(ctx, league, moves.team), [league, moves.team]);
  const readiness = useMemo(() => seasonReadiness(ctx, moves), [moves]);
  const roster = useMemo(() => rosterOf(ctx, league.teamOf, moves.team), [league, moves.team]);
  const alloc = useMemo(() => allocate(roster), [roster]);
  const startingAlloc = useMemo(() => {
    const initial = buildLeague(ctx, { team: moves.team, seed: 1, signings: [], trades: [] });
    return allocate(rosterOf(ctx, initial.teamOf, moves.team));
  }, [moves.team]);
  const startingWar = startingAlloc.total;
  const market = useMemo(() => new Map(marketBoard(ctx, moves).map(m => [m.pid, m])), [moves]);
  const offerOutcomes = useMemo(() => userOfferOutcomes(ctx, moves), [moves]);
  const offerRoles = useMemo(() => Object.fromEntries(offerOutcomes.filter(outcome => ["lost", "unsigned", "minor"].includes(outcome.status)).map(({ offer: bid }) => {
    const entries = ctx.players.filter(player => player.pid === bid.pid);
    const fit = bestAdditions(roster, {}, entries);
    return [bid.pid, alternativeRole({ rememberedRole: bidRoles[bid.pid], eligible: entries.flatMap(player => player.e), projectedPositions: fit.flatMap(player => player.positions) })];
  })), [offerOutcomes, roster, bidRoles]);
  const rivalBudgets = useMemo(() => Object.fromEntries(teams.filter(([t]) => t !== moves.team).map(([t]) => [t, rivalBudget(ctx, league, t, moves.seed)])), [league, moves.team, moves.seed]);
  const teamsWithRoom = Object.entries(rivalBudgets).filter(([, plan]) => plan.room >= 5).sort((a, b) => b[1].room - a[1].room);
  const competitive = !!moves.market;
  const bidding = competitive && moves.market!.round < MARKET_ROUNDS;
  const reserved = (moves.market?.bids ?? []).reduce((sum, b) => sum + b.total / b.years, 0);
  const ranks = useMemo(() => {
    const totals = teams.map(([t]) => [t, t === moves.team ? alloc.total : allocate(rosterOf(ctx, league.teamOf, t)).total] as const).sort((a, b) => b[1] - a[1]);
    return Object.fromEntries(totals.map(([t, w], i) => [t, { war: w, rank: i + 1 }]));
  }, [league, alloc, moves.team]);
  const needs = useMemo(() => {
    const others = teams.filter(([t]) => t !== moves.team).map(([t]) => allocate(rosterOf(ctx, league.teamOf, t)));
    return POSITIONS.map(pos => ({ pos, war: alloc.positions[pos].war, rank: 1 + others.filter(a => a.positions[pos].war > alloc.positions[pos].war).length }))
      .sort((a, b) => b.rank - a.rank || a.war - b.war).slice(0, 3);
  }, [league, alloc, moves.team]);
  const partnerNeeds = useMemo(() => {
    if (!partner) return [];
    const current = allocate(rosterOf(ctx, league.teamOf, partner));
    const others = teams.filter(([team]) => team !== partner).map(([team]) => allocate(rosterOf(ctx, league.teamOf, team)));
    return POSITIONS.map(pos => ({ pos, war: current.positions[pos].war, rank: 1 + others.filter(other => other.positions[pos].war > current.positions[pos].war).length }))
      .sort((a, b) => b.rank - a.rank || a.war - b.war).slice(0, 3);
  }, [league, partner]);

  const freeAgents = useMemo(() => {
    const seen = new Set<string>(); const list: { pid: string; entries: GmContext["players"]; row: TrackerRow }[] = [];
    for (const p of ctx.players) {
      if (!league.freeAgents.has(p.i) || seen.has(p.pid)) continue;
      const row = faRows.get(p.pid); if (!row) continue;
      seen.add(p.pid); list.push({ pid: p.pid, entries: ctx.players.filter((q) => q.pid === p.pid), row });
    }
    const gains = new Map(bestAdditions(roster, {}, list.flatMap((x) => x.entries)).map((g) => [g.p.pid, g]));
    return list.map((x) => ({ ...x, gain: gains.get(x.pid)?.gain ?? 0, positions: gains.get(x.pid)?.positions ?? [] }))
      .sort((a, b) => (b.row.total ?? 0) - (a.row.total ?? 0));
  }, [league, roster]);
  const faFiltered = freeAgents.filter((f) => (!faAlternatives || isUsefulAlternative(f, faPos)) && (!faBudgetOnly || couldFitBudget(f.row, budget - payroll - reserved, moves.market?.bids.some(b => b.pid === f.pid))) && (faPos === "All" || matchesProjectionRole({ position: f.entries.flatMap(p => p.e).join("/") }, faPos))
    && (!faQuery.trim() || f.row.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(faQuery.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())))
    .sort((a, b) => (faSort === "gain" ? b.gain - a.gain : faSort === "cost" ? (a.row.aav ?? 0.8) - (b.row.aav ?? 0.8) : (b.row.total ?? 0) - (a.row.total ?? 0)) || a.row.name.localeCompare(b.row.name));
  const faShown = faFiltered.slice(0, faLimit);

  const ownedBy = (abbr: string) => ownedRoster(ctx, league.owner, abbr);
  const partnerList = useMemo(() => (partner ? ownedBy(partner) : []), [partner, league]); // eslint-disable-line react-hooks/exhaustive-deps
  const yourList = useMemo(() => ownedBy(moves.team), [moves.team, league]); // eslint-disable-line react-hooks/exhaustive-deps
  const contracts = useMemo(() => Object.fromEntries([...yourList, ...partnerList].map(p => [p.pid, playerContract(ctx, league, p.pid)])), [yourList, partnerList, league]);
  const rosterContracts = useMemo(() => tab !== "roster" ? [] : yourList.map(({ pid, v, priced }) => {
    const slots = Object.values(alloc.positions).flatMap(slot => slot.rows).filter(row => row.p.pid === pid);
    const used = slots.reduce((sum, row) => sum + row.pt, 0);
    const without = used > 0 ? allocate(roster.filter(p => p.pid !== pid)).total : alloc.total;
    return { pid, v, priced, contract: contracts[pid], used, lostWar: Math.max(0, alloc.total - without), roles: POSITIONS.filter(pos => alloc.positions[pos].rows.some(row => row.p.pid === pid)) };
  }), [yourList, alloc, roster, contracts, tab]);
  const rosterShown = rosterContracts.filter(p => matchesTradePlayer(`${p.v.n} ${p.v.pos} ${p.v.k === "p" ? "prospect" : ""}`, rosterQuery))
    .sort((a, b) => (rosterSort === "salary" ? b.contract.hit - a.contract.hit : rosterSort === "impact" ? b.lostWar - a.lostWar : 0) || a.v.n.localeCompare(b.v.n));
  const positionChanges = POSITIONS.map(pos => ({ pos, before: startingAlloc.positions[pos].war, after: alloc.positions[pos].war, change: alloc.positions[pos].war - startingAlloc.positions[pos].war })).sort((a, b) => b.change - a.change);
  const tradePayroll = useMemo(() => {
    if (!partner || (!give.length && !get.length)) return null;
    if (!cashAmount.trim() || Number(cashAmount) < 0 || !Number.isFinite(cash) || Math.abs(cash) > 50) return null;
    const after = buildLeague(ctx, { ...moves, trades: [...moves.trades, { partner, give, get, cash }] });
    const total = payrollFor(ctx, after, moves.team);
    return { total, change: total - payroll };
  }, [partner, give, get, cash, cashAmount, moves, payroll]);

  const reset = (team: string, competitiveMode = competitive, confirmed=false) => {
    if ((moves.journal?.length ?? 0)>0 && !confirmed) {setPendingReset({team,competitive:competitiveMode});return;}
    setPendingReset(null);setHighOffer("");
    if ((moves.journal?.length ?? 0)>0) {const saved=encodeGame(moves);setRecovery(saved);try {window.sessionStorage.setItem("dugout-gm-recovery",saved);} catch { /* Recovery remains available in this session. */ }}
    runVersion.current++;
    setMoves(createGame(team,moves.seed,competitiveMode));
    setOffers({}); setGive([]); setGet([]); setTradeNote(null); setResults(null); setPartner("");
    setFaQuery(""); setFaPos("All"); setFaBudgetOnly(false); setFaAlternatives(false); setBidRoles({}); setFaLimit(20); setGiveQuery(""); setGetQuery(""); setCashAmount("0"); setCashDirection("send"); setRunning(false);
    setBudgetDraft(null);
    setMarketNews([]);
    setRosterQuery(""); setRosterSort("salary"); setRosterView("contracts"); setRosterLimit(30);
    setShowSigningLedger(false);
    setFeedback({ tone: "success", text: `${ctx.sim.teams[team].name} offseason started. No moves made yet. The same market seed is retained.` });
    window.history.replaceState(null, "", window.location.pathname);
  };
  const update = (m: GmMoves) => { if(m.budget!==moves.budget) m=act(ctx,moves,["budget",m.budget??null]).moves??moves; runVersion.current++; setMoves(m); setResults(null); setRunning(false); window.history.replaceState(null, "", window.location.pathname); };

  const offer = (pid: string) => {
    const row = faRows.get(pid)!; const pending = moves.market?.bids.find(b => b.pid === pid);
    const d = offers[pid] ?? (pending ? { years: String(pending.years), total: String(pending.total) } : defaultOffer());
    if (!d.years.trim() || !d.total.trim()) {
      const note = "Enter years and the total guaranteed money before submitting.";
      setOffers(x => ({ ...x, [pid]: { ...d, note, ok: false } }));
      setFeedback({ tone: "error", text: `${row.name}: ${note}` });
      return;
    }
    const o = { years: Number(d.years), total: Number(d.total) };
    const publicHigh=expectedMarket(row).highAav;
    const offerKey=`${pid}:${d.years}:${d.total}`;
    if(publicHigh && o.total/o.years>publicHigh && highOffer!==offerKey) {
      setHighOffer(offerKey);
      const note=`Above the public range of up to ${money(publicHigh)} per year. Check the total, or press Confirm high offer to submit anyway.`;
      setOffers(x=>({...x,[pid]:{...d,note,ok:false}}));setFeedback({tone:"error",text:`${row.name}: ${note}`});return;
    }
    setHighOffer("");
    if (bidding) {
      const ans = act(ctx, moves, ["bid",{ pid, ...o }]);
      setOffers(x => ({ ...x, [pid]: { ...d, note: ans.reason, ok: ans.accepted } }));
      if (ans.moves) {
        const entries = ctx.players.filter(player => player.pid === pid);
        const fit = bestAdditions(roster, {}, entries);
        setBidRoles(previous => ({ ...previous, [pid]: alternativeRole({ selectedRole: faPos, rememberedRole: previous[pid], eligible: entries.flatMap(player => player.e), projectedPositions: fit.flatMap(player => player.positions) }) }));
        update(ans.moves);
      }
      setFeedback({ tone: ans.accepted ? "success" : "error", text: `${row.name}: ${ans.reason}` });
      return;
    }
    const ans = act(ctx, moves, ["sign",{pid,...o}]);
    setOffers((x) => ({ ...x, [pid]: { ...d, note: ans.reason, ok: ans.accepted } }));
    if (ans.accepted) {
      const next = ans.moves!;
      const nextLeague = buildLeague(ctx, next);
      const gain = allocate(rosterOf(ctx, nextLeague.teamOf, moves.team)).total - alloc.total;
      update(next);
      const roomAfter = budget - payrollFor(ctx, nextLeague, moves.team);
      setFeedback({ tone: "success", text: `Signed ${row.name}: ${o.years} ${o.years === 1 ? "year" : "years"}, ${money(o.total)} total (${money(o.total / o.years)} a year). ${signedWins(gain)} projected roster WAR. ${roomAfter < 0 ? `Clear ${money(-roomAfter)} before simulating the season.` : `${money(roomAfter)} left under budget.`}` });
    } else setFeedback({ tone: "error", text: `${row.name}: ${ans.reason}` });
  };
  const propose = () => {
    if (!cashAmount.trim() || !Number.isFinite(Number(cashAmount)) || Number(cashAmount) < 0 || Number(cashAmount) > 50) { const text = "Enter cash from $0M to $50M, within the outgoing players’ 2027 budget charges."; setTradeNote({ ok: false, text }); setFeedback({ tone: "error", text }); return; }
    const proposal = { partner, give, get, ...(cash ? { cash } : {}) };
    const ans = act(ctx, moves, ["trade",proposal]);
    setTradeNote({ ok: ans.accepted, text: ans.reason });
    if (!ans.accepted) setFeedback({ tone: "error", text: ans.reason });
    if (ans.accepted) { update(ans.moves!); setGive([]); setGet([]); setGiveQuery(""); setGetQuery(""); setCashAmount("0"); setFeedback({ tone: "success", text: `Trade completed with ${ctx.sim.teams[partner].name}. You received ${get.map(pid => V[pid]?.n).join(", ") || "no players"}.${cash ? ` You ${cash > 0 ? "sent" : "received"} ${money(Math.abs(cash))} in cash.` : ""} See the value breakdown after simulating the season.` }); }
  };
  const withdrawBid = (pid: string) => {
    update(act(ctx,moves,["withdraw",pid]).moves??moves);
    setOffers(previous => {
      const next = { ...previous };
      if (next[pid]) next[pid] = { ...next[pid], note: undefined, ok: undefined };
      return next;
    });
    setFeedback({ tone: "success", text: `Withdrew the offer to ${label(pid)}. The reserved payroll is available again.` });
  };
  const undo = (kind: "signing" | "trade", index: number) => {
    const undone = undoGame(ctx, moves, kind, index);
    update(undone.moves); setGive([]); setGet([]); setTradeNote(null);
    setMarketNews([]); setShowSigningLedger(true);
    setFeedback({ tone: "success", text: `Move undone. Later actions were replayed against the new roster.${undone.removed > 1 ? ` ${undone.removed - 1} actions no longer worked and were removed.` : ""}${moves.market ? " Rival signings were recomputed too." : ""}` });
  };

  const nextRound = () => {
    const version = ++runVersion.current;
    setRunning(true);
    setTimeout(() => {
      if (version !== runVersion.current) return;
      try {
        const next = act(ctx, moves,["advance"]);
        if(!next.moves) throw Error(next.reason);
        update(next.moves);
        setMarketNews(next.news??[]);
        setShowSigningLedger(false);
        setOffers({}); setGive([]); setGet([]); setTradeNote(null);
        setFeedback({ tone: "success", text: `Round ${next.moves.market!.round} complete. ${next.moves.market!.round === MARKET_ROUNDS ? "Bidding is closed. You can still trade, undo moves, or sign remaining free agents. Get within budget to simulate the season." : "Review the activity, then keep, revise, or withdraw your offers before advancing."}` });
        requestAnimationFrame(() => document.getElementById("gm-offer-results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      } catch { setFeedback({ tone: "error", text: "The market round could not finish. Your offers are unchanged; try again." }); }
      finally { setRunning(false); }
    }, 30);
  };

  const simulate = (m: GmMoves = moves) => {
    const check = seasonReadiness(ctx, m);
    if (!check.ready) {
      setResults(null);
      setFeedback({ tone: "error", text: check.marketOpen ? "Finish the bidding rounds before simulating the season." : `Clear ${money(check.shortfall)} of annual payroll through trades or undo moves before simulating the season.` });
      return;
    }
    const version = ++runVersion.current;
    setRunning(true);
    setTimeout(async () => {
      if (version !== runVersion.current) return;
      try {
      const lg = buildLeague(ctx, m);
      const ai = m.market ? { league: lg, signings: m.market.deals.map(d => ({ ...d, name: label(d.pid) })) } : aiFreeAgency(ctx, lg, m, m.seed);
      const st = teamStrengths(ctx, ai.league.teamOf);
      const all = simulateSeasons(ctx, st, SIMS, m.seed);
      let baseMoves: GmMoves = { team: m.team, budget: m.budget, seed: m.seed, signings: [], trades: [], ...(m.market ? { market: newMarket() } : {}) };
      if (m.market) for (let round = 0; round < MARKET_ROUNDS; round++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (version !== runVersion.current) return;
        baseMoves = advanceMarket(ctx, baseMoves).moves;
      }
      await new Promise(resolve => setTimeout(resolve, 0));
      if (version !== runVersion.current) return;
      const bl = buildLeague(ctx, baseMoves);
      const bai = m.market ? { league: bl } : aiFreeAgency(ctx, bl, baseMoves, m.seed);
      const bst = teamStrengths(ctx, bai.league.teamOf);
      const baseAll = simulateSeasons(ctx, bst, SIMS, m.seed);
      const value = movesValue(ctx, m);
      const pay = payrollFor(ctx, ai.league, m.team, ai.league.extraAav);
      setResults({ you: all[m.team], base: baseAll[m.team], all, baseAll, aiSignings: ai.signings, payroll: pay, war: st[m.team].war, baseWar: bst[m.team].war, value, grade: objectiveGrade(ctx,m,all[m.team].mean - baseAll[m.team].mean, value.total) });
      setTimeout(() => document.getElementById("gm-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      } catch { setFeedback({ tone: "error", text: "The simulation could not finish. Your moves are still here; try again." }); }
      finally { if (version === runVersion.current) setRunning(false); }
    }, 30);
  };
  useEffect(() => () => { runVersion.current++; }, []);
  useEffect(() => { if (autoRun.current && autoRun.current === moves) { autoRun.current = null; simulate(moves); } }, [moves]); // eslint-disable-line react-hooks/exhaustive-deps

  const shareUrl = () => {
    try { return createGmShareUrl(window.location.href, encodeGame(moves)); } catch { return ""; }
  };
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 2000); } catch { setCopied("failed"); } };
  const summaryText = () => {
    if (!results) return "";
    const t = ctx.sim.teams[moves.team].name, r = results;
    const lines = [`My ${t} offseason on Dugout Value GM mode: ${resultImpact(r.you.mean - r.base.mean, r.you.playoffs - r.base.playoffs).headline.toLowerCase()}.`,
      `Projected ${Math.round(r.you.p50)} wins (${Math.round(r.you.p10)}–${Math.round(r.you.p90)}), ${signedWins(r.you.mean - r.base.mean)} vs standing pat.`,
      `Playoffs ${pct(r.you.playoffs)} (${signedPts(r.you.playoffs - r.base.playoffs)}), World Series ${pct(r.you.title)}.`,
      ...moves.signings.map((s) => `Signed ${label(s.pid)}: ${yearsLabel(s.years)}, ${money(s.total)}`),
      ...moves.trades.map((tr) => `Traded ${tr.give.map((p) => V[p]?.n).join(", ") || "no players"} to ${ctx.sim.teams[tr.partner].name} for ${tr.get.map((p) => V[p]?.n).join(", ") || "no players"}${tr.cash ? `; ${tr.cash > 0 ? "sent" : "received"} ${money(Math.abs(tr.cash))} cash` : ""}.`)];
    return `${lines.join("\n")}\n${shareUrl()}`;
  };

  const teamName = ctx.sim.teams[moves.team].name;
  const room = budget - payroll;
  const impact = results ? resultImpact(results.you.mean - results.base.mean, results.you.playoffs - results.base.playoffs) : null;
  const mine = ranks[moves.team];
  const showTab = (next: typeof tab) => {
    setFeedback(null); setTradeNote(null);
    setTab(next);
    document.getElementById(`gm-tab-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const choosePartner = (team: string) => { if(partner&&partner!==team) {setGive([]);setGiveQuery("");} setPartner(team); setGet([]); setGetQuery(""); setCashAmount("0"); setTradeNote(null);setFeedback(null); };
  const exploreTrade = (pid: string) => { setGive([pid]); setGet([]); setGiveQuery(""); setGetQuery(""); setCashAmount("0"); setTradeNote(null); showTab("trade"); setFeedback({ tone: "success", text: `${label(pid)} is in your trade offer. Choose a partner, then decide what to ask for or include.` }); };

  return (
    <section className="gm" aria-label="GM Mode offseason game" aria-busy={running}>
      <aside className="gm-live-status" aria-label="Your offseason status"><div><strong>{teamName}</strong><span>{money(Math.abs(room))} {room<0?"over budget":"available"} · {alloc.total.toFixed(1)} WAR · {objective.label}</span><button type="button" disabled={running||!!pendingReset} onClick={()=>showTab("fa")}>Browse players</button></div>{pendingReset?<div role="group" aria-label="Confirm new offseason"><p>Start a new offseason? Your current game will be kept as a recovery link.</p><button type="button" onClick={()=>reset(pendingReset.team,pendingReset.competitive,true)}>Start new offseason</button><button type="button" onClick={()=>setPendingReset(null)}>Keep playing</button></div>:feedback&&<p role="status" data-tone={feedback.tone}>{feedback.text}</p>}</aside>
      {recovery && <p className="gm-note">An earlier save is preserved. <button type="button" onClick={()=>copy(createGmShareUrl(window.location.href,recovery),"recovery link")}>Copy recovery link</button></p>}
      <fieldset className="gm-controls" disabled={running||!!pendingReset}>
      <legend className="gm-sr">Build your offseason</legend>
      <div className="gm-market-mode">
        <label className="gm-field"><span>How do you want to play?</span><select value={competitive ? "competitive" : "quick"} onChange={e => reset(moves.team, e.target.value === "competitive")}><option value="quick">Quick offseason</option><option value="competitive">Competitive market</option></select></label>
        <p>{competitive ? "Three bidding rounds. Rival clubs have their own needs, budgets, and offers." : "Negotiate instant deals, then let the other clubs fill out their rosters."} Switching modes starts a new offseason.</p>
      </div>
      <div className="gm-setup">
        <label className="gm-field"><span>Your team</span>
          <select value={moves.team} onChange={(e) => reset(e.target.value)}>{teams.map(([abbr, t]) => <option key={abbr} value={abbr}>{t.name}</option>)}</select>
        </label>
        <div className="gm-field gm-budget"><span>2027 budget (payroll + trade cash)</span>
          <input aria-label="2027 budget slider" type="range" min={60} max={480} step={1} value={budget} onChange={(e) => { setBudgetDraft(null); update({ ...moves, budget: Number(e.target.value) }); }} aria-valuetext={money(budget)} />
          <label className="gm-budget-number">$<input aria-label="2027 budget in millions" type="number" min={60} max={480} step={1} value={budgetDraft ?? budget} onChange={(e) => setBudgetDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} onBlur={() => {
            if (budgetDraft !== null) {
              const amount = Number(budgetDraft);
              if (budgetDraft.trim() && Number.isFinite(amount) && amount >= 60 && amount <= 480) update({ ...moves, budget: amount });
              else setFeedback({ tone: "error", text: "Budget must be between $60M and $480M. Your previous budget is unchanged." });
              setBudgetDraft(null);
            }
          }} />M</label>
          <small>{money(budget)} · 2026 payroll was {money(ctx.sim.teams[moves.team].cbt2026)}{moves.budget != null && <> · <button type="button" className="gm-link" onClick={() => update({ ...moves, budget: null })}>reset</button></>}</small>
        </div>
        <div className="gm-stats" aria-live="polite">
          <p><strong>{money(payroll)}</strong><span>2027 payroll{league.cash?.get(moves.team) ? " + net cash" : ""}</span></p>
          <p className={room < 0 ? "gm-bad" : undefined}><strong>{money(Math.abs(room))}</strong><span>{room >= 0 ? "room under budget" : "over budget"}</span></p>
          <p><strong>{mine.war.toFixed(1)}</strong><span>projected WAR</span></p>
          <p><strong>{mine.rank}{["th", "st", "nd", "rd"][mine.rank % 10 > 3 || [11, 12, 13].includes(mine.rank % 100) ? 0 : mine.rank % 10]}</strong><span>in MLB</span></p>
        </div>
      </div>
      <p className="gm-note">Objective: <strong>{objective.label}</strong>. {moves.budget!=null&&budget!==Math.round(ctx.sim.teams[moves.team].cbt2026)?"Custom budget: compare this score only with games using the same spending limit.":"Your score considers roster improvement and contract value."}</p>
      <div className="gm-tools"><span>Changing teams starts a new offseason. This is a sandbox, not live transactions.</span><button type="button" className="gm-link" onClick={() => reset(moves.team)}>Start over</button><button type="button" className="gm-link" onClick={() => copy(shareUrl(), "link")}>Copy offseason link</button>{copied && <span role="status">{copied === "failed" ? "Couldn’t copy. Try again." : `Copied ${copied}`}</span>}</div>
      <div className="gm-brief"><div><strong>Where could you improve?</strong><p>Your lowest-ranked positions. Pick one to find free agents who can help.</p></div><div className="gm-needs">{needs.map(need => <button key={need.pos} type="button" onClick={() => { showTab("fa"); setFaPos(need.pos); setFaQuery(""); setFaLimit(20); }}><strong>{need.pos}</strong><span>No. {need.rank} of 30 · {need.war.toFixed(1)} WAR</span></button>)}</div></div>
      {readiness.shortfall > 1e-9 && <aside className="gm-budget-plan" id="gm-budget-plan">
        <div><strong>Before Opening Day: clear {money(readiness.shortfall)}</strong><p>Your signed roster is over budget. {bidding ? "You can keep negotiating and advancing rounds. " : ""}Make a salary-clearing trade or undo moves before simulating the season.</p></div>
        <div className="gm-budget-actions"><button type="button" onClick={() => { setRosterView("contracts"); setRosterSort("salary"); setRosterQuery(""); showTab("roster"); }}>Find salary to move</button><button type="button" onClick={() => showTab("moves")}>Review / undo moves</button></div>
      </aside>}
      {competitive && <section className="gm-market-desk" id="gm-market" aria-label="Free-agent market">
        <div className="gm-scorecard"><div className="gm-scorecard-club"><span className="gm-homeplate" aria-hidden="true">{moves.team}</span><span>OFFSEASON SCORECARD<small>{teamName}</small></span></div><dl><div><dt>Signed</dt><dd>{moves.signings.length}</dd></div><div><dt>Trades</dt><dd>{moves.trades.length}</dd></div><div><dt>WAR added</dt><dd>{signedWins(alloc.total - startingWar)}</dd></div></dl></div>
        <ol className="gm-round-track" aria-label="Market progress">{["Opening offers", "Counteroffers", "Final calls"].map((phase, index) => <li key={phase} data-state={moves.market!.round > index ? "complete" : moves.market!.round === index ? "current" : "next"} aria-current={moves.market!.round === index ? "step" : undefined}><span aria-hidden="true">{moves.market!.round > index ? "✓" : index + 1}</span><span>{phase}<small>{moves.market!.round > index ? "Complete" : moves.market!.round === index ? "Now bidding" : "Up next"}</small></span></li>)}</ol>
        <div className="gm-market-heading"><div><h2>{bidding ? `Bidding round ${moves.market!.round + 1} of ${MARKET_ROUNDS}` : "The bidding rounds are complete"}</h2><p>{bidding ? "Submit offers below, then advance when you’re ready. Some players will sign elsewhere." : "Finish shaping your roster. Trade, undo moves, or sign remaining free agents before simulating."}</p></div>{bidding && <button type="button" className="gm-sim" onClick={nextRound}>{running ? "Clubs are deciding…" : `Advance to round ${moves.market!.round + 1} results`}</button>}</div>
        {bidding && <button type="button" className="gm-link" onClick={() => showTab("fa")}>Browse free agents ↓</button>}
        <p className="gm-note">{money(reserved)} of annual payroll in {moves.market!.bids.length} pending {moves.market!.bids.length === 1 ? "offer" : "offers"}. {reserved > room ? reserved > 0 ? `If all pending offers land, clear ${money(reserved - room)} before simulating. You can still advance.` : `Clear ${money(-room)} from the signed roster before simulating.` : `${money(room - reserved)} available after pending offers.`} These are simulated negotiations, not news reports.</p>
        <section className="gm-offer-results" id="gm-offer-results" aria-label="Your free-agent offers" aria-live="polite">
          <h3>Your free-agent offers</h3>
          <p className="gm-note">{bidding ? "Your latest offer and where things stand. These stay here as the rounds advance." : "Final outcomes, including late signings after the last bidding round."}</p>
          {!moves.market!.history && <p className="gm-note">This older save does not include past unsuccessful offers.</p>}
          {!offerOutcomes.length ? <p className="gm-note">No offers yet. Browse free agents to start negotiating.</p> : <ul>{offerOutcomes.map(({ offer: bid, status, deal, invite, reason, standing, decisionRound }) => <li key={bid.pid} data-outcome={status}>
            <div className="gm-offer-result-heading"><strong>{label(bid.pid)}</strong><span>{outcomeLabels[status]}</span></div>
            <p>Your offer: {yearsLabel(bid.years)}, {money(bid.total)} total ({money(bid.total / bid.years)}/year) · submitted in round {bid.round}.</p>
            {deal && <p><strong>{deal.team === moves.team ? "Your deal" : ctx.sim.teams[deal.team].name}:</strong> {yearsLabel(deal.years)}, {money(deal.total)} total ({money(deal.total / deal.years)}/year).</p>}
            {invite && <p><strong>{ctx.sim.teams[invite.team].name}:</strong> non-roster invitation, not a guaranteed MLB contract.{status === "minor" && " Your MLB offer was not accepted."}</p>}
            {reason && <p>{reason}</p>}
            {standing && <p className="gm-offer-standing" data-tone={standing.startsWith("Your offer is in front")?"success":"warning"}>{standing}</p>}
            {(status === "pending" || status === "submitted") && <p>{market.get(bid.pid)?.rivals.length ? `${market.get(bid.pid)!.rivals.length} rival ${market.get(bid.pid)!.rivals.length === 1 ? "club is" : "clubs are"} bidding.` : "No active rival bid."} Other clubs may enter later.</p>}
            {decisionRound && (status === "pending" || status === "submitted") && <p>Decision expected by round {decisionRound}. You can hold your offer by leaving it unchanged.</p>}
            {status === "undone" && <p>You undid this signing. It is no longer on your payroll.</p>}
            {(status === "pending" || status === "submitted") && <div className="gm-offer-result-actions"><button type="button" className="gm-link" onClick={() => { setFaQuery(label(bid.pid)); setFaPos("All"); setFaBudgetOnly(false); setFaAlternatives(false); setFaLimit(20); showTab("fa"); }}>Review / revise offer<span className="gm-sr"> to {label(bid.pid)}</span></button><button type="button" className="gm-link" onClick={() => withdrawBid(bid.pid)}>Withdraw<span className="gm-sr"> offer to {label(bid.pid)}</span></button></div>}
            {(status === "lost" || status === "unsigned" || status === "minor") && <div className="gm-offer-result-actions"><button type="button" className="gm-link" onClick={() => { setFaQuery(""); setFaPos(offerRoles[bid.pid] ?? "All"); setFaSort("gain"); setFaBudgetOnly(true); setFaAlternatives(true); setFaLimit(20); showTab("fa"); }}>Find {offerRoles[bid.pid] && offerRoles[bid.pid] !== "All" ? `${offerRoles[bid.pid]} ` : ""}alternatives<span className="gm-sr"> after your offer to {label(bid.pid)}</span></button></div>}
          </li>)}</ul>}
        </section>
        {(marketNews.length > 0 || moves.market!.deals.length > 0 || moves.signings.length > 0) && (
          <details className="gm-market-feed" key={`wire-${moves.market!.round}`}>
            <summary>League wire · {!showSigningLedger && marketNews.length ? `${marketNews.length} round updates` : `${moves.signings.length + moves.market!.deals.length} signings`}</summary>
            {marketNews.length > 0 && <div className="gm-wire-controls">
              <button type="button" aria-pressed={!showSigningLedger} onClick={() => setShowSigningLedger(false)}>Latest round</button>
              <button type="button" aria-pressed={showSigningLedger} onClick={() => setShowSigningLedger(true)}>All signings ({moves.signings.length + moves.market!.deals.length})</button>
            </div>}
            <ul>{!showSigningLedger && marketNews.length ? marketNews.map((n, i) => (
              <li key={i} className={n.includes("You got him.") ? "gm-wire-win" : undefined}>
                {n.includes("You got him.") && <><span className="gm-deal-tag">SIGNED</span>{" "}</>}{n}
              </li>
            )) : [...moves.signings.map(s => ({ ...s, team: moves.team })), ...moves.market!.deals].map(d => (
              <li key={d.pid} className={d.team === moves.team ? "gm-wire-win" : undefined}>
                <span className="gm-deal-tag">{d.team}</span>{" "}<strong>{label(d.pid)}</strong> · {d.years} {d.years === 1 ? "yr" : "yrs"}, {money(d.total)}
              </li>
            ))}</ul>
          </details>
        )}
        {!!moves.market!.invites?.length && <details className="gm-market-feed gm-invite-feed"><summary>Non-roster invitations ({moves.market!.invites.length})</summary><p className="gm-note">Minor-league depth arrangements, separate from guaranteed MLB signings. These add no MLB salary or projected WAR in this game.</p><ul>{moves.market!.invites.map(invite => <li key={invite.pid}><strong>{label(invite.pid)}</strong> · {ctx.sim.teams[invite.team].name}</li>)}</ul></details>}
        <details className="gm-market-reminder"><summary>Budget and undo rules</summary><p>You may exceed your budget while building the roster, but must get under it before simulating. Undo replays the remaining offseason without that move, including rival signings. Later actions that no longer work are removed. Rival clubs still use hard budgets. The final round lists late signings in the league wire.</p></details>
      </section>}
      <div className="gm-run">
        {!bidding && <button type="button" className="gm-sim" onClick={() => results ? document.getElementById("gm-results")?.scrollIntoView({ behavior: "smooth", block: "start" }) : simulate()} disabled={running || !readiness.ready} aria-describedby={readiness.shortfall > 1e-9 ? "gm-budget-plan" : undefined}>{running ? "Working…" : results ? "View season results" : "Finish offseason · simulate 2027"}</button>}
        <small>{bidding ? "Finish all three bidding rounds before simulating the season." : readiness.shortfall > 1e-9 ? `Clear ${money(readiness.shortfall)} through trades or undo moves to unlock the season.` : competitive ? "Roster is within budget. You’re ready to simulate 2027." : results ? "Change a move or your budget to try another plan. The same seed keeps comparisons consistent." : "The other 29 teams fill out their rosters. You can revise your moves after seeing the results."}</small>
      </div>

      <div className="gm-tabs" role="tablist" aria-label="Offseason">
        {([["fa", "Free agents"], ["trade", "Trades"], ["roster", "Your roster"], ["moves", `Your moves (${moves.signings.length + moves.trades.length})`]] as const).map(([k, l]) => (
          <button key={k} id={`gm-tab-${k}`} type="button" role="tab" aria-controls={`gm-panel-${k}`} tabIndex={tab === k ? 0 : -1} aria-selected={tab === k} className={tab === k ? "active" : undefined} onClick={() => showTab(k)} onKeyDown={(e) => {
            if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
            e.preventDefault(); const index = TABS.indexOf(k);
            const next = e.key === "Home" ? TABS[0] : e.key === "End" ? TABS[3] : TABS[(index + (e.key === "ArrowRight" ? 1 : 3)) % 4];
            showTab(next); document.getElementById(`gm-tab-${next}`)?.focus();
          }}>{l}</button>
        ))}
      </div>

      {tab === "fa" && (
        <div className="gm-panel" role="tabpanel" id="gm-panel-fa" aria-labelledby="gm-tab-fa">
          <div className="gm-filters">
            <label className="gm-field"><span>Find a free agent</span><input value={faQuery} onChange={(e) => { setFaQuery(e.target.value); setFaLimit(20); }} placeholder="Name…" /></label>
            <label className="gm-field"><span>Position</span><select value={faPos} onChange={(e) => { setFaPos(e.target.value); setFaLimit(20); }}>{["All", "C", "1B", "2B", "3B", "SS", "OF", "LF", "CF", "RF", "DH", "SP", "RP"].map((p) => <option key={p}>{p}</option>)}</select></label>
            <label className="gm-field"><span>Sort free agents</span><select value={faSort} onChange={e => { setFaSort(e.target.value); setFaLimit(20); }}><option value="gain">Most WAR added</option><option value="cost">Lowest expected annual cost</option><option value="market">Largest expected contracts</option></select></label>
          </div>
          <p className="gm-note">Public forecasts guide the market range, not a guaranteed acceptance price. Contract length changes both the total and annual cost. “Adds for you” accounts for playing time displaced. You can complete up to 12 MLB signings.</p>
          <label className="gm-budget-filter"><input type="checkbox" checked={faBudgetOnly} onChange={e => { setFaBudgetOnly(e.target.checked); setFaLimit(20); }} /> Could fit budget</label>
          {faAlternatives && <p className="gm-note">Showing remaining free agents who add projected WAR{faPos !== "All" ? ` and can fill ${faPos}` : ""}. <button type="button" className="gm-link" onClick={() => { setFaAlternatives(false); setFaLimit(20); }}>Include depth options</button></p>}
          {faBudgetOnly && <p className="gm-note">Shows players whose public market range starts within your {money(Math.max(0, room - reserved))} available after pending offers. This is not a guaranteed signing price. Unknown ranges stay visible when the minimum salary fits; pending bids stay visible.</p>}
          <div className="gm-list-summary"><span>{faFiltered.length} free {faFiltered.length === 1 ? "agent matches" : "agents match"} · showing {faShown.length}</span>{bidding && <a href="#gm-market">Review bids and advance</a>}{(faQuery || faPos !== "All" || faBudgetOnly || faAlternatives) && <button type="button" className="gm-link" onClick={() => { setFaQuery(""); setFaPos("All"); setFaBudgetOnly(false); setFaAlternatives(false); setFaLimit(20); }}>Clear filters</button>}</div>
          <div className="gm-table-wrap" tabIndex={0} role="region" aria-label="Free-agent offers">
            <table className="gm-table" role="table">
              <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Player</th><th scope="col" role="columnheader" className="num">2027 WAR</th><th scope="col" role="columnheader" className="num">Adds for you</th><th scope="col" role="columnheader">Expected market</th><th scope="col" role="columnheader">Your offer</th></tr></thead>
              <tbody role="rowgroup">
                {faShown.map(({ pid, row, gain, positions }) => {
                  const pending = moves.market?.bids.find(b => b.pid === pid);
                  const d = offers[pid] ?? (pending ? { years: String(pending.years), total: String(pending.total), note: undefined, ok: undefined } : defaultOffer());
                  const guidance = expectedMarket(row);
                  const consensus = row.marketForecast?.consensus;
                  const lowYears = consensus?.minYears ?? guidance.lowYears;
                  const highYears = consensus?.maxYears ?? guidance.highYears;
                  const marketTerm = lowYears === highYears ? yearsLabel(lowYears) : `${lowYears}–${highYears} yrs`;
                  const interest = market.get(pid);
                  const offerRoom = room - reserved + (pending ? pending.total / pending.years : 0);
                  return (
                    <tr key={pid} role="row">
                      <th scope="row" role="rowheader">{row.name}<small>{row.pos} · {row.team ?? "—"} · age {row.age}</small>{interest && <details className="gm-player-market"><summary>{interest.rivals.length ? `${interest.rivals.length} rival ${interest.rivals.length === 1 ? "club" : "clubs"} interested` : "No active rival bid"}</summary><p>Decision expected by round {Math.max(moves.market!.round + 1, interest.deadline)}. Values {interest.preference === "role" ? "a clear playing role" : "a chance to contend"} as a small tie-breaker.</p>{interest.rivals.length ? <ul>{interest.rivals.map(r => <li key={r.team}>{ctx.sim.teams[r.team].name}: around {money(Math.floor(r.total / 5) * 5)}–{money(Math.floor(r.total / 5) * 5 + 5)} over {r.years} yrs.</li>)}</ul> : <p>Other clubs could enter after their first choices sign.</p>}<p>Offers are estimates from the simulated market. Clubs may raise them within their limits.</p></details>}</th>
                      <td className="num" role="cell" data-label="2027 WAR">{row.war2027?.toFixed(1) ?? "—"}</td>
                      <td className="num" role="cell" data-label="Adds for you">{signedWins(gain)}<small>{positions.join(", ")}</small></td>
                      <td className="gm-market-range" role="cell" data-label="Expected market">
                        <strong>{marketTerm}</strong>
                        <span>{guidance.lowAav == null || guidance.highAav == null ? "Market uncertain" : `$${guidance.lowAav}–${guidance.highAav}M/year`}</span>
                        <small>{consensus ? consensus.singleSource ?? "Published forecast range" : guidance.basis}</small>
                      </td>
                      <td className="gm-offer" role="cell" data-label="Your offer · total guaranteed">
                        <label><span className="gm-sr">Years for {row.name}</span><input type="number" min={1} max={13} value={d.years} onChange={(e) => setOffers((x) => ({ ...x, [pid]: { ...d, years: e.target.value, note: undefined } }))} /> yrs</label>
                        <label><span className="gm-sr">Guaranteed total for {row.name}, $M</span>$<input type="number" min={0.8} step={0.1} placeholder="Total" value={d.total} onChange={(e) => setOffers((x) => ({ ...x, [pid]: { ...d, total: e.target.value, note: undefined } }))} />M <span className="gm-total-label">total</span></label>
                        <button type="button" aria-label={`${highOffer===`${pid}:${d.years}:${d.total}`?"Confirm high offer for":bidding ? "Submit bid for" : "Offer contract to"} ${row.name}`} onClick={() => offer(pid)}>{highOffer===`${pid}:${d.years}:${d.total}`?"Confirm high offer":bidding ? pending ? "Update bid" : "Submit bid" : "Offer"}</button>
                        {pending && (Number(d.years) !== pending.years || Number(d.total) !== pending.total) && <small className="gm-draft-note">Draft changes not submitted. Your current bid is {pending.years} yrs, {money(pending.total)}.</small>}
                        <small className="gm-offer-cost">{Number(d.years) > 0 && Number(d.total) > 0 ? `${money(Number(d.total) / Number(d.years))}/year · ${money(Math.abs(offerRoom - Number(d.total) / Number(d.years)))} ${offerRoom >= Number(d.total) / Number(d.years) ? "room left" : "over budget"}${bidding ? " after pending offers" : ""}` : "Enter years and total $M"}</small>
                        {d.note && <small role="status" className={d.ok ? "gm-good" : "gm-bad"}>{d.note}</small>}
                      </td>
                    </tr>
                  );
                })}
                {!faShown.length && <tr><td colSpan={5} className="gm-empty">{competitive && !bidding && !freeAgents.length ? <>Everyone in this market has signed. <a href="#gm-market">See the league wire</a> for destinations, or keep building through trades.</> : faBudgetOnly ? <>No players match these filters within your available payroll. <button type="button" className="gm-link" onClick={() => { setFaBudgetOnly(false); setFaLimit(20); }}>Turn off budget filter</button> to consider offers that would need a later salary-clearing move.</> : "No free agents match."}</td></tr>}
              </tbody>
            </table>
          </div>
          {faShown.length < faFiltered.length && <div className="gm-list-summary"><button type="button" onClick={() => setFaLimit(limit => limit + 20)}>Show {Math.min(20, faFiltered.length - faShown.length)} more free agents</button></div>}
          {bidding && <div className="gm-bottom-nav"><a href="#gm-market">Review {moves.market!.bids.length} pending {moves.market!.bids.length === 1 ? "offer" : "offers"} & advance ↑</a><span>{money(Math.abs(room - reserved))} {room >= reserved ? "available" : "over budget"} after pending offers</span></div>}
        </div>
      )}

      {tab === "trade" && (
        <div className="gm-panel" role="tabpanel" id="gm-panel-trade" aria-labelledby="gm-tab-trade">
          <div className="gm-filters">
            <label className="gm-field"><span>Trade partner</span>
              <select value={partner} onChange={(e) => choosePartner(e.target.value)}>
                <option value="">Choose a team…</option>
                {teams.filter(([t]) => t !== moves.team).map(([abbr, t]) => <option key={abbr} value={abbr}>{t.name} · {rivalBudgets[abbr].room < .05 ? "No payroll room" : `${budgetRange(rivalBudgets[abbr].room)} room`}</option>)}
              </select>
            </label>
            {partner && <p className="gm-note">{ctx.sim.teams[partner].name}: {modes[partner] === "contend" ? "prioritizes 2027, based on its roster or payroll investment" : modes[partner] === "rebuild" ? "lower payroll and projected wins; prioritizes control years" : "balances current help with future value"}. Strategy stays fixed for this offseason.</p>}
          </div>
          <aside className="gm-partner-budgets" aria-label="Trade partner budgets">
            <h3>{partner ? `${ctx.sim.teams[partner].name}: ${budgetRange(rivalBudgets[partner].room)} to add payroll` : "Who has room for salary?"}</h3>
            {partner && <p>Estimated budget: {budgetRange(rivalBudgets[partner].limit)} · current payroll and net trade cash: {money(rivalBudgets[partner].payroll)}.</p>}
            {partner && <p><strong>Lowest-ranked positions:</strong> {partnerNeeds.map(need => `${need.pos} (No. ${need.rank} of 30, ${need.war.toFixed(1)} WAR)`).join(" · ")}. Based on their current roster after completed moves, not your unsubmitted offer.</p>}
            <p>Game estimates, not reported club budgets. Rivals set aside $5–15M for trades and in-season moves; cheap depth signings may use part of it. Room updates after every deal. Having space does not guarantee they’ll accept.</p>
            <div className="gm-budget-shortlist"><strong>Most room right now</strong>{teamsWithRoom.slice(0, 4).map(([team, plan]) => <button key={team} type="button" onClick={() => choosePartner(team)} aria-pressed={partner === team}>{ctx.sim.teams[team].name}<small>{budgetRange(plan.room)} room</small></button>)}{!teamsWithRoom.length && <span>No rival has $5M available. Include cash or take salary back to reduce the net cost.</span>}</div>
          </aside>
          <p className="gm-note">Up to five players per side. Clubs give less credit to extra depth pieces and require a centerpiece for controllable stars. Cash can cover the paying club’s outgoing 2027 budget charges, up to $50M paid per club across the offseason. Exact model values stay hidden until your post-simulation review.</p>
          {partner ? (
            <div className="gm-trade">
              {[["You send", yourList, give, setGive], [`${ctx.sim.teams[partner].name} send`, partnerList, get, setGet]].map(([title, list, sel, set]) => {
                const l = list as typeof yourList, s = sel as string[], st = set as (v: string[]) => void;
                return (
                  <div key={title as string} className="gm-side">
                    <h3>{title as string}</h3>
                    <ul className="gm-picked">{s.map((pid) => <li key={pid}><strong>{V[pid]?.n}</strong> <small>{V[pid]?.k === "p" ? `Prospect · ${prospectBrief(V[pid])}` : V[pid]?.pos}</small> <button type="button" className="gm-link" aria-label={`Remove ${V[pid]?.n} from offer`} onClick={() => { st(s.filter((x) => x !== pid)); setTradeNote(null); }}>remove</button>
                      <span className="gm-contract-line">{contractBrief(contracts[pid])}</span>
                      {contracts[pid]?.seasons.length > 0 && <details className="gm-contract-detail"><summary>Contract / control through {contracts[pid].controlThrough ?? contracts[pid].seasons.at(-1)?.year}</summary><ul>{contracts[pid].seasons.map(year => <li key={year.year}>{year.year}: {money(year.salary)} · {contractType(year.type)}</li>)}</ul><p>Arbitration and pre-arbitration salaries are estimates. Option years are not guaranteed. The budget uses the saved CBT payroll charge, which can differ from annual cash salary.</p></details>}
                    </li>)}{!s.length && <li className="gm-muted">Nobody yet</li>}</ul>
                    <TradePlayerSearch key={`${moves.team}-${partner}-${title}`} label={`Search ${title === "You send" ? "your players" : "their players"}`}
                      query={title === "You send" ? giveQuery : getQuery} onQuery={title === "You send" ? setGiveQuery : setGetQuery}
                      choices={l.filter(x => !s.includes(x.pid)).map(x => ({ pid: x.pid, name: x.v.n, position: x.v.k === "p" ? `Prospect · ${prospectBrief(x.v)}` : x.v.pos, war: x.v.k === "p" ? undefined : V[x.pid]?.w27, salary: contracts[x.pid].hit, control: contracts[x.pid].controlThrough, contract: contractBrief(contracts[x.pid]), unavailable: !x.priced ? "no trade valuation available" : x.v.prot === "full" ? "no-trade clause" : league.userAav.has(x.pid) || league.extraAav?.has(x.pid) || contracts[x.pid].minorInvite ? "just signed" : "" }))}
                      onAdd={pid => { if (s.length >= 5) { setTradeNote({ ok: false, text: "Each side can include at most five players. Remove a player before adding another." }); return; } st([...s, pid]); setTradeNote(null); }} />
                    <p className="gm-trade-summary">{s.length} {s.length === 1 ? "player" : "players"} in this side of the offer</p>
                  </div>
                );
              })}
              <div className="gm-propose">
                <div className="gm-trade-cash"><label className="gm-field"><span>Cash in this trade</span><select value={cashDirection} onChange={e => { setCashDirection(e.target.value); setTradeNote(null); }}><option value="send">You send cash</option><option value="receive">You receive cash</option></select></label><label className="gm-field"><span>Cash amount ($M)</span><input type="number" min="0" max="50" step="0.1" value={cashAmount} onChange={e => { setCashAmount(e.target.value); setTradeNote(null); }} /></label><p>One-time 2027 salary coverage. The paying club must send players with at least this much budget charge. A club can pay at most $50M across the offseason. This is a game budget adjustment, not MLB luxury-tax accounting.</p></div>
                {tradePayroll && <p className="gm-payroll-preview">If accepted: {tradePayroll.change < 0 ? `clears ${money(-tradePayroll.change)}` : `adds ${money(tradePayroll.change)}`} of your 2027 budget{cash ? ", including cash" : ""}. Your payroll plus net trade cash would be {money(tradePayroll.total)}{tradePayroll.total > budget ? `, still ${money(tradePayroll.total - budget)} over budget` : `, ${money(budget - tradePayroll.total)} under budget`}.</p>}
                <button type="button" onClick={propose} disabled={!give.length && !get.length}>Propose trade</button>
                {tradeNote && <p role="status" className={tradeNote.ok ? "gm-good" : "gm-bad"}>{tradeNote.text}</p>}
              </div>
            </div>
          ) : <p className="gm-muted">{give.length ? `${give.map(pid => label(pid)).join(", ")} ${give.length === 1 ? "is" : "are"} ready in your offer. ` : ""}Pick a team to see its roster and prospects.</p>}
        </div>
      )}

      {tab === "roster" && (
        <div className="gm-panel" role="tabpanel" id="gm-panel-roster" aria-labelledby="gm-tab-roster">
          <div className="gm-roster-nav" role="group" aria-label="Roster view"><button type="button" aria-pressed={rosterView === "contracts"} onClick={() => setRosterView("contracts")}>Players & contracts</button><button type="button" aria-pressed={rosterView === "depth"} onClick={() => setRosterView("depth")}>Projected depth chart</button></div>
          {rosterView === "contracts" ? <>
            <p className="gm-note">Every player in your organization, including prospects and contracts outside the projected lineup. “WAR at risk” estimates the roster impact of moving a player with no replacement coming back. A club still needs a reason to take his contract.</p>
            <div className="gm-filters gm-roster-filters"><label className="gm-field"><span>Find a roster player</span><input value={rosterQuery} onChange={e => { setRosterQuery(e.target.value); setRosterLimit(30); }} placeholder="Name, position, or prospect" /></label><label className="gm-field"><span>Sort your roster</span><select value={rosterSort} onChange={e => { setRosterSort(e.target.value); setRosterLimit(30); }}><option value="salary">Highest 2027 budget hit</option><option value="impact">Most WAR at risk</option><option value="name">Player name</option></select></label></div>
            <p className="gm-note">{rosterShown.length} {rosterShown.length === 1 ? "player matches" : "players match"} · showing {Math.min(rosterLimit, rosterShown.length)}</p>
            <div className="gm-contracts-wrap"><table className="gm-contracts" role="table"><thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Player</th><th scope="col" role="columnheader">2027 budget</th><th scope="col" role="columnheader">Contract / control</th><th scope="col" role="columnheader">WAR at risk</th><th scope="col" role="columnheader">Trade options</th></tr></thead><tbody role="rowgroup">{rosterShown.slice(0, rosterLimit).map(({ pid, v, priced, contract, used, lostWar, roles }) => {
              const blocked = !priced ? "No trade valuation available" : v.prot === "full" ? "Full no-trade clause" : league.userAav.has(pid) || league.extraAav?.has(pid) || contract.minorInvite ? "Just signed this offseason" : "";
              return <tr key={pid} role="row"><th scope="row" role="rowheader">{v.n}<small>{v.k === "p" ? `Prospect · ${prospectBrief(v)}` : prospectBrief(v)}</small><small>{contract.minorInvite ? "Non-roster invitation" : v.k === "p" ? "Not in the MLB playing-time projection" : used ? `${roles.join(" / ")} · ${Math.round(used)} ${roster.some(p => p.pid === pid && p.k === "b") ? roster.some(p => p.pid === pid && p.k === "p") ? "PA + IP" : "PA" : "IP"} assigned` : "Outside projected playing time"}</small></th>
                <td role="cell" data-label="2027 budget">{contract.prospect || contract.minorInvite ? "No MLB charge" : <>{money(contract.hit)}<small>{contract.salary != null ? `${money(contract.salary)} cash salary` : "Estimated budget charge"}</small></>}</td>
                <td role="cell" data-label="Contract / control">{contract.seasons.length ? <details className="gm-contract-detail"><summary>Through {contract.controlThrough ?? contract.seasons.at(-1)?.year}</summary><ul>{contract.seasons.map(year => <li key={year.year}>{year.year}: {money(year.salary)} · {contractType(year.type)}</li>)}</ul></details> : contract.prospect ? "Pre-MLB" : contract.minorInvite ? "Non-guaranteed" : "No future MLB seasons modeled"}</td>
                <td role="cell" data-label="WAR at risk">{lostWar.toFixed(1)}<small>{used ? "Projected roster loss" : "No current MLB playing time"}</small></td>
                <td role="cell" data-label="Trade options"><button type="button" className="gm-contract-trade" onClick={() => exploreTrade(pid)} disabled={!!blocked} aria-label={`Explore trade for ${v.n}`}>Explore trade</button>{blocked && <small>{blocked}</small>}</td></tr>;
            })}{!rosterShown.length && <tr><td colSpan={5}>No roster players match.</td></tr>}</tbody></table></div>
            {rosterShown.length > rosterLimit && <div className="gm-list-summary"><button type="button" onClick={() => setRosterLimit(n => n + 30)}>Show {Math.min(30, rosterShown.length - rosterLimit)} more players</button></div>}
            <p className="gm-note">Budget hit can differ from cash salary. Arbitration salaries are estimates; option years are not guaranteed. Player charges alone do not sum to the team payroll, which also includes the saved payroll adjustments.</p>
          </> : <div className="gm-roster">{POSITIONS.map((pos) => {
            const slot = alloc.positions[pos];
            return (
              <div key={pos} className={`gm-slot${PITCHING.includes(pos) ? " gm-slot-pitching" : ""}`}>
                <h3><span>{pos}</span>{slot.war.toFixed(1)} WAR</h3>
                <ul>{slot.rows.map((r) => <li key={r.p.i}>{label(r.p.pid, r.p.i)} <small>{Math.round(r.pt)} {PITCHING.includes(pos) ? "IP" : "PA"} · {r.war.toFixed(1)}</small></li>)}
                  {slot.replacement >= 1 && <li className="gm-muted">Replacement level · {Math.round(slot.replacement)} {PITCHING.includes(pos) ? "IP" : "PA"}</li>}</ul>
              </div>
            );
          })}
          <p className="gm-note">Playing time is assigned automatically. The separate <Link href="/tools/depth-chart">depth chart tool</Link> lets you experiment with roles, but its edits do not carry into this game.</p>
          </div>}
        </div>
      )}

      {tab === "moves" && (
        <div className="gm-panel" role="tabpanel" id="gm-panel-moves" aria-labelledby="gm-tab-moves">
          {!moves.signings.length && !moves.trades.length && <p className="gm-muted">No moves yet.</p>}
          <ul className="gm-moves">
            {moves.signings.map((s, i) => <li key={`s${i}`}>Signed <strong>{label(s.pid)}</strong>, {yearsLabel(s.years)}, {money(s.total)} ({money(s.total / s.years)} a year) <button type="button" className="gm-link" aria-label={`Undo signing ${label(s.pid)}`} onClick={() => undo("signing", i)}>undo</button></li>)}
            {moves.trades.map((t, i) => <li key={`t${i}`}>Traded {t.give.map((p) => V[p]?.n).join(", ") || "nothing"} to {ctx.sim.teams[t.partner].name} for <strong>{t.get.map((p) => V[p]?.n).join(", ") || "nothing"}</strong>{t.cash ? ` · ${t.cash > 0 ? "sent" : "received"} ${money(Math.abs(t.cash))} cash` : ""} <button type="button" className="gm-link" onClick={() => undo("trade", i)}>undo</button></li>)}
          </ul>
        </div>
      )}

      </fieldset>

      {results && (
        <div className="gm-results" id="gm-results" aria-live="polite">
          <div className="gm-headline">
            <div>
              <p className="gm-result-kicker">OFFSEASON IN THE BOOKS</p>
              <h2>{impact!.headline}</h2>
              <p className={`gm-result-impact ${results.you.playoffs - results.base.playoffs > .0005 ? "gm-good" : results.you.playoffs - results.base.playoffs < -.0005 ? "gm-bad" : ""}`}>{impact!.playoffs} compared with standing pat.</p>
              <p><strong>{teamName}: {Math.round(results.you.p50)}–{162 - Math.round(results.you.p50)} projected.</strong> In 8 of 10 simulated seasons, between {Math.round(results.you.p10)} and {Math.round(results.you.p90)} wins. Standing pat projects {Math.round(results.base.p50)} wins.</p>
            </div>
          </div>
          <div className="gm-share gm-result-actions">
            <button type="button" onClick={() => showTab("moves")}>Review or adjust moves</button>
            <button type="button" onClick={() => copy(shareUrl(), "link")}>Copy link to this offseason</button>
            <button type="button" onClick={() => copy(summaryText(), "summary")}>Copy summary</button>
            {copied && <span role="status">{copied === "failed" ? "Copy failed" : `Copied ${copied}`}</span>}
          </div>
          <p className="gm-note">Keep your current deals and completed market rounds. Adjust or undo a move, then simulate again with the same seed for a consistent comparison.</p>
          <section className="gm-debrief" aria-label="Offseason debrief">
            <h3>What your offseason changed</h3>
            <p>{positionChanges[0].change > .05 ? <><strong>{positionChanges[0].pos} improved most:</strong> {positionChanges[0].before.toFixed(1)} → {positionChanges[0].after.toFixed(1)} projected WAR. </> : "No position improved by more than 0.05 projected WAR. "}{moves.signings.length} MLB {moves.signings.length === 1 ? "signing" : "signings"} and {moves.trades.length} {moves.trades.length === 1 ? "trade" : "trades"} completed.</p>
            <ul><li><strong>On the field</strong><span>{signedWins(results.you.mean - results.base.mean)} expected wins; {signedPts(results.you.playoffs - results.base.playoffs)} in playoff odds.</span></li><li><strong>Contract discipline</strong><span>{money(Math.max(0, budget - results.payroll))} under budget. {moves.signings.length ? <>Your signed contracts are {money(Math.abs(results.value.signings))} {results.value.signings >= 0 ? "below" : "above"} our term-adjusted model valuation.</> : "No free-agent guarantees added."}</span></li><li><strong>Future talent</strong><span>{moves.trades.flatMap(t => t.give).filter(pid => V[pid]?.k === "p").length} prospects sent; {moves.trades.flatMap(t => t.get).filter(pid => V[pid]?.k === "p").length} received. Trade value is {signedMoney(results.value.trades)}, including cash.</span></li></ul>
            <p className="gm-note"><span className="gm-grade">{results.grade.label} <strong>{results.grade.letter}</strong></span> {results.grade.winWeight} × wins gained + model value ÷ $25M{results.grade.shortfall>0?` + ${results.grade.repair.toFixed(1)} payroll-repair points`:""}. These are disclosed game weights, not a measure of real GM skill.</p>
            <ul className="gm-named-moves">{moves.signings.map(s=><li key={s.pid}><strong>Signed {label(s.pid)}</strong>: {yearsLabel(s.years)}, {money(s.total)}.</li>)}{moves.trades.map((t,i)=><li key={`trade-${i}`}><strong>Trade with {ctx.sim.teams[t.partner].name}</strong>: received {t.get.map(pid=>label(pid)).join(", ")||"salary relief"}; sent {t.give.map(pid=>label(pid)).join(", ")||"no players"}.</li>)}</ul>
          </section>
          <table className="gm-odds">
            <thead><tr><th scope="col" /><th scope="col" className="num">Your moves</th><th scope="col" className="num">Standing pat</th><th scope="col" className="num">Change</th></tr></thead>
            <tbody>
              {([["Average wins", "mean"], ["Win division", "division"], ["Make playoffs", "playoffs"], ["Win pennant", "pennant"], ["Win World Series", "title"]] as const).map(([l, k]) => (
                <tr key={k}><th scope="row">{l}</th>
                  <td className="num">{k === "mean" ? results.you.mean.toFixed(1) : pct(results.you[k])}</td>
                  <td className="num">{k === "mean" ? results.base.mean.toFixed(1) : pct(results.base[k])}</td>
                  <td className={`num ${results.you[k] > results.base[k] ? "gm-good" : results.you[k] < results.base[k] ? "gm-bad" : ""}`}>{k === "mean" ? signedWins(results.you.mean - results.base.mean) : signedPts(results.you[k] - results.base[k])}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="gm-ledger">
            <p><strong>{money(results.payroll)}</strong><span>2027 payroll + net trade cash, {results.payroll > budget ? `${money(results.payroll - budget)} over` : `${money(budget - results.payroll)} under`} budget</span></p>
            <p><strong>{signedMoney(results.value.total)}</strong><span>net model value: trades {signedMoney(results.value.trades)}, contracts vs term-adjusted estimates {signedMoney(results.value.signings)}</span></p>
            <p><strong>{results.war.toFixed(1)}</strong><span>projected WAR ({signedWins(results.war - results.baseWar)} vs standing pat)</span></p>
          </div>
          <p className="gm-note">The score uses your objective’s win weight, model value at one point per $25M, and any payroll-repair credit shown above. It is not an evaluation of a real front office. “Standing pat” means you make no moves while the other 29 teams still sign free agents. Odds describe this simplified simulation, not a calibrated forecast.</p>
          {moves.trades.length > 0 && <details className="gm-trade-review"><summary>Trade value review</summary><p className="gm-note">Model surplus value is projected production minus salary, not a real club’s asking price.</p><ul>{moves.trades.map((trade, i) => {
            const sent = trade.give.reduce((sum, pid) => sum + (V[pid]?.v10 ?? 0), 0), received = trade.get.reduce((sum, pid) => sum + (V[pid]?.v10 ?? 0), 0);
            return <li key={i}><strong>Trade with {ctx.sim.teams[trade.partner].name}</strong><p>Sent: {trade.give.map(pid => V[pid]?.n).join(", ") || "no players"} ({money(sent)}). Received: {trade.get.map(pid => V[pid]?.n).join(", ") || "no players"} ({money(received)}).{trade.cash ? ` Cash ${trade.cash > 0 ? "sent" : "received"}: ${money(Math.abs(trade.cash))}.` : ""} Net model value: {signedMoney(received - sent - (trade.cash ?? 0))}.</p></li>;
          })}</ul></details>}
          <div className="gm-two">
            <div>
              <h3>Your division</h3>
              <table className="gm-mini"><tbody>
                {teams.filter(([t]) => ctx.sim.teams[t].division === ctx.sim.teams[moves.team].division).sort((a, b) => results.all[b[0]].mean - results.all[a[0]].mean).map(([t, info]) => (
                  <tr key={t} className={t === moves.team ? "gm-you" : undefined}><th scope="row">{info.name}</th><td className="num">{Math.round(results.all[t].p50)} W</td><td className="num">{pct(results.all[t].playoffs)} playoffs</td></tr>
                ))}
              </tbody></table>
            </div>
            <div>
              <h3>Around the league</h3>
              <ul className="gm-ai">{results.aiSignings.slice(0, 10).map((s) => <li key={s.pid}><strong>{s.name}</strong> to {ctx.sim.teams[s.team].name}, {yearsLabel(s.years)}, {money(s.total)}</li>)}</ul>
              {results.aiSignings.length > 10 && <details><summary>{results.aiSignings.length - 10} more simulated signings</summary><ul className="gm-ai">{results.aiSignings.slice(10).map(s => <li key={s.pid}><strong>{s.name}</strong> to {ctx.sim.teams[s.team].name}, {yearsLabel(s.years)}, {money(s.total)}</li>)}</ul></details>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
