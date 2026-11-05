"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import depth from "../../data/depth-chart.json";
import tracker from "../../data/free-agent-tracker.json";
import signingsData from "../../data/free-agent-signings.json";
import simData from "../../data/gm-sim.json";
import payrollData from "../../data/team-payroll.json";
import { allocate, bestAdditions, POSITIONS, PITCHING } from "../../../lib/depth-chart.mjs";
import {
  aiFreeAgency, buildLeague, decodeMoves, encodeMoves, grade, movesValue, payrollFor, respondToTrade, rosterOf,
  signFreeAgent, simulateSeasons, teamModes, teamStrengths,
} from "../../../lib/gm-sim.mjs";
import type { GmContext, GmMoves, GmTeamResult, TrackerRow } from "../../../lib/gm-sim.mjs";

const ctx = { players: depth.players, tracker, signings: signingsData, sim: simData, payroll: payrollData.cbt } as unknown as GmContext;
const teams = Object.entries(ctx.sim.teams).sort((a, b) => a[1].name.localeCompare(b[1].name));
const faRows = new Map((tracker.players as TrackerRow[]).map((r) => [r.id, r]));
const V = ctx.sim.players;
const SIMS = 10000;
const money = (v: number) => `$${Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)}M`;
const signedMoney = (v: number) => `${v >= 0.05 ? "+" : v <= -0.05 ? "−" : ""}${money(Math.abs(v))}`;
const pct = (v: number) => (v >= 0.995 ? ">99%" : v > 0 && v < 0.005 ? "<1%" : `${Math.round(v * 100)}%`);
const signedPts = (v: number) => `${v >= 0.005 ? "+" : v <= -0.005 ? "−" : ""}${Math.abs(Math.round(v * 100))} pts`;
const signedWins = (v: number) => `${v >= 0.05 ? "+" : v <= -0.05 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
const newSeed = () => Math.floor(Math.random() * 1e9) + 1;
const label = (pid: string, i?: string) => `${V[pid]?.n ?? pid}${i?.endsWith("-bat") ? " (hitting)" : i?.endsWith("-pit") ? " (pitching)" : ""}`;

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
  const [partner, setPartner] = useState("");
  const [give, setGive] = useState<string[]>([]);
  const [get, setGet] = useState<string[]>([]);
  const [tradeNote, setTradeNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState("");
  const autoRun = useRef<GmMoves | null>(null);

  const budget = moves.budget ?? Math.round(ctx.sim.teams[moves.team].cbt2026);
  useEffect(() => {
    try {
      const s = new URLSearchParams(window.location.search).get("s");
      const m = s ? decodeMoves(s) : null;
      if (m && ctx.sim.teams[m.team]) { setMoves(m); autoRun.current = m; return; }
    } catch { /* ignore */ }
    setMoves((m) => ({ ...m, seed: newSeed() }));
  }, []);

  const league = useMemo(() => buildLeague(ctx, moves), [moves]);
  const modes = useMemo(() => teamModes(ctx, league.teamOf), [league]);
  const payroll = useMemo(() => payrollFor(ctx, league, moves.team), [league, moves.team]);
  const roster = useMemo(() => rosterOf(ctx, league.teamOf, moves.team), [league, moves.team]);
  const alloc = useMemo(() => allocate(roster), [roster]);
  const ranks = useMemo(() => {
    const totals = teams.map(([t]) => [t, t === moves.team ? alloc.total : allocate(rosterOf(ctx, league.teamOf, t)).total] as const).sort((a, b) => b[1] - a[1]);
    return Object.fromEntries(totals.map(([t, w], i) => [t, { war: w, rank: i + 1 }]));
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
  const faShown = freeAgents.filter((f) => (faPos === "All" || (faPos === "P" ? ["SP", "RP"].includes(f.row.pos) : faPos === "OF" ? ["LF", "CF", "RF"].includes(f.row.pos) : f.row.pos === faPos))
    && (!faQuery.trim() || f.row.name.toLowerCase().includes(faQuery.trim().toLowerCase()))).slice(0, 60);

  const ownedBy = (abbr: string) => Object.entries(V).filter(([pid]) => league.owner.get(pid) === abbr)
    .map(([pid, v]) => ({ pid, v }))
    .sort((a, b) => b.v.v10 - a.v.v10);
  const partnerList = useMemo(() => (partner ? ownedBy(partner) : []), [partner, league]); // eslint-disable-line react-hooks/exhaustive-deps
  const yourList = useMemo(() => ownedBy(moves.team), [moves.team, league]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = (team: string) => {
    setMoves({ team, budget: null, seed: newSeed(), signings: [], trades: [] });
    setOffers({}); setGive([]); setGet([]); setTradeNote(null); setResults(null); setPartner("");
  };
  const update = (m: GmMoves) => { setMoves(m); setResults(null); };

  const offer = (pid: string) => {
    const row = faRows.get(pid)!; const d = offers[pid] ?? { years: String(row.years ?? 1), total: String(row.total ?? 1) };
    const o = { years: Math.round(Number(d.years)), total: Number(d.total) };
    const ans = signFreeAgent(ctx, league, moves, budget, row, o, moves.seed);
    setOffers((x) => ({ ...x, [pid]: { ...d, note: ans.reason, ok: ans.accepted } }));
    if (ans.accepted) update({ ...moves, signings: [...moves.signings, { pid, years: o.years, total: o.total }] });
  };
  const propose = () => {
    const proposal = { partner, give, get };
    const ans = respondToTrade(ctx, league, moves, budget, proposal, modes);
    const net = get.reduce((t, pid) => t + (V[pid]?.v10 ?? 0), 0) - give.reduce((t, pid) => t + (V[pid]?.v10 ?? 0), 0);
    const balance = ans.accepted ? ` By our market values you ${net >= 0 ? "gained" : "gave up"} ${money(Math.abs(net))} of surplus value.` : "";
    setTradeNote({ ok: ans.accepted, text: ans.reason + balance });
    if (ans.accepted) { update({ ...moves, trades: [...moves.trades, proposal] }); setGive([]); setGet([]); }
  };
  const undo = (kind: "signing" | "trade", index: number) => {
    const m = kind === "signing" ? { ...moves, signings: moves.signings.filter((_, i) => i !== index) } : { ...moves, trades: moves.trades.filter((_, i) => i !== index) };
    // Undoing an earlier move can make later trades impossible; keep only trades that still involve players on the right rosters.
    update(m);
  };

  const simulate = (m: GmMoves = moves) => {
    setRunning(true);
    setTimeout(() => {
      const lg = buildLeague(ctx, m);
      const ai = aiFreeAgency(ctx, lg, m, m.seed);
      const st = teamStrengths(ctx, ai.league.teamOf);
      const all = simulateSeasons(ctx, st, SIMS, m.seed);
      const baseMoves = { team: m.team, seed: m.seed, signings: [], trades: [] };
      const bl = buildLeague(ctx, baseMoves);
      const bai = aiFreeAgency(ctx, bl, baseMoves, m.seed);
      const bst = teamStrengths(ctx, bai.league.teamOf);
      const baseAll = simulateSeasons(ctx, bst, SIMS, m.seed);
      const value = movesValue(ctx, m);
      const pay = payrollFor(ctx, ai.league, m.team, ai.league.extraAav);
      setResults({ you: all[m.team], base: baseAll[m.team], all, baseAll, aiSignings: ai.signings, payroll: pay, war: st[m.team].war, baseWar: bst[m.team].war, value, grade: grade(all[m.team].mean - baseAll[m.team].mean, value.total) });
      setRunning(false);
      setTimeout(() => document.getElementById("gm-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }, 30);
  };
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
      ...moves.signings.map((s) => `Signed ${V[s.pid]?.n}: ${s.years} yrs, ${money(s.total)}`),
      ...moves.trades.map((tr) => `Traded ${tr.give.map((p) => V[p]?.n).join(", ") || "nothing"} to ${ctx.sim.teams[tr.partner].name} for ${tr.get.map((p) => V[p]?.n).join(", ") || "nothing"}`)];
    return `${lines.join("\n")}\n${shareUrl()}`;
  };

  const teamName = ctx.sim.teams[moves.team].name;
  const room = budget - payroll;
  const mine = ranks[moves.team];

  return (
    <section className="gm">
      <div className="gm-setup">
        <label className="gm-field"><span>Your team</span>
          <select value={moves.team} onChange={(e) => reset(e.target.value)}>{teams.map(([abbr, t]) => <option key={abbr} value={abbr}>{t.name}</option>)}</select>
        </label>
        <label className="gm-field gm-budget"><span>2027 budget (CBT payroll)</span>
          <input type="range" min={60} max={480} step={1} value={budget} onChange={(e) => update({ ...moves, budget: Number(e.target.value) })} aria-valuetext={money(budget)} />
          <small>{money(budget)} · 2026 payroll was {money(ctx.sim.teams[moves.team].cbt2026)}{moves.budget != null && <> · <button type="button" className="gm-link" onClick={() => update({ ...moves, budget: null })}>reset</button></>}</small>
        </label>
        <div className="gm-stats" aria-live="polite">
          <p><strong>{money(payroll)}</strong><span>2027 payroll</span></p>
          <p className={room < 0 ? "gm-bad" : undefined}><strong>{signedMoney(room).replace("+", "")}</strong><span>{room >= 0 ? "room under budget" : "over budget"}</span></p>
          <p><strong>{mine.war.toFixed(1)}</strong><span>projected WAR</span></p>
          <p><strong>{mine.rank}{["th", "st", "nd", "rd"][mine.rank % 10 > 3 || [11, 12, 13].includes(mine.rank % 100) ? 0 : mine.rank % 10]}</strong><span>in MLB</span></p>
        </div>
      </div>

      <div className="gm-tabs" role="tablist" aria-label="Offseason">
        {([["fa", "Free agents"], ["trade", "Trades"], ["roster", "Your roster"], ["moves", `Your moves (${moves.signings.length + moves.trades.length})`]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "active" : undefined} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "fa" && (
        <div className="gm-panel" role="tabpanel">
          <div className="gm-filters">
            <label className="gm-field"><span>Find a free agent</span><input value={faQuery} onChange={(e) => setFaQuery(e.target.value)} placeholder="Name…" /></label>
            <label className="gm-field"><span>Position</span><select value={faPos} onChange={(e) => setFaPos(e.target.value)}>{["All", "C", "1B", "2B", "3B", "SS", "OF", "DH", "SP", "RP"].map((p) => <option key={p}>{p}</option>)}</select></label>
          </div>
          <p className="gm-note">Each player has a private asking price around our estimate. Offer at least that much in guaranteed money, and close to his expected length, to sign him. Other teams sign whoever is left when you simulate.</p>
          <div className="gm-table-wrap">
            <table className="gm-table">
              <thead><tr><th scope="col">Player</th><th scope="col" className="num">2027 WAR</th><th scope="col" className="num">Adds for you</th><th scope="col" className="num">Our estimate</th><th scope="col">Your offer</th></tr></thead>
              <tbody>
                {faShown.map(({ pid, row, gain, positions }) => {
                  const d = offers[pid] ?? { years: String(row.years ?? 1), total: String(row.total != null && row.aav != null && row.aav >= 1 ? row.total : 0.8) };
                  return (
                    <tr key={pid}>
                      <th scope="row">{row.name}<small>{row.pos} · {row.team ?? "—"} · age {row.age}</small></th>
                      <td className="num">{row.war2027?.toFixed(1) ?? "—"}</td>
                      <td className="num">{gain >= 0.05 ? `+${gain.toFixed(1)}` : "—"}<small>{positions.join(", ")}</small></td>
                      <td className="num">{row.aav != null && row.aav < 1 ? "Minimum" : row.total != null ? <>{money(row.total)}<small>{row.years} yrs</small></> : "—"}</td>
                      <td className="gm-offer">
                        <label><span className="gm-sr">Years for {row.name}</span><input type="number" min={1} max={13} value={d.years} onChange={(e) => setOffers((x) => ({ ...x, [pid]: { ...d, years: e.target.value, note: undefined } }))} /> yrs</label>
                        <label><span className="gm-sr">Guaranteed total for {row.name}, $M</span>$<input type="number" min={0.8} step={0.5} value={d.total} onChange={(e) => setOffers((x) => ({ ...x, [pid]: { ...d, total: e.target.value, note: undefined } }))} />M</label>
                        <button type="button" onClick={() => offer(pid)}>Offer</button>
                        {d.note && <small className={d.ok ? "gm-good" : "gm-bad"}>{d.note}</small>}
                      </td>
                    </tr>
                  );
                })}
                {!faShown.length && <tr><td colSpan={5} className="gm-empty">No free agents match.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "trade" && (
        <div className="gm-panel" role="tabpanel">
          <div className="gm-filters">
            <label className="gm-field"><span>Trade partner</span>
              <select value={partner} onChange={(e) => { setPartner(e.target.value); setGet([]); setTradeNote(null); }}>
                <option value="">Choose a team…</option>
                {teams.filter(([t]) => t !== moves.team).map(([abbr, t]) => <option key={abbr} value={abbr}>{t.name}</option>)}
              </select>
            </label>
            {partner && <p className="gm-note">{ctx.sim.teams[partner].name}: {modes[partner] === "contend" ? "projected contender, values 2027 most" : modes[partner] === "rebuild" ? "projected to miss the playoffs, values the future more" : "in the middle of the pack"}.</p>}
          </div>
          <p className="gm-note">Values are surplus value from our trade model (projected production minus salary). Teams need to come out ahead by their own measure and honor no-trade clauses. Stars with years of club control cost well beyond fair value, even from rebuilding teams; a star with a year or two left on a rebuilding team goes for about fair value. Contenders want MLB-ready help back for a regular, not just prospects.</p>
          {partner ? (
            <div className="gm-trade">
              {[["You send", yourList, give, setGive], [`${ctx.sim.teams[partner].name} send`, partnerList, get, setGet]].map(([title, list, sel, set]) => {
                const l = list as typeof yourList, s = sel as string[], st = set as (v: string[]) => void;
                return (
                  <div key={title as string} className="gm-side">
                    <h3>{title as string}</h3>
                    <ul className="gm-picked">{s.map((pid) => <li key={pid}>{V[pid]?.n} <b>{money(V[pid]?.v10 ?? 0)}</b> <button type="button" className="gm-link" onClick={() => st(s.filter((x) => x !== pid))}>remove</button></li>)}{!s.length && <li className="gm-muted">Nobody yet</li>}</ul>
                    <select value="" onChange={(e) => e.target.value && st([...s, e.target.value])} aria-label={`Add to ${title as string}`}>
                      <option value="">Add a player or prospect…</option>
                      {l.filter((x) => !s.includes(x.pid)).map((x) => <option key={x.pid} value={x.pid}>{x.v.n} · {x.v.k === "p" ? "prospect" : x.v.pos} · {money(x.v.v10)}{x.v.prot === "full" ? " · no-trade" : ""}</option>)}
                    </select>
                  </div>
                );
              })}
              <div className="gm-propose">
                <button type="button" onClick={propose} disabled={!give.length && !get.length}>Propose trade</button>
                {tradeNote && <p className={tradeNote.ok ? "gm-good" : "gm-bad"}>{tradeNote.text}</p>}
              </div>
            </div>
          ) : <p className="gm-muted">Pick a team to see its roster and prospects.</p>}
        </div>
      )}

      {tab === "roster" && (
        <div className="gm-panel gm-roster" role="tabpanel">
          {POSITIONS.map((pos) => {
            const slot = alloc.positions[pos];
            return (
              <div key={pos} className="gm-slot">
                <h3><span>{pos}</span>{slot.war.toFixed(1)} WAR</h3>
                <ul>{slot.rows.map((r) => <li key={r.p.i}>{label(r.p.pid, r.p.i)} <small>{Math.round(r.pt)} {PITCHING.includes(pos) ? "IP" : "PA"} · {r.war.toFixed(1)}</small></li>)}
                  {slot.replacement >= 1 && <li className="gm-muted">Replacement level · {Math.round(slot.replacement)}</li>}</ul>
              </div>
            );
          })}
          <p className="gm-note">Playing time follows the depth chart tool’s rules. Open the <a href="/tools/depth-chart">depth chart</a> to experiment with roles.</p>
        </div>
      )}

      {tab === "moves" && (
        <div className="gm-panel" role="tabpanel">
          {!moves.signings.length && !moves.trades.length && <p className="gm-muted">No moves yet.</p>}
          <ul className="gm-moves">
            {moves.signings.map((s, i) => <li key={`s${i}`}>Signed <strong>{V[s.pid]?.n}</strong>, {s.years} yrs, {money(s.total)} ({money(s.total / s.years)} a year) <button type="button" className="gm-link" onClick={() => undo("signing", i)}>undo</button></li>)}
            {moves.trades.map((t, i) => <li key={`t${i}`}>Traded {t.give.map((p) => V[p]?.n).join(", ") || "nothing"} to {ctx.sim.teams[t.partner].name} for <strong>{t.get.map((p) => V[p]?.n).join(", ") || "nothing"}</strong> <button type="button" className="gm-link" onClick={() => undo("trade", i)}>undo</button></li>)}
          </ul>
        </div>
      )}

      <div className="gm-run">
        <button type="button" className="gm-sim" onClick={() => simulate()} disabled={running}>{running ? "Simulating 10,000 seasons…" : results ? "Simulate again" : "Finish offseason and simulate 2027"}</button>
        <small>The other 29 teams sign the remaining free agents, then the season is played 10,000 times.</small>
      </div>

      {results && (
        <div className="gm-results" id="gm-results" aria-live="polite">
          <div className="gm-headline">
            <div className="gm-grade"><span>Offseason grade</span><strong>{results.grade.letter}</strong></div>
            <div>
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
            <p><strong>{signedMoney(results.value.total)}</strong><span>future value of your moves: trades {signedMoney(results.value.trades)}, contracts vs our estimates {signedMoney(results.value.signings)}</span></p>
            <p><strong>{results.war.toFixed(1)}</strong><span>projected WAR ({signedWins(results.war - results.baseWar)} vs standing pat)</span></p>
          </div>
          <p className="gm-note">The grade weighs 2027 wins added against the future value you gave up or gained, at about $25M of future value per win.</p>
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
              {results.aiSignings.length > 10 && <small className="gm-muted">and {results.aiSignings.length - 10} more signings</small>}
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
