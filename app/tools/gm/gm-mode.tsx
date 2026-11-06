"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import depth from "../../data/depth-chart.json";
import tracker from "../../data/free-agent-tracker.json";
import signingsData from "../../data/free-agent-signings.json";
import simData from "../../data/gm-sim.json";
import payrollData from "../../data/team-payroll.json";
import { allocate, bestAdditions, POSITIONS, PITCHING } from "../../../lib/depth-chart.mjs";
import { matchesProjectionRole } from "../../../lib/projection-filters.mjs";
import { advanceMarket, marketBoard, MARKET_ROUNDS, newMarket, submitMarketBid } from "../../../lib/gm-market.mjs";
import {
  aiFreeAgency, buildLeague, decodeMoves, encodeMoves, grade, movesValue, payrollFor, respondToTrade, rosterOf,
  signFreeAgent, simulateSeasons, teamModes, teamStrengths, restoreMoves, undoMove, seasonReadiness,
} from "../../../lib/gm-sim.mjs";
import type { GmContext, GmMoves, GmTeamResult, TrackerRow } from "../../../lib/gm-sim.mjs";

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
const newSeed = () => Math.floor(Math.random() * 1e9) + 1;
const label = (pid: string, i?: string) => `${V[pid]?.n ?? faRows.get(pid)?.name ?? ctx.players.find(p => p.pid === pid)?.n ?? pid}${i?.endsWith("-bat") ? " (hitting)" : i?.endsWith("-pit") ? " (pitching)" : ""}`;
const defaultOffer = (row: TrackerRow) => ({ years: String(row.years ?? 1), total: String(row.total != null && row.aav != null && row.aav >= 1 ? row.total : 0.8) });
const TABS = ["fa", "trade", "roster", "moves"] as const;

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
      const s = new URLSearchParams(window.location.search).get("s");
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
    .sort((a, b) => b.v.v10 - a.v.v10);
  const partnerList = useMemo(() => (partner ? ownedBy(partner) : []), [partner, league]); // eslint-disable-line react-hooks/exhaustive-deps
  const yourList = useMemo(() => ownedBy(moves.team), [moves.team, league]); // eslint-disable-line react-hooks/exhaustive-deps
  const tradePayroll = useMemo(() => {
    if (!partner || (!give.length && !get.length)) return null;
    const after = buildLeague(ctx, { ...moves, trades: [...moves.trades, { partner, give, get }] });
    const total = payrollFor(ctx, after, moves.team);
    return { total, change: total - payroll };
  }, [partner, give, get, moves, payroll]);

  const reset = (team: string, competitiveMode = competitive) => {
    runVersion.current++;
    setMoves({ team, budget: null, seed: newSeed(), signings: [], trades: [], ...(competitiveMode ? { market: newMarket() } : {}) });
    setOffers({}); setGive([]); setGet([]); setTradeNote(null); setResults(null); setPartner("");
    setFaQuery(""); setFaPos("All"); setFaLimit(20); setGiveQuery(""); setGetQuery(""); setRunning(false);
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
      const nextLeague = buildLeague(ctx, next);
      const gain = allocate(rosterOf(ctx, nextLeague.teamOf, moves.team)).total - alloc.total;
      update(next);
      const roomAfter = budget - payrollFor(ctx, nextLeague, moves.team);
      setFeedback({ tone: "success", text: `Signed ${row.name}: ${o.years} ${o.years === 1 ? "year" : "years"}, ${money(o.total)} total (${money(o.total / o.years)} a year). ${signedWins(gain)} projected roster WAR. ${roomAfter < 0 ? `Clear ${money(-roomAfter)} before simulating the season.` : `${money(roomAfter)} left under budget.`}` });
    }
  };
  const propose = () => {
    const proposal = { partner, give, get };
    const ans = respondToTrade(ctx, league, moves, budget, proposal, modes);
    const net = get.reduce((t, pid) => t + (V[pid]?.v10 ?? 0), 0) - give.reduce((t, pid) => t + (V[pid]?.v10 ?? 0), 0);
    const balance = ans.accepted ? ` By our market values you ${net >= 0 ? "gained" : "gave up"} ${money(Math.abs(net))} of surplus value.` : "";
    const detail = !ans.accepted && ans.need != null && ans.received != null ? ` Their valuation of your offer: ${money(ans.received)}; asking value including premiums: ${money(ans.need)}.` : "";
    setTradeNote({ ok: ans.accepted, text: ans.reason + balance + detail });
    if (ans.accepted) { update({ ...moves, trades: [...moves.trades, proposal] }); setGive([]); setGet([]); setFeedback({ tone: "success", text: `Trade completed with ${ctx.sim.teams[partner].name}. You acquired ${get.map(pid => V[pid]?.n).join(", ") || "salary relief"}.${balance}` }); }
  };
  const withdrawBid = (pid: string) => {
    update({ ...moves, market: { ...moves.market!, bids: moves.market!.bids.filter(x => x.pid !== pid) } });
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
    try { const u = new URL(window.location.href); u.search = ""; u.searchParams.set("s", encodeMoves({ ...moves, budget })); return u.toString(); } catch { return ""; }
  };
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 2000); } catch { setCopied("failed"); } };
  const summaryText = () => {
    if (!results) return "";
    const t = ctx.sim.teams[moves.team].name, r = results;
    const lines = [`My ${t} offseason on Dugout Value GM mode: grade ${r.grade.letter}.`,
      `Projected ${Math.round(r.you.p50)} wins (${Math.round(r.you.p10)}–${Math.round(r.you.p90)}), ${signedWins(r.you.mean - r.base.mean)} vs standing pat.`,
      `Playoffs ${pct(r.you.playoffs)} (${signedPts(r.you.playoffs - r.base.playoffs)}), World Series ${pct(r.you.title)}.`,
      ...moves.signings.map((s) => `Signed ${label(s.pid)}: ${s.years} yrs, ${money(s.total)}`),
      ...moves.trades.map((tr) => `Traded ${tr.give.map((p) => V[p]?.n).join(", ") || "nothing"} to ${ctx.sim.teams[tr.partner].name} for ${tr.get.map((p) => V[p]?.n).join(", ") || "nothing"}`)];
    return `${lines.join("\n")}\n${shareUrl()}`;
  };

  const teamName = ctx.sim.teams[moves.team].name;
  const room = budget - payroll;
  const mine = ranks[moves.team];
  const showTab = (next: typeof tab) => {
    setTab(next);
    document.getElementById(`gm-tab-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
        <div className="gm-field gm-budget"><span>2027 budget (luxury-tax payroll)</span>
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
          <p><strong>{money(payroll)}</strong><span>2027 payroll</span></p>
          <p className={room < 0 ? "gm-bad" : undefined}><strong>{money(Math.abs(room))}</strong><span>{room >= 0 ? "room under budget" : "over budget"}</span></p>
          <p><strong>{mine.war.toFixed(1)}</strong><span>projected WAR</span></p>
          <p><strong>{mine.rank}{["th", "st", "nd", "rd"][mine.rank % 10 > 3 || [11, 12, 13].includes(mine.rank % 100) ? 0 : mine.rank % 10]}</strong><span>in MLB</span></p>
        </div>
      </div>
      <div className="gm-tools"><span>Changing teams starts a new offseason. This is a sandbox, not live transactions.</span><button type="button" className="gm-link" onClick={() => reset(moves.team)}>Start over</button><button type="button" className="gm-link" onClick={() => copy(shareUrl(), "link")}>Copy offseason link</button>{copied && <span role="status">{copied === "failed" ? "Couldn’t copy. Try again." : `Copied ${copied}`}</span>}</div>
      <div className="gm-brief"><div><strong>Where could you improve?</strong><p>Your lowest-ranked positions in the current league, by projected WAR.</p></div><div className="gm-needs">{needs.map(need => <button key={need.pos} type="button" onClick={() => { setTab("fa"); setFaPos(need.pos); setFaQuery(""); setFaLimit(20); }}><strong>{need.pos}</strong><span>No. {need.rank} of 30 · {need.war.toFixed(1)} WAR</span></button>)}</div></div>
      {feedback && <p className="gm-feedback" data-tone={feedback.tone} role="status">{feedback.text}</p>}
      {readiness.shortfall > 1e-9 && <aside className="gm-budget-plan" id="gm-budget-plan">
        <div><strong>Before Opening Day: clear {money(readiness.shortfall)}</strong><p>Your signed roster is over budget. {bidding ? "You can keep negotiating and advancing rounds. " : ""}Make a salary-clearing trade or undo moves before simulating the season.</p></div>
        <div className="gm-budget-actions"><button type="button" onClick={() => showTab("trade")}>Find a salary-clearing trade</button><button type="button" onClick={() => showTab("moves")}>Review / undo moves</button></div>
      </aside>}
      {competitive && <section className="gm-market-desk" id="gm-market" aria-label="Free-agent market">
        <div className="gm-scorecard"><div className="gm-scorecard-club"><span className="gm-homeplate" aria-hidden="true">{moves.team}</span><span>OFFSEASON SCORECARD<small>{teamName}</small></span></div><dl><div><dt>Signed</dt><dd>{moves.signings.length}</dd></div><div><dt>Trades</dt><dd>{moves.trades.length}</dd></div><div><dt>WAR added</dt><dd>{signedWins(alloc.total - startingWar)}</dd></div></dl></div>
        <ol className="gm-round-track" aria-label="Market progress">{["Opening offers", "Counteroffers", "Final calls"].map((phase, index) => <li key={phase} data-state={moves.market!.round > index ? "complete" : moves.market!.round === index ? "current" : "next"} aria-current={moves.market!.round === index ? "step" : undefined}><span aria-hidden="true">{moves.market!.round > index ? "✓" : index + 1}</span><span>{phase}<small>{moves.market!.round > index ? "Complete" : moves.market!.round === index ? "Now bidding" : "Up next"}</small></span></li>)}</ol>
        <div className="gm-market-heading"><div><h2>{bidding ? `Bidding round ${moves.market!.round + 1} of ${MARKET_ROUNDS}` : "The bidding rounds are complete"}</h2><p>{bidding ? "Submit offers below, then advance when you’re ready. Some players will sign elsewhere." : "Finish shaping your roster. Trade, undo moves, or sign remaining free agents before simulating."}</p></div>{bidding && <button type="button" className="gm-sim" onClick={nextRound}>{running ? "Clubs are deciding…" : `Advance to round ${moves.market!.round + 1} results`}</button>}</div>
        <p className="gm-note">{money(reserved)} of annual payroll in {moves.market!.bids.length} pending {moves.market!.bids.length === 1 ? "offer" : "offers"}. {reserved > room ? reserved > 0 ? `If all pending offers land, clear ${money(reserved - room)} before simulating. You can still advance.` : `Clear ${money(-room)} from the signed roster before simulating.` : `${money(room - reserved)} available after pending offers.`} These are simulated negotiations, not news reports.</p>
        {moves.market!.bids.length > 0 && <ul className="gm-market-bids">{moves.market!.bids.map(b => <li key={b.pid}><span><strong>{label(b.pid)}</strong> · {b.years} yrs, {money(b.total)} · {money(b.total / b.years)}/year</span><button type="button" className="gm-link" onClick={() => withdrawBid(b.pid)}>Withdraw<span className="gm-sr"> offer to {label(b.pid)}</span></button></li>)}</ul>}
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
          <div className="gm-list-summary"><span>{faFiltered.length} free agents match · showing {faShown.length}</span>{bidding && <a href="#gm-market">Review bids and advance</a>}{(faQuery || faPos !== "All") && <button type="button" className="gm-link" onClick={() => { setFaQuery(""); setFaPos("All"); setFaLimit(20); }}>Clear filters</button>}</div>
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
                      <td className="num" role="cell" data-label="Our estimate">{row.aav != null && row.aav < 1 ? "Minimum" : row.total != null ? <>{money(row.total)}<small>{row.years} yrs · {money(row.total / (row.years ?? 1))}/yr</small></> : "—"}</td>
                      <td className="gm-offer" role="cell" data-label="Your offer">
                        <label><span className="gm-sr">Years for {row.name}</span><input type="number" min={1} max={13} value={d.years} onChange={(e) => setOffers((x) => ({ ...x, [pid]: { ...d, years: e.target.value, note: undefined } }))} /> yrs</label>
                        <label><span className="gm-sr">Guaranteed total for {row.name}, $M</span>$<input type="number" min={0.8} step={0.5} value={d.total} onChange={(e) => setOffers((x) => ({ ...x, [pid]: { ...d, total: e.target.value, note: undefined } }))} />M</label>
                        <button type="button" aria-label={`${bidding ? "Submit bid for" : "Offer contract to"} ${row.name}`} onClick={() => offer(pid)}>{bidding ? pending ? "Update bid" : "Submit bid" : "Offer"}</button>
                        {pending && (Number(d.years) !== pending.years || Number(d.total) !== pending.total) && <small className="gm-draft-note">Draft changes not submitted. Your current bid is {pending.years} yrs, {money(pending.total)}.</small>}
                        <small className="gm-offer-cost">{Number(d.years) > 0 && Number(d.total) > 0 ? `${money(Number(d.total) / Number(d.years))}/year · ${money(Math.abs(offerRoom - Number(d.total) / Number(d.years)))} ${offerRoom >= Number(d.total) / Number(d.years) ? "room left" : "over budget"}${bidding ? " after pending offers" : ""}` : "Enter years and total $M"}</small>
                        {d.note && <small role="status" className={d.ok ? "gm-good" : "gm-bad"}>{d.note}</small>}
                      </td>
                    </tr>
                  );
                })}
                {!faShown.length && <tr><td colSpan={5} className="gm-empty">No free agents match.</td></tr>}
              </tbody>
            </table>
          </div>
          {faShown.length < faFiltered.length && <div className="gm-list-summary"><button type="button" onClick={() => setFaLimit(limit => limit + 20)}>Show {Math.min(20, faFiltered.length - faShown.length)} more free agents</button></div>}
        </div>
      )}

      {tab === "trade" && (
        <div className="gm-panel" role="tabpanel" id="gm-panel-trade" aria-labelledby="gm-tab-trade">
          <div className="gm-filters">
            <label className="gm-field"><span>Trade partner</span>
              <select value={partner} onChange={(e) => { setPartner(e.target.value); setGet([]); setTradeNote(null); }}>
                <option value="">Choose a team…</option>
                {teams.filter(([t]) => t !== moves.team).map(([abbr, t]) => <option key={abbr} value={abbr}>{t.name}</option>)}
              </select>
            </label>
            {partner && <p className="gm-note">{ctx.sim.teams[partner].name}: {modes[partner] === "contend" ? "top 10 in current roster WAR; prioritizes 2027" : modes[partner] === "rebuild" ? "bottom 10 in current roster WAR; prioritizes control years" : "middle third in current roster WAR"}.</p>}
          </div>
          <p className="gm-note">Values are surplus value from our trade model (projected production minus salary). Teams need to come out ahead by their own measure and honor no-trade clauses. Stars with years of club control cost well beyond fair value, even from rebuilding teams; a star with a year or two left on a rebuilding team goes for about fair value. Contenders want MLB-ready help back for a regular, not just prospects.</p>
          {partner ? (
            <div className="gm-trade">
              {[["You send", yourList, give, setGive], [`${ctx.sim.teams[partner].name} send`, partnerList, get, setGet]].map(([title, list, sel, set]) => {
                const l = list as typeof yourList, s = sel as string[], st = set as (v: string[]) => void;
                return (
                  <div key={title as string} className="gm-side">
                    <h3>{title as string}</h3>
                    <ul className="gm-picked">{s.map((pid) => <li key={pid}>{V[pid]?.n} <b>{money(V[pid]?.v10 ?? 0)}</b> <button type="button" className="gm-link" aria-label={`Remove ${V[pid]?.n} from offer`} onClick={() => { st(s.filter((x) => x !== pid)); setTradeNote(null); }}>remove</button></li>)}{!s.length && <li className="gm-muted">Nobody yet</li>}</ul>
                    <label className="gm-field"><span>Search {title === "You send" ? "your players" : "their players"}</span><input value={title === "You send" ? giveQuery : getQuery} onChange={e => title === "You send" ? setGiveQuery(e.target.value) : setGetQuery(e.target.value)} placeholder="Player or prospect name…" /></label>
                    <select value="" onChange={(e) => { if (e.target.value) { st([...s, e.target.value]); setTradeNote(null); } }} aria-label={`Add to ${title as string}`}>
                      <option value="">Add a player or prospect…</option>
                      {l.filter((x) => !s.includes(x.pid) && x.v.n.toLowerCase().includes((title === "You send" ? giveQuery : getQuery).trim().toLowerCase())).map((x) => <option key={x.pid} value={x.pid} disabled={x.v.prot === "full" || league.userAav.has(x.pid) || league.extraAav?.has(x.pid)}>{x.v.n} · {x.v.k === "p" ? "prospect" : x.v.pos} · {money(x.v.v10)}{x.v.prot === "full" ? " · no-trade" : league.userAav.has(x.pid) || league.extraAav?.has(x.pid) ? " · just signed" : ""}</option>)}
                    </select>
                    <p className="gm-trade-summary">{s.length} players · {signedMoney(s.reduce((sum, pid) => sum + (V[pid]?.v10 ?? 0), 0))} market surplus</p>
                  </div>
                );
              })}
              <div className="gm-propose">
                {tradePayroll && <p className="gm-payroll-preview">If accepted: {tradePayroll.change < 0 ? `clears ${money(-tradePayroll.change)}` : `adds ${money(tradePayroll.change)}`} of annual payroll. Your payroll would be {money(tradePayroll.total)}{tradePayroll.total > budget ? `, still ${money(tradePayroll.total - budget)} over budget` : `, ${money(budget - tradePayroll.total)} under budget`}.</p>}
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
            {moves.signings.map((s, i) => <li key={`s${i}`}>Signed <strong>{label(s.pid)}</strong>, {s.years} yrs, {money(s.total)} ({money(s.total / s.years)} a year) <button type="button" className="gm-link" aria-label={`Undo signing ${label(s.pid)}`} onClick={() => undo("signing", i)}>undo</button></li>)}
            {moves.trades.map((t, i) => <li key={`t${i}`}>Traded {t.give.map((p) => V[p]?.n).join(", ") || "nothing"} to {ctx.sim.teams[t.partner].name} for <strong>{t.get.map((p) => V[p]?.n).join(", ") || "nothing"}</strong> <button type="button" className="gm-link" onClick={() => undo("trade", i)}>undo</button></li>)}
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
                  <td className="num">{k === "mean" ? signedWins(results.you.mean - results.base.mean) : signedPts(results.you[k] - results.base[k])}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="gm-ledger">
            <p><strong>{money(results.payroll)}</strong><span>2027 payroll, {results.payroll > budget ? `${money(results.payroll - budget)} over` : `${money(budget - results.payroll)} under`} budget</span></p>
            <p><strong>{signedMoney(results.value.total)}</strong><span>net model value: trades {signedMoney(results.value.trades)}, contracts vs our estimates {signedMoney(results.value.signings)}</span></p>
            <p><strong>{results.war.toFixed(1)}</strong><span>projected WAR ({signedWins(results.war - results.baseWar)} vs standing pat)</span></p>
          </div>
          <p className="gm-note">This game score combines projected wins gained with model value at $25M per win. It is not an evaluation of a real front office. “Standing pat” means you make no moves while the other 29 teams still sign free agents. Odds describe this simplified simulation, not a calibrated forecast.</p>
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
              <ul className="gm-ai">{results.aiSignings.slice(0, 10).map((s) => <li key={s.pid}><strong>{s.name}</strong> to {ctx.sim.teams[s.team].name}, {s.years} yrs, {money(s.total)}</li>)}</ul>
              {results.aiSignings.length > 10 && <details><summary>{results.aiSignings.length - 10} more simulated signings</summary><ul className="gm-ai">{results.aiSignings.slice(10).map(s => <li key={s.pid}><strong>{s.name}</strong> to {ctx.sim.teams[s.team].name}, {s.years} yrs, {money(s.total)}</li>)}</ul></details>}
            </div>
          </div>
          <div className="gm-share">
            <button type="button" onClick={() => copy(shareUrl(), "link")}>Copy link to this offseason</button>
            <button type="button" onClick={() => copy(summaryText(), "summary")}>Copy summary</button>
            {copied && <span role="status">{copied === "failed" ? "Copy failed" : `Copied ${copied}`}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
