"use client";
import { useEffect, useMemo, useState } from "react";
import data from "../../data/depth-chart.json";
import tracker from "../../data/free-agent-tracker.json";
import signingsData from "../../data/free-agent-signings.json";
import payrollData from "../../data/team-payroll.json";
import { allocate, bestAdditions, teamsFor, payrollAdjustment, payrollChange, POSITIONS, PITCHING } from "../../../lib/depth-chart.mjs";
import type { DepthEdit as Edit } from "../../../lib/depth-chart.mjs";

type Entry = { i: string; pid: string; n: string; t: string | null; e: string[]; k: "b" | "p"; r: number; x: number; s: string; fa?: number; pay?: number; c?: "g" | "o" | "a" | "p"; ex?: number };

const players = data.players as Entry[];
const teams = data.teams as { abbr: string; name: string }[];
const { team: teamOf, freeAgents } = teamsFor(players, tracker, signingsData.entries as { player: string; outcome: string; team?: string | null }[]);
const faRows = new Map((tracker.players as { id: string; aav?: number | null; years?: number | null; total?: number | null; basis: string }[]).map((r) => [r.id, r]));
const rosterOf = (abbr: string) => players.filter((p) => teamOf.get(p.i) === abbr);
const signedAav = new Map((signingsData.entries as { player: string; outcome: string; years?: number | null; total_musd?: number | null }[])
  .filter((s) => s.years && s.total_musd != null).map((s) => [s.player.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/gi, "").toLowerCase(), s.total_musd! / s.years!]));
const faSalary = (p: Entry) => signedAav.get(p.n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/gi, "").toLowerCase()) ?? faRows.get(p.pid)?.aav ?? null;
const cbt = payrollData.cbt;
const cbtTeams = cbt.teams as Record<string, { cbt2026: number; cbt2027: number; guaranteedAav2027: number; arb2027: number }>;
const nameKey = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/gi, "").toLowerCase();
const outcomes = new Map((signingsData.entries as { player: string; outcome: string }[]).map((s) => [nameKey(s.player), s.outcome]));
const signedIds = new Set(players.filter((p) => p.fa && ["signed", "re-signed", "extension", "qo-accepted", "option-exercised", "opted-in"].includes(outcomes.get(nameKey(p.n)) ?? "")).map((p) => p.i));
const money = (v: number) => `$${v.toFixed(1)}M`;
const moneyDelta = (v: number) => `${v >= 0.05 ? "+" : v <= -0.05 ? "−" : ""}$${Math.abs(v).toFixed(1)}M`;
const defaults = new Map(teams.map((t) => [t.abbr, allocate(rosterOf(t.abbr)).total]));
const freeAgentPool = players.filter((p) => freeAgents.has(p.i));
const label = (p: Entry) => p.i.endsWith("-bat") ? `${p.n} (hitting)` : p.i.endsWith("-pit") ? `${p.n} (pitching)` : p.n;
const unitName = (pos: string) => (PITCHING.includes(pos) ? "IP" : "PA");
const fmt = (v: number, d = 1) => (Math.abs(v) < 0.05 && d === 1 ? "0.0" : v.toFixed(d));
const signed = (v: number) => `${v >= 0.05 ? "+" : v <= -0.05 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const aavText = (p: Entry) => {
  const r = faRows.get(p.pid);
  if (!r || r.aav == null) return null;
  return r.aav < 1 ? "minimum deal" : `est. $${r.aav.toFixed(1)}M a year`;
};
const POS_NAMES: Record<string, string> = { C: "Catcher", "1B": "First base", "2B": "Second base", "3B": "Third base", SS: "Shortstop", LF: "Left field", CF: "Center field", RF: "Right field", DH: "Designated hitter", SP: "Starting pitchers", RP: "Relief pitchers" };

export function DepthChart() {
  const [team, setTeam] = useState("NYY");
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("team")?.toUpperCase();
      if (t && teams.some((x) => x.abbr === t)) setTeam(t);
    } catch { /* ignore */ }
  }, []);
  const chooseTeam = (abbr: string) => {
    setTeam(abbr); setEdits({}); setRemoved([]); setAdded([]); setQuery("");
    try { const u = new URL(window.location.href); u.searchParams.set("team", abbr); window.history.replaceState(null, "", u); } catch { /* ignore */ }
  };
  const reset = () => { setEdits({}); setRemoved([]); setAdded([]); };

  const roster = useMemo(() => {
    const base = rosterOf(team).filter((p) => !removed.includes(p.i));
    const extra = players.filter((p) => added.includes(p.i) && !removed.includes(p.i) && !base.some((b) => b.i === p.i));
    return [...base, ...extra];
  }, [team, removed, added]);
  const result = useMemo(() => allocate(roster, edits), [roster, edits]);
  const suggestions = useMemo(() => {
    const onRoster = new Set(roster.map((p) => p.i));
    return bestAdditions(roster, edits, freeAgentPool.filter((p) => !onRoster.has(p.i)));
  }, [roster, edits]);
  const table = useMemo(() => teams.map((t) => ({ ...t, war: t.abbr === team ? result.total : defaults.get(t.abbr)! })).sort((a, b) => b.war - a.war), [team, result.total]);
  const rank = table.findIndex((t) => t.abbr === team) + 1;
  const base = defaults.get(team)!;
  const baseRank = [...defaults.values()].filter((v) => v > base).length + 1;
  const teamName = teams.find((t) => t.abbr === team)?.name ?? team;
  const changed = Object.keys(edits).length + removed.length + added.length > 0;
  const pay = cbtTeams[team];
  const adjustment = useMemo(() => payrollAdjustment(players, team, teamOf, signedIds, faSalary), [team]);
  const base2027 = pay ? pay.cbt2027 + adjustment : null;
  const payChange = useMemo(() => payrollChange(rosterOf(team), roster, freeAgents, faSalary), [team, roster]);

  const setPt = (p: Entry, pos: string, value: string) => {
    const v = Math.max(0, Math.round(Number(value)));
    if (!Number.isFinite(v)) return;
    setEdits((e) => ({ ...e, [p.i]: { pos, pt: v } }));
  };
  const unlock = (p: Entry) => setEdits((e) => { const n = { ...e }; delete n[p.i]; return n; });
  const move = (p: Entry, to: string) => {
    if (to === "remove") { setRemoved((r) => [...r, p.i]); unlock(p); return; }
    setEdits((e) => ({ ...e, [p.i]: { ...(e[p.i] ?? {}), pos: to } }));
  };
  const add = (p: Entry) => { setRemoved((r) => r.filter((x) => x !== p.i)); setAdded((a) => (a.includes(p.i) ? a : [...a, p.i])); setQuery(""); };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const onRoster = new Set(roster.map((p) => p.i));
    return players.filter((p) => !onRoster.has(p.i) && p.n.toLowerCase().includes(q)).slice(0, 8);
  }, [query, roster]);
  const removedEntries = players.filter((p) => removed.includes(p.i));

  return (
    <section className="dc">
      <div className="dc-top">
        <label className="dc-team">
          <span>Team</span>
          <select value={team} onChange={(e) => chooseTeam(e.target.value)}>
            {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => <option key={t.abbr} value={t.abbr}>{t.name}</option>)}
          </select>
        </label>
        <div className="dc-score" aria-live="polite">
          <p><strong>{fmt(result.total)}</strong><span>projected 2027 WAR</span></p>
          <p><strong>{ordinal(rank)}</strong><span>of 30 teams</span></p>
          <p><strong>{fmt(result.hit)}</strong><span>hitters</span></p>
          <p><strong>{fmt(result.pit)}</strong><span>pitchers</span></p>
          {changed && <p className="dc-change"><strong>{signed(result.total - base)}</strong><span>vs default ({ordinal(baseRank)})</span></p>}
        </div>
        <button type="button" className="dc-reset" onClick={reset} disabled={!changed}>Reset</button>
      </div>
      <div className="dc-payroll" aria-live="polite">
        <p><span>2026 CBT payroll</span><strong>{pay ? money(pay.cbt2026) : "—"}</strong><small>{pay ? `${money(Math.abs(pay.cbt2026 - cbt.thresholdMusd2026))} ${pay.cbt2026 > cbt.thresholdMusd2026 ? "over" : "under"} the $${cbt.thresholdMusd2026}M threshold` : ""}</small></p>
        <p><span>2027 CBT payroll so far</span><strong>{base2027 != null ? money(base2027) : "—"}</strong><small>{pay ? `${money(pay.guaranteedAav2027)} in guaranteed contracts and ${money(pay.arb2027)} projected for arbitration${Math.abs(adjustment) >= 0.05 ? `, ${moneyDelta(adjustment)} for signings and departures` : ""}` : ""}</small></p>
        <p className={changed ? "dc-change" : undefined}><span>Your changes</span><strong>{changed ? moneyDelta(payChange) : "—"}</strong><small>{changed && base2027 != null ? `2027 CBT payroll ${money(base2027 + payChange)}` : "Add or remove players to see the effect on 2027"}</small></p>
      </div>

      <div className="dc-layout">
        <div className="dc-main">
          <div className="dc-add">
            <label>
              <span>Add a player</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Any MLB player or free agent…" />
            </label>
            {matches.length > 0 && (
              <ul className="dc-matches">
                {matches.map((p) => (
                  <li key={p.i}>
                    <button type="button" onClick={() => add(p)}>
                      <strong>{label(p)}</strong> <span>{p.e.join("/")} · {freeAgents.has(p.i) ? "free agent" : teamOf.get(p.i) ?? "—"} · {fmt(p.r * p.x / (p.k === "p" ? 180 : 600))} WAR</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="dc-grid">
            {POSITIONS.map((pos) => {
              const slot = result.positions[pos];
              const best = suggestions.find((s) => s.positions.includes(pos));
              return (
                <article key={pos} className="dc-card" aria-labelledby={`dc-${pos}`}>
                  <header>
                    <h3 id={`dc-${pos}`}><span className="dc-pos">{pos}</span> {POS_NAMES[pos]}</h3>
                    <p><strong>{fmt(slot.war)} WAR</strong> · {Math.round(slot.filled)} / {slot.target} {unitName(pos)}</p>
                  </header>
                  <table>
                    <thead><tr><th scope="col">Player</th><th scope="col" className="num">{unitName(pos)}</th><th scope="col" className="num">WAR</th><th scope="col"><span className="dc-sr">Move</span></th></tr></thead>
                    <tbody>
                      {slot.rows.map((row) => {
                        const locked = edits[row.p.i]?.pt != null;
                        return (
                          <tr key={row.p.i}>
                            <th scope="row">{label(row.p)}{added.includes(row.p.i) && <span className="dc-tag">added</span>}{row.p.s !== "dv" && <span className="dc-tag" title={row.p.s === "npb" ? "NPB translation" : "No DV projection; ZiPS rate at part-time playing time"}>{row.p.s === "npb" ? "NPB" : "ZiPS"}</span>}</th>
                            <td className="num">
                              <input type="number" min={0} step={PITCHING.includes(pos) ? 5 : 10} aria-label={`${label(row.p)} ${unitName(pos)} at ${pos}`} value={Math.round(row.pt)} onChange={(e) => setPt(row.p, pos, e.target.value)} className={locked ? "dc-locked" : undefined} />
                              {locked && <button type="button" className="dc-unlock" onClick={() => unlock(row.p)} aria-label={`Return ${label(row.p)} to automatic playing time`} title="Return to automatic playing time">×</button>}
                            </td>
                            <td className="num">{fmt(row.war)}</td>
                            <td>
                              <select aria-label={`Move ${label(row.p)}`} value="" onChange={(e) => move(row.p, e.target.value)}>
                                <option value="" disabled>Move…</option>
                                {POSITIONS.filter((x) => x !== pos && (PITCHING.includes(x) === (row.p.k === "p"))).map((x) => <option key={x} value={x}>{x}</option>)}
                                <option value="remove">Remove</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                      {slot.replacement >= 1 && <tr className="dc-repl"><th scope="row">Replacement level</th><td className="num">{Math.round(slot.replacement)}</td><td className="num">0.0</td><td /></tr>}
                    </tbody>
                  </table>
                  {slot.over >= 1 && <p className="dc-warn">{Math.round(slot.over)} {unitName(pos)} over a full season. Lower someone’s playing time.</p>}
                  {best && (
                    <p className="dc-fa">
                      <span>Best free-agent fit</span>
                      <strong>{label(best.p)}</strong> {signed(best.gain)} WAR{aavText(best.p) ? ` · ${aavText(best.p)}` : ""}
                      <button type="button" onClick={() => add(best.p)}>Add</button>
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          {(result.unused.length > 0 || removedEntries.length > 0) && (
            <div className="dc-extra">
              {result.unused.length > 0 && (
                <div>
                  <p><strong>No projected playing time.</strong> Their positions are full with better projections. Place one to give him time.</p>
                  <ul className="dc-bench">
                    {result.unused.map((p) => (
                      <li key={p.i}>{label(p)} <span>{p.e.join("/")}</span>
                        <select aria-label={`Place ${label(p)}`} value="" onChange={(e) => move(p, e.target.value)}>
                          <option value="" disabled>Place at…</option>
                          {POSITIONS.filter((x) => PITCHING.includes(x) === (p.k === "p")).map((x) => <option key={x} value={x}>{x}</option>)}
                          <option value="remove">Remove</option>
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {removedEntries.length > 0 && (
                <p><strong>Removed:</strong> {removedEntries.map((p, i) => <span key={p.i}>{i > 0 && ", "}{label(p)} <button type="button" className="dc-link" onClick={() => setRemoved((r) => r.filter((x) => x !== p.i))}>restore</button></span>)}</p>
              )}
            </div>
          )}
        </div>

        <aside className="dc-side">
          <section aria-labelledby="dc-fa-heading">
            <h2 id="dc-fa-heading">Free agents who add the most</h2>
            <p className="dc-note">Wins added to the {teamName}’ 2027 total at his expected playing time, after he takes time from the players he’d replace.</p>
            <ol className="dc-fa-list">
              {suggestions.slice(0, 10).map((s) => (
                <li key={s.p.i}>
                  <div><strong>{label(s.p)}</strong><span>{s.positions.join(", ")}{aavText(s.p) ? ` · ${aavText(s.p)}` : ""}</span></div>
                  <b>{signed(s.gain)}</b>
                  <button type="button" onClick={() => add(s.p)} aria-label={`Add ${label(s.p)}`}>Add</button>
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="dc-rank-heading">
            <h2 id="dc-rank-heading">Projected 2027 WAR</h2>
            <ol className="dc-rank">
              {table.map((t, i) => (
                <li key={t.abbr} className={t.abbr === team ? "dc-current" : undefined}>
                  <span>{i + 1}</span>
                  <button type="button" onClick={() => chooseTeam(t.abbr)}>{t.name}</button>
                  <b>{fmt(t.war)}</b>
                </li>
              ))}
            </ol>
            <p className="dc-note">Other teams are shown at their defaults.</p>
          </section>
        </aside>
      </div>
    </section>
  );
}
