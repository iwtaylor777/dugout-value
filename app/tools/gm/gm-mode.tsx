"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TradePlayerSearch } from "./trade-player-search";
import { createGmShareUrl, readGmSaveUrl } from "../../../lib/gm-share-url.mjs";
import depth from "../../data/depth-chart.json";
import trackerData from "../../data/free-agent-tracker.json";
import { marketTracker } from "../../../lib/free-agent-current.mjs";
import signingsData from "../../data/free-agent-signings.json";
import simData from "../../data/gm-sim.json";
import payrollData from "../../data/team-payroll.json";
import { allocate, bestAdditions, POSITIONS, PITCHING } from "../../../lib/depth-chart.mjs";
import { matchesProjectionRole } from "../../../lib/projection-filters.mjs";
import { advanceMarket, marketBoard, MARKET_ROUNDS, newMarket, submitMarketBid, userOfferOutcomes, withdrawMarketBid } from "../../../lib/gm-market.mjs";
import {
  aiFreeAgency, buildLeague, decodeMoves, encodeMoves, grade, movesValue, payrollFor, respondToTrade, rosterOf,
  signFreeAgent, simulateSeasons, teamModes, teamStrengths, restoreMoves, undoMove, seasonReadiness, playerContract, rivalBudget,
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
const outcomeLabels: Record<string, string> = { signed: "Signed with you", lost: "Signed elsewhere", submitted: "Offer submitted", pending: "Still considering", unsigned: "Not signed", withdrawn: "You withdrew", undone: "Signing undone" };
const newSeed = () => Math.floor(Math.random() * 1e9) + 1;
const label = (pid: string, i?: string) => `${V[pid]?.n ?? faRows.get(pid)?.name ?? ctx.players.find(p => p.pid === pid)?.n ?? pid}${i?.endsWith("-bat") ? " (hitting)" : i?.endsWith("-pit") ? " (pitching)" : ""}`;
const defaultOffer = (row: TrackerRow) => ({ years: String(row.years ?? 1), total: String(row.total != null && row.aav != null && row.aav >= 1 ? row.total : 0.8) });
const TABS = ["fa", "trade", "roster", "moves"] as const;
const contractType = (type: string) => type.startsWith("arb") ? "arbitration estimate" : type === "preArb" || type === "prearb" ? "pre-arbitration estimate" : type === "clubOption" ? "club option" : type === "playerOption" ? "player option" : type === "mutualOption" ? "mutual option" : type === "fixed" ? "contract" : "estimate";
const contractBrief = (contract: ReturnType<typeof playerContract>) => contract.prospect ? "Prospect · no MLB payroll charge modeled" : `${contract.salary != null ? `${money(contract.salary)} salary · ` : ""}${money(contract.hit)} budget hit in 2027`;

type Results = {
  you: GmTeamResult; base: GmTeamResult; all: Record<string, GmTeamResult>; baseAll: Record<string, GmTeamResult>;
  aiSignings: { pid: string; name: string; team: string; years: number; total: number }[];
  payroll: number; war: number; baseWar: number; value: { trades: number; signings: number; total: number }; grade: { letter: string; points: number };
};

export function GmMode() {
  const [moves, setMoves] = useState<GmMoves>({ team: "BOS", budget: null, seed: 1, signings: [], trades: [] });
  const [tab, setTab] = useState<"roster" | "fa" | "trade" | "moves">("fa");
  const [offers, setOffers] = useState<Record<string, { years: string; total: string; note?: string; ok?: boolean }>>({});
  const [faQuery, setFaQuery] = useState("");
  const [faPos, setFaPos] = useState("All");
  const [faSort, setFaSort] = useState("gain");
  const [faLimit, setFaLimit] = useState(20);
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
  const autoRun = useRef<GmMoves | null>(null);
  const runVersion = useRef(0);

  const budget = moves.budget ?? Math.round(ctx.sim.teams[moves.team].cbt2026);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
    try {
      const s = readGmSaveUrl(window.location.href);
      const m = s ? decodeMoves(s) : null;
      if (s) {
        const restored = m ? restoreMoves(ctx, m) : null;
        if (restored?.moves) { setMoves(restored.moves); if (!restored.moves.market || restored.moves.market.round === MARKET_ROUNDS) autoRun.current = restored.moves; return; }
        setFeedback({ tone: "error", text: restored?.reason ?? "This saved offseason could not be loaded. Start a new one below; no moves were applied." });
      }
    } catch { /* ignore */ }
    setMoves((m) => ({ ...m, seed: newSeed() }));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const league = useMemo(() => buildLeague(ctx, moves), [moves]);
  const modes = useMemo(() => teamModes(ctx, league.teamOf), [league]);
  const payroll = useMemo(() => payrollFor(ctx, league, moves.team), [league, moves.team]);
  const readiness = useMemo(() => seasonReadiness(ctx, moves), [moves]);
  const roster = useMemo(() => rosterOf(ctx, league.teamOf, moves.team), [league, moves.team]);
  const alloc = useMemo(() => allocate(roster), [roster]);
  const startingWar = useMemo(() => {
    const initial = buildLeague(ctx, { team: moves.team, seed: 1, signings: [], trades: [] });
    return allocate(rosterOf(ctx, initial.teamOf, moves.team)).total;
  }, [moves.team]);
  const market = useMemo(() => new Map(marketBoard(ctx, moves).map(m => [m.pid, m])), [moves]);
  const offerOutcomes = useMemo(() => userOfferOutcomes(ctx, moves), [moves]);
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
  const faFiltered = freeAgents.filter((f) => (faPos === "All" || matchesProjectionRole({ position: f.entries.flatMap(p => p.e).join("/") }, faPos))
    && (!faQuery.trim() || f.row.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(faQuery.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())))
    .sort((a, b) => (faSort === "gain" ? b.gain - a.gain : faSort === "cost" ? (a.row.aav ?? 0.8) - (b.row.aav ?? 0.8) : (b.row.total ?? 0) - (a.row.total ?? 0)) || a.row.name.localeCompare(b.row.name));
  const faShown = faFiltered.slice(0, faLimit);

  const ownedBy = (abbr: string) => Object.entries(V).filter(([pid]) => league.owner.get(pid) === abbr)
    .map(([pid, v]) => ({ pid, v }))
    .sort((a, b) => a.v.n.localeCompare(b.v.n));
  const partnerList = useMemo(() => (partner ? ownedBy(partner) : []), [partner, league]); // eslint-disable-line react-hooks/exhaustive-deps
  const yourList = useMemo(() => ownedBy(moves.team), [moves.team, league]); // eslint-disable-line react-hooks/exhaustive-deps
  const contracts = useMemo(() => Object.fromEntries([...yourList, ...partnerList].map(p => [p.pid, playerContract(ctx, league, p.pid)])), [yourList, partnerList, league]);
  const tradePayroll = useMemo(() => {
    if (!partner || (!give.length && !get.length)) return null;
    if (!cashAmount.trim() || Number(cashAmount) < 0 || !Number.isFinite(cash) || Math.abs(cash) > 100) return null;
    const after = buildLeague(ctx, { ...moves, trades: [...moves.trades, { partner, give, get, cash }] });
    const total = payrollFor(ctx, after, moves.team);
    return { total, change: total - payroll };
  }, [partner, give, get, cash, cashAmount, moves, payroll]);

  const reset = (team: string, competitiveMode = competitive) => {
    runVersion.current++;
    setMoves({ team, budget: null, seed: newSeed(), signings: [], trades: [], ...(competitiveMode ? { market: newMarket() } : {}) });
    setOffers({}); setGive([]); setGet([]); setTradeNote(null); setResults(null); setPartner("");
    setFaQuery(""); setFaPos("All"); setFaLimit(20); setGiveQuery(""); setGetQuery(""); setCashAmount("0"); setCashDirection("send"); setRunning(false);
    setBudgetDraft(null);
    setMarketNews([]);
    setShowSigningLedger(false);
    setFeedback({ tone: "success", text: `New ${ctx.sim.teams[team].name} offseason. No moves made yet.` });
    window.history.replaceState(null, "", window.location.pathname);
  };
  const update = (m: GmMoves) => { runVersion.current++; setMoves(m); setResults(null); setRunning(false); window.history.replaceState(null, "", window.location.pathname); };

  const offer = (pid: string) => {
    const row = faRows.get(pid)!; const pending = moves.market?.bids.find(b => b.pid === pid);
    const d = offers[pid] ?? (pending ? { years: String(pending.years), total: String(pending.total) } : defaultOffer(row));
    const o = { years: Number(d.years), total: Number(d.total) };
    if (bidding) {
      const ans = submitMarketBid(ctx, moves, { pid, ...o });
      setOffers(x => ({ ...x, [pid]: { ...d, note: ans.reason, ok: ans.accepted } }));
      if (ans.moves) update(ans.moves);
      setFeedback({ tone: ans.accepted ? "success" : "error", text: `${row.name}: ${ans.reason}` });
      return;
    }
    const ans = signFreeAgent(ctx, league, moves, budget, row, o, moves.seed);
    setOffers((x) => ({ ...x, [pid]: { ...d, note: ans.reason, ok: ans.accepted } }));
    if (ans.accepted) {
      const next = { ...moves, signings: [...moves.signings, { pid, years: o.years, total: o.total }] };
      if (next.market) next.market = { ...next.market, history: [...(next.market.history ?? []).filter(h => h.pid !== pid), { pid, ...o, round: 3 }] };
      const nextLeague = buildLeague(ctx, next);
      const gain = allocate(rosterOf(ctx, nextLeague.teamOf, moves.team)).total - alloc.total;
      update(next);
      const roomAfter = budget - payrollFor(ctx, nextLeague, moves.team);
      setFeedback({ tone: "success", text: `Signed ${row.name}: ${o.years} ${o.years === 1 ? "year" : "years"}, ${money(o.total)} total (${money(o.total / o.years)} a year). ${signedWins(gain)} projected roster WAR. ${roomAfter < 0 ? `Clear ${money(-roomAfter)} before simulating the season.` : `${money(roomAfter)} left under budget.`}` });
    }
  };
  const propose = () => {
    if (!cashAmount.trim() || !Number.isFinite(Number(cashAmount)) || Number(cashAmount) < 0 || Number(cashAmount) > 100) { setTradeNote({ ok: false, text: "Enter cash from $0M to $100M." }); return; }
    const proposal = { partner, give, get, ...(cash ? { cash } : {}) };
    const ans = respondToTrade(ctx, league, moves, budget, proposal, modes);
    setTradeNote({ ok: ans.accepted, text: ans.reason });
    if (ans.accepted) { update({ ...moves, trades: [...moves.trades, proposal] }); setGive([]); setGet([]); setGiveQuery(""); setGetQuery(""); setCashAmount("0"); setFeedback({ tone: "success", text: `Trade completed with ${ctx.sim.teams[partner].name}. You received ${get.map(pid => V[pid]?.n).join(", ") || "no players"}.${cash ? ` You ${cash > 0 ? "sent" : "received"} ${money(Math.abs(cash))} in cash.` : ""} See the value breakdown after simulating the season.` }); }
  };
  const withdrawBid = (pid: string) => {
    update(withdrawMarketBid(moves, pid));
    setOffers(previous => {
      const next = { ...previous };
      if (next[pid]) next[pid] = { ...next[pid], note: undefined, ok: undefined };
      return next;
    });
    setFeedback({ tone: "success", text: `Withdrew the offer to ${label(pid)}. The reserved payroll is available again.` });
  };
  const undo = (kind: "signing" | "trade", index: number) => {
    const undone = undoMove(ctx, moves, kind, index);
    update(undone.moves); setGive([]); setGet([]); setTradeNote(null);
    setMarketNews([]); setShowSigningLedger(true);
    setFeedback({ tone: "success", text: `Move undone.${undone.removed > 1 ? ` ${undone.removed - 1} later dependent ${undone.removed === 2 ? "trade was" : "trades were"} also removed.` : ""}${moves.market ? " Completed market rounds and other clubs’ signings are unchanged." : ""}` });
  };

  const nextRound = () => {
    const version = ++runVersion.current;
    setRunning(true);
    setTimeout(() => {
      if (version !== runVersion.current) return;
      try {
        const next = advanceMarket(ctx, moves);
        update(next.moves);
        setMarketNews(next.news);
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
      setResults({ you: all[m.team], base: baseAll[m.team], all, baseAll, aiSignings: ai.signings, payroll: pay, war: st[m.team].war, baseWar: bst[m.team].war, value, grade: grade(all[m.team].mean - baseAll[m.team].mean, value.total) });
      setTimeout(() => document.getElementById("gm-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      } catch { setFeedback({ tone: "error", text: "The simulation could not finish. Your moves are still here; try again." }); }
      finally { if (version === runVersion.current) setRunning(false); }
    }, 30);
  };
  useEffect(() => () => { runVersion.current++; }, []);
  useEffect(() => { if (autoRun.current && autoRun.current === moves) { autoRun.current = null; simulate(moves); } }, [moves]); // eslint-disable-line react-hooks/exhaustive-deps

  const shareUrl = () => {
    try { return createGmShareUrl(window.location.href, encodeMoves({ ...moves, budget })); } catch { return ""; }
  };
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 2000); } catch { setCopied("failed"); } };
  const summaryText = () => {
    if (!results) return "";
    const t = ctx.sim.teams[moves.team].name, r = results;
    const lines = [`My ${t} offseason on Dugout Value GM mode: grade ${r.grade.letter}.`,
      `Projected ${Math.round(r.you.p50)} wins (${Math.round(r.you.p10)}–${Math.round(r.you.p90)}), ${signedWins(r.you.mean - r.base.mean)} vs standing pat.`,
      `Playoffs ${pct(r.you.playoffs)} (${signedPts(r.you.playoffs - r.base.playoffs)}), World Series ${pct(r.you.title)}.`,
      ...moves.signings.map((s) => `Signed ${label(s.pid)}: ${yearsLabel(s.years)}, ${money(s.total)}`),
      ...moves.trades.map((tr) => `Traded ${tr.give.map((p) => V[p]?.n).join(", ") || "no players"} to ${ctx.sim.teams[tr.partner].name} for ${tr.get.map((p) => V[p]?.n).join(", ") || "no players"}${tr.cash ? `; ${tr.cash > 0 ? "sent" : "received"} ${money(Math.abs(tr.cash))} cash` : ""}.`)];
    return `${lines.join("\n")}\n${shareUrl()}`;
  };

  const teamName = ctx.sim.teams[moves.team].name;
  const room = budget - payroll;
  const mine = ranks[moves.team];
  const showTab = (next: typeof tab) => {
    setTab(next);
    document.getElementById(`gm-tab-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const choosePartner = (team: string) => { setPartner(team); setGet([]); setGetQuery(""); setCashAmount("0"); setTradeNote(null); };

  return (
    <section className="gm" aria-label="GM Mode offseason game" aria-busy={running}>
      <fieldset className="gm-controls" disabled={running}>
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
      <div className="gm-tools"><span>Changing teams starts a new offseason. This is a sandbox, not live transactions.</span><button type="button" className="gm-link" onClick={() => reset(moves.team)}>Start over</button><button type="button" className="gm-link" onClick={() => copy(shareUrl(), "link")}>Copy offseason link</button>{copied && <span role="status">{copied === "failed" ? "Couldn’t copy. Try again." : `Copied ${copied}`}</span>}</div>
      <div className="gm-brief"><div><strong>Where could you improve?</strong><p>Your lowest-ranked positions. Pick one to find free agents who can help.</p></div><div className="gm-needs">{needs.map(need => <button key={need.pos} type="button" onClick={() => { showTab("fa"); setFaPos(need.pos); setFaQuery(""); setFaLimit(20); }}><strong>{need.pos}</strong><span>No. {need.rank} of 30 · {need.war.toFixed(1)} WAR</span></button>)}</div></div>
      {feedback && <p className="gm-feedback" data-tone={feedback.tone} role="status">{feedback.text}</p>}
      {readiness.shortfall > 1e-9 && <aside className="gm-budget-plan" id="gm-budget-plan">
        <div><strong>Before Opening Day: clear {money(readiness.shortfall)}</strong><p>Your signed roster is over budget. {bidding ? "You can keep negotiating and advancing rounds. " : ""}Make a salary-clearing trade or undo moves before simulating the season.</p></div>
        <div className="gm-budget-actions"><button type="button" onClick={() => showTab("trade")}>Find a salary-clearing trade</button><button type="button" onClick={() => showTab("moves")}>Review / undo moves</button></div>
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
          {!offerOutcomes.length ? <p className="gm-note">No offers yet. Browse free agents to start negotiating.</p> : <ul>{offerOutcomes.map(({ offer: bid, status, deal, reason }) => <li key={bid.pid} data-outcome={status}>
            <div className="gm-offer-result-heading"><strong>{label(bid.pid)}</strong><span>{outcomeLabels[status]}</span></div>
            <p>Your offer: {yearsLabel(bid.years)}, {money(bid.total)} total · submitted in round {bid.round}.</p>
            {deal && <p><strong>{deal.team === moves.team ? "Your deal" : ctx.sim.teams[deal.team].name}:</strong> {yearsLabel(deal.years)}, {money(deal.total)} total ({money(deal.total / deal.years)}/year).</p>}
            {reason && <p>{reason}</p>}
            {status === "undone" && <p>You undid this signing. It is no longer on your payroll.</p>}
            {(status === "pending" || status === "submitted") && <div className="gm-offer-result-actions"><button type="button" className="gm-link" onClick={() => { setFaQuery(label(bid.pid)); setFaPos("All"); setFaLimit(20); showTab("fa"); }}>Review / revise offer<span className="gm-sr"> to {label(bid.pid)}</span></button><button type="button" className="gm-link" onClick={() => withdrawBid(bid.pid)}>Withdraw<span className="gm-sr"> offer to {label(bid.pid)}</span></button></div>}
          </li>)}</ul>}
        </section>
        {(marketNews.length > 0 || moves.market!.deals.length > 0 || moves.signings.length > 0) && (
          <details className="gm-market-feed" open>
            <summary>League wire · market activity</summary>
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
        <details className="gm-market-reminder"><summary>Budget and undo rules</summary><p>You may exceed your budget while building the roster, but must get under it before simulating. Revise or withdraw pending bids, trade salary away, or undo your own moves. Undo is a sandbox correction, not a real contract cancellation; it does not rewind market rounds or other clubs’ signings. Rival clubs still use hard budgets. The final round lists late signings in the league wire.</p></details>
      </section>}
      <div className="gm-run">
        <button type="button" className="gm-sim" onClick={() => results ? document.getElementById("gm-results")?.scrollIntoView({ behavior: "smooth", block: "start" }) : simulate()} disabled={running || !readiness.ready} aria-describedby={readiness.shortfall > 1e-9 ? "gm-budget-plan" : undefined}>{running ? "Working…" : results ? "View season results" : "Finish offseason · simulate 2027"}</button>
        <small>{bidding ? "Finish all three bidding rounds before simulating the season." : readiness.shortfall > 1e-9 ? `Clear ${money(readiness.shortfall)} through trades or undo moves to unlock the season.` : competitive ? "Roster is within budget. You’re ready to simulate 2027." : results ? "Change a move or your budget to try another plan. The same seed keeps comparisons consistent." : "The other 29 teams fill out their rosters. You can revise your moves after seeing the results."}</small>
      </div>

      <div className="gm-tabs" role="tablist" aria-label="Offseason">
        {([["fa", "Free agents"], ["trade", "Trades"], ["roster", "Your roster"], ["moves", `Your moves (${moves.signings.length + moves.trades.length})`]] as const).map(([k, l]) => (
          <button key={k} id={`gm-tab-${k}`} type="button" role="tab" aria-controls={`gm-panel-${k}`} tabIndex={tab === k ? 0 : -1} aria-selected={tab === k} className={tab === k ? "active" : undefined} onClick={() => setTab(k)} onKeyDown={(e) => {
            if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
            e.preventDefault(); const index = TABS.indexOf(k);
            const next = e.key === "Home" ? TABS[0] : e.key === "End" ? TABS[3] : TABS[(index + (e.key === "ArrowRight" ? 1 : 3)) % 4];
            setTab(next); document.getElementById(`gm-tab-${next}`)?.focus();
          }}>{l}</button>
        ))}
      </div>

      {tab === "fa" && (
        <div className="gm-panel" role="tabpanel" id="gm-panel-fa" aria-labelledby="gm-tab-fa">
          <div className="gm-filters">
            <label className="gm-field"><span>Find a free agent</span><input value={faQuery} onChange={(e) => { setFaQuery(e.target.value); setFaLimit(20); }} placeholder="Name…" /></label>
            <label className="gm-field"><span>Position</span><select value={faPos} onChange={(e) => { setFaPos(e.target.value); setFaLimit(20); }}>{["All", "C", "1B", "2B", "3B", "SS", "OF", "LF", "CF", "RF", "DH", "SP", "RP"].map((p) => <option key={p}>{p}</option>)}</select></label>
            <label className="gm-field"><span>Sort free agents</span><select value={faSort} onChange={e => { setFaSort(e.target.value); setFaLimit(20); }}><option value="gain">Most WAR added</option><option value="cost">Lowest annual cost</option><option value="market">Largest contract estimate</option></select></label>
          </div>
          <p className="gm-note">“Adds for you” accounts for the playing time he replaces. Offers are total guaranteed money, not annual salary. Players may ask for more than our estimate.</p>
          <div className="gm-list-summary"><span>{faFiltered.length} free {faFiltered.length === 1 ? "agent matches" : "agents match"} · showing {faShown.length}</span>{bidding && <a href="#gm-market">Review bids and advance</a>}{(faQuery || faPos !== "All") && <button type="button" className="gm-link" onClick={() => { setFaQuery(""); setFaPos("All"); setFaLimit(20); }}>Clear filters</button>}</div>
          <div className="gm-table-wrap" tabIndex={0} role="region" aria-label="Free-agent offers">
            <table className="gm-table" role="table">
              <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Player</th><th scope="col" role="columnheader" className="num">2027 WAR</th><th scope="col" role="columnheader" className="num">Adds for you</th><th scope="col" role="columnheader" className="num">Our estimate</th><th scope="col" role="columnheader">Your offer</th></tr></thead>
              <tbody role="rowgroup">
                {faShown.map(({ pid, row, gain, positions }) => {
                  const pending = moves.market?.bids.find(b => b.pid === pid);
                  const d = offers[pid] ?? (pending ? { years: String(pending.years), total: String(pending.total), note: undefined, ok: undefined } : defaultOffer(row));
                  const interest = market.get(pid);
                  const offerRoom = room - reserved + (pending ? pending.total / pending.years : 0);
                  return (
                    <tr key={pid} role="row">
                      <th scope="row" role="rowheader">{row.name}<small>{row.pos} · {row.team ?? "—"} · age {row.age}</small>{interest && <details className="gm-player-market"><summary>{interest.rivals.length ? `${interest.rivals.length} rival ${interest.rivals.length === 1 ? "club" : "clubs"} interested` : "No rival offer yet"}</summary><p>Decision expected by round {Math.max(moves.market!.round + 1, interest.deadline)}. Values {interest.preference === "role" ? "a clear playing role" : "a chance to contend"} as a small tie-breaker.</p>{interest.rivals.length ? <ul>{interest.rivals.map(r => <li key={r.team}>{ctx.sim.teams[r.team].name}: around {money(Math.floor(r.total / 5) * 5)}–{money(Math.floor(r.total / 5) * 5 + 5)} over {r.years} yrs.</li>)}</ul> : <p>Other clubs could enter after their first choices sign.</p>}<p>Offers are estimates from the simulated market. Clubs may raise them within their limits.</p></details>}</th>
                      <td className="num" role="cell" data-label="2027 WAR">{row.war2027?.toFixed(1) ?? "—"}</td>
                      <td className="num" role="cell" data-label="Adds for you">{signedWins(gain)}<small>{positions.join(", ")}</small></td>
                      <td className="num" role="cell" data-label="Our estimate">{row.aav != null && row.aav < 1 ? "Minimum" : row.total != null ? <>{money(row.total)}<small>{yearsLabel(row.years ?? 1)} · {money(row.total / (row.years ?? 1))}/yr</small></> : "—"}</td>
                      <td className="gm-offer" role="cell" data-label="Your offer · total guaranteed">
                        <label><span className="gm-sr">Years for {row.name}</span><input type="number" min={1} max={13} value={d.years} onChange={(e) => setOffers((x) => ({ ...x, [pid]: { ...d, years: e.target.value, note: undefined } }))} /> yrs</label>
                        <label><span className="gm-sr">Guaranteed total for {row.name}, $M</span>$<input type="number" min={0.8} step={0.1} value={d.total} onChange={(e) => setOffers((x) => ({ ...x, [pid]: { ...d, total: e.target.value, note: undefined } }))} />M <span className="gm-total-label">total</span></label>
                        <button type="button" aria-label={`${bidding ? "Submit bid for" : "Offer contract to"} ${row.name}`} onClick={() => offer(pid)}>{bidding ? pending ? "Update bid" : "Submit bid" : "Offer"}</button>
                        {pending && (Number(d.years) !== pending.years || Number(d.total) !== pending.total) && <small className="gm-draft-note">Draft changes not submitted. Your current bid is {pending.years} yrs, {money(pending.total)}.</small>}
                        <small className="gm-offer-cost">{Number(d.years) > 0 && Number(d.total) > 0 ? `${money(Number(d.total) / Number(d.years))}/year · ${money(Math.abs(offerRoom - Number(d.total) / Number(d.years)))} ${offerRoom >= Number(d.total) / Number(d.years) ? "room left" : "over budget"}${bidding ? " after pending offers" : ""}` : "Enter years and total $M"}</small>
                        {d.note && <small role="status" className={d.ok ? "gm-good" : "gm-bad"}>{d.note}</small>}
                      </td>
                    </tr>
                  );
                })}
                {!faShown.length && <tr><td colSpan={5} className="gm-empty">{competitive && !bidding && !freeAgents.length ? <>Everyone in this market has signed. <a href="#gm-market">See the league wire</a> for destinations, or keep building through trades.</> : "No free agents match."}</td></tr>}
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
            {partner && <p className="gm-note">{ctx.sim.teams[partner].name}: {modes[partner] === "contend" ? "top 10 in current roster WAR; prioritizes 2027" : modes[partner] === "rebuild" ? "bottom 10 in current roster WAR; prioritizes control years" : "middle third in current roster WAR"}.</p>}
          </div>
          <aside className="gm-partner-budgets" aria-label="Trade partner budgets">
            <h3>{partner ? `${ctx.sim.teams[partner].name}: ${budgetRange(rivalBudgets[partner].room)} to add payroll` : "Who has room for salary?"}</h3>
            {partner && <p>Estimated budget: {budgetRange(rivalBudgets[partner].limit)} · current payroll and net trade cash: {money(rivalBudgets[partner].payroll)}.</p>}
            <p>Game estimates, not reported club budgets. Rivals set aside $5–15M for trades and in-season moves; cheap depth signings may use part of it. Room updates after every deal. Having space does not guarantee they’ll accept.</p>
            <div className="gm-budget-shortlist"><strong>Most room right now</strong>{teamsWithRoom.slice(0, 4).map(([team, plan]) => <button key={team} type="button" onClick={() => choosePartner(team)} aria-pressed={partner === team}>{ctx.sim.teams[team].name}<small>{budgetRange(plan.room)} room</small></button>)}{!teamsWithRoom.length && <span>No rival has $5M available. Include cash or take salary back to reduce the net cost.</span>}</div>
          </aside>
          <p className="gm-note">Build an offer and hear what the other club thinks. Contenders want MLB-ready help; rebuilding clubs put more weight on the future. Stars with years of control are tough to pry loose. Exact model values stay hidden until your post-simulation review.</p>
          {partner ? (
            <div className="gm-trade">
              {[["You send", yourList, give, setGive], [`${ctx.sim.teams[partner].name} send`, partnerList, get, setGet]].map(([title, list, sel, set]) => {
                const l = list as typeof yourList, s = sel as string[], st = set as (v: string[]) => void;
                return (
                  <div key={title as string} className="gm-side">
                    <h3>{title as string}</h3>
                    <ul className="gm-picked">{s.map((pid) => <li key={pid}><strong>{V[pid]?.n}</strong> <small>{V[pid]?.k === "p" ? "prospect" : V[pid]?.pos}</small> <button type="button" className="gm-link" aria-label={`Remove ${V[pid]?.n} from offer`} onClick={() => { st(s.filter((x) => x !== pid)); setTradeNote(null); }}>remove</button>
                      <span className="gm-contract-line">{contractBrief(contracts[pid])}</span>
                      {contracts[pid]?.seasons.length > 0 && <details className="gm-contract-detail"><summary>Contract / control through {contracts[pid].controlThrough ?? contracts[pid].seasons.at(-1)?.year}</summary><ul>{contracts[pid].seasons.map(year => <li key={year.year}>{year.year}: {money(year.salary)} · {contractType(year.type)}</li>)}</ul><p>Arbitration and pre-arbitration salaries are estimates. Option years are not guaranteed. The budget uses the saved CBT payroll charge, which can differ from annual cash salary.</p></details>}
                    </li>)}{!s.length && <li className="gm-muted">Nobody yet</li>}</ul>
                    <TradePlayerSearch key={`${moves.team}-${partner}-${title}`} label={`Search ${title === "You send" ? "your players" : "their players"}`}
                      query={title === "You send" ? giveQuery : getQuery} onQuery={title === "You send" ? setGiveQuery : setGetQuery}
                      choices={l.filter(x => !s.includes(x.pid)).map(x => ({ pid: x.pid, name: x.v.n, position: x.v.k === "p" ? "prospect" : x.v.pos, contract: contractBrief(contracts[x.pid]), unavailable: x.v.prot === "full" ? "no-trade clause" : league.userAav.has(x.pid) || league.extraAav?.has(x.pid) ? "just signed" : "" }))}
                      onAdd={pid => { st([...s, pid]); setTradeNote(null); }} />
                    <p className="gm-trade-summary">{s.length} {s.length === 1 ? "player" : "players"} in this side of the offer</p>
                  </div>
                );
              })}
              <div className="gm-propose">
                <div className="gm-trade-cash"><label className="gm-field"><span>Cash in this trade</span><select value={cashDirection} onChange={e => { setCashDirection(e.target.value); setTradeNote(null); }}><option value="send">You send cash</option><option value="receive">You receive cash</option></select></label><label className="gm-field"><span>Cash amount ($M)</span><input type="number" min="0" max="100" step="0.1" value={cashAmount} onChange={e => { setCashAmount(e.target.value); setTradeNote(null); }} /></label><p>One-time 2027 payment. Cash sent uses your budget and reduces theirs; cash received does the reverse. This is a game budget adjustment, not a full MLB luxury-tax accounting model.</p></div>
                {tradePayroll && <p className="gm-payroll-preview">If accepted: {tradePayroll.change < 0 ? `clears ${money(-tradePayroll.change)}` : `adds ${money(tradePayroll.change)}`} of your 2027 budget{cash ? ", including cash" : ""}. Your payroll plus net trade cash would be {money(tradePayroll.total)}{tradePayroll.total > budget ? `, still ${money(tradePayroll.total - budget)} over budget` : `, ${money(budget - tradePayroll.total)} under budget`}.</p>}
                <button type="button" onClick={propose} disabled={!give.length && !get.length}>Propose trade</button>
                {tradeNote && <p role="status" className={tradeNote.ok ? "gm-good" : "gm-bad"}>{tradeNote.text}</p>}
              </div>
            </div>
          ) : <p className="gm-muted">Pick a team to see its roster and prospects.</p>}
        </div>
      )}

      {tab === "roster" && (
        <div className="gm-panel gm-roster" role="tabpanel" id="gm-panel-roster" aria-labelledby="gm-tab-roster">
          {POSITIONS.map((pos) => {
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
            <div className="gm-grade"><span>Sandbox grade</span><strong>{results.grade.letter}</strong></div>
            <div>
              <p className="gm-result-kicker">OFFSEASON IN THE BOOKS</p>
              <h2>{teamName}: {Math.round(results.you.p50)}–{162 - Math.round(results.you.p50)} projected</h2>
              <p>In 8 of 10 seasons, between {Math.round(results.you.p10)} and {Math.round(results.you.p90)} wins. Standing pat projects {Math.round(results.base.p50)} wins, so your moves added {signedWins(results.you.mean - results.base.mean)} wins.</p>
            </div>
          </div>
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
          <p className="gm-note">This game score combines projected wins gained with model value at $25M per win. It is not an evaluation of a real front office. “Standing pat” means you make no moves while the other 29 teams still sign free agents. Odds describe this simplified simulation, not a calibrated forecast.</p>
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
          <div className="gm-share">
            <button type="button" onClick={() => showTab("moves")}>Revise your offseason</button>
            <button type="button" onClick={() => copy(shareUrl(), "link")}>Copy link to this offseason</button>
            <button type="button" onClick={() => copy(summaryText(), "summary")}>Copy summary</button>
            {copied && <span role="status">{copied === "failed" ? "Copy failed" : `Copied ${copied}`}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
