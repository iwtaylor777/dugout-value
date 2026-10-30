"use client";
import { useMemo, useState } from "react";
import data from "../../data/free-agent-tracker.json";
import signingsData from "../../data/free-agent-signings.json";
import { compareTableValues } from "../../../lib/table-sort.mjs";

type Player = {
  name: string; id: string; pos: string; team: string | null; age: number; role: string; fwar2026: number | null; option: string | null;
  basis: "scored" | "live" | "none"; rank?: number; war2027?: number | null; warPath?: Record<string, number | null>;
  years?: number | null; total?: number | null; aav?: number | null; market: "expected" | "option" | "stays" | "qo" | "unmodeled"; flag: string | null; source?: string;
};
type Outcome = "signed" | "re-signed" | "extension" | "qo-accepted" | "option-exercised" | "option-declined" | "opted-out" | "opted-in" | "retired";
type Signing = { player: string; outcome: Outcome; team?: string | null; years?: number | null; total_musd?: number | null; date: string; source?: string };
type Status = "available" | "signed" | "pending" | "all";
type Sort = "total" | "aav" | "war2027" | "war5" | "fwar" | "age" | "name" | "status";
type Direction = "ascending" | "descending";
const SORT_LABELS: Record<Sort, string> = { total: "Our estimate", aav: "AAV", war2027: "DV WAR 2027", war5: "DV WAR 2027–31", fwar: "fWAR 2026", age: "Age", name: "Player", status: "Status" };

const players = data.players as Player[];
const signings = (signingsData.entries ?? []) as Signing[];
const key = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/gi, "").toLowerCase();
const outcomes = new Map(signings.map((s) => [key(s.player), s]));
const OFF_MARKET: Outcome[] = ["signed", "re-signed", "extension", "qo-accepted", "option-exercised", "opted-in", "retired"];
const ON_MARKET: Outcome[] = ["option-declined", "opted-out"];
const outcomeLabel: Record<Outcome, string> = {
  signed: "Signed", "re-signed": "Re-signed", extension: "Extended", "qo-accepted": "Accepted QO", "option-exercised": "Option exercised",
  "option-declined": "Option declined", "opted-out": "Opted out", "opted-in": "Stayed (opted in)", retired: "Retired",
};
const POS_GROUPS = ["All", "C", "1B", "2B", "3B", "SS", "OF", "DH", "SP", "RP"] as const;
const inGroup = (pos: string, g: string) => g === "All" || (g === "OF" ? ["LF", "CF", "RF", "OF"].includes(pos) : pos === g);
const war5 = (p: Player) => p.warPath && Object.values(p.warPath).some((v) => v != null) ? Object.values(p.warPath).reduce<number>((a, b) => a + (b ?? 0), 0) : null;
const minimum = (p: Player) => p.aav != null && p.aav < 1;
const fmt = (v: number | null | undefined, d = 1) => v == null ? "—" : v.toFixed(d);
const money = (v: number | null | undefined) => v == null ? "—" : `$${v >= 100 ? v.toFixed(0) : v.toFixed(1)}M`;
const signedNum = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v) >= 100 ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(1)}`;
const yrs = (n: number) => `${n} yr${n === 1 ? "" : "s"}`;

function stateOf(p: Player): { status: Exclude<Status, "all">; signing?: Signing } {
  const s = outcomes.get(key(p.name));
  if (s && OFF_MARKET.includes(s.outcome)) return { status: "signed", signing: s };
  if (s && ON_MARKET.includes(s.outcome)) return { status: "available", signing: s };
  if (p.market === "option" || p.market === "stays" || p.market === "qo") return { status: "pending" };
  return { status: "available" };
}
const pendingLabel = (p: Player) => p.market === "option" ? "Option likely exercised" : p.market === "stays" ? "Likely stays under contract" : p.market === "qo" ? "Expected to accept QO" : "";
const statusText = (p: Player) => {
  const { status, signing } = stateOf(p);
  return signing ? outcomeLabel[signing.outcome] : status === "pending" ? "Decision pending" : p.market === "unmodeled" ? "Not estimated" : "Available";
};

export function FreeAgentTracker() {
  const [status, setStatus] = useState<Status>("all");
  const [group, setGroup] = useState<string>("All");
  const [sort, setSort] = useState<Sort>("total");
  const [direction, setDirection] = useState<Direction>("descending");
  const [query, setQuery] = useState("");
  const filtered = status !== "all" || group !== "All" || Boolean(query.trim());
  const clearFilters = () => { setStatus("all"); setGroup("All"); setQuery(""); };
  const sortBy = (field: Sort) => {
    setDirection(sort === field ? direction === "ascending" ? "descending" : "ascending" : ["name", "age", "status"].includes(field) ? "ascending" : "descending");
    setSort(field);
  };
  const sortHeader = (field: Sort, numeric = true) => <th scope="col" className={numeric ? "num" : undefined} aria-sort={sort === field ? direction : "none"}>
    <button type="button" onClick={() => sortBy(field)} aria-label={`Sort by ${SORT_LABELS[field]}`}>
      {SORT_LABELS[field]} <span aria-hidden="true">{sort === field ? direction === "ascending" ? "↑" : "↓" : "↕"}</span>
    </button>
  </th>;
  const counts = useMemo(() => {
    const c = { available: 0, signed: 0, pending: 0, all: players.length };
    for (const p of players) c[stateOf(p).status]++;
    return c;
  }, []);
  const rows = useMemo(() => {
    const q = key(query);
    const list = players.filter((p) => inGroup(p.pos, group) && (status === "all" || stateOf(p).status === status) && (!q || key(`${p.name}${p.team ?? ""}${p.pos}`).includes(q)));
    const value: Record<Sort, (p: Player) => string | number | null | undefined> = {
      total: (p) => p.total, aav: (p) => p.aav, war2027: (p) => p.war2027,
      war5, fwar: (p) => p.fwar2026, age: (p) => p.age, name: (p) => p.name, status: statusText,
    };
    return [...list].sort((a, b) => compareTableValues(value[sort](a), value[sort](b), direction) || a.name.localeCompare(b.name));
  }, [status, group, sort, direction, query]);
  const signedRows = players.map((p) => ({ p, s: stateOf(p).signing })).filter((x) => x.s && x.s.total_musd != null && x.p.total != null && OFF_MARKET.includes(x.s.outcome));

  return (
    <section className="dv-war-board fa-board">
      <div className="fa-summary" aria-label="Class summary">
        <p className="fa-count-all"><strong>{counts.all}</strong><span>in the whole class</span></p>
        <p className="fa-count-available"><strong>{counts.available}</strong><span>available or expected</span></p>
        <p className="fa-count-signed"><strong>{counts.signed}</strong><span>signed / off market</span></p>
        <p className="fa-count-pending"><strong>{counts.pending}</strong><span>decisions pending</span></p>
      </div>
      <div className="dv-war-controls fa-controls">
        <label>
          <span>Find a player</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, team or position…" />
        </label>
        <label>
          <span>Show</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="all">Whole class</option>
            <option value="available">Available</option>
            <option value="signed">Off market</option>
            <option value="pending">Pending</option>
          </select>
        </label>
        <label>
          <span>Position</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {POS_GROUPS.map((g) => <option key={g} value={g}>{g === "All" ? "All positions" : g}</option>)}
          </select>
        </label>
      </div>
      <div className="fa-results-bar"><p role="status"><strong>{rows.length} {rows.length === 1 ? "player" : "players"}</strong> · {SORT_LABELS[sort]}, {sort === "name" || sort === "status" ? direction === "ascending" ? "A to Z" : "Z to A" : direction === "ascending" ? "low to high" : "high to low"}</p>{filtered && <button type="button" onClick={clearFilters}>Clear filters</button>}<span>Click a column to sort. Scroll sideways for more.</span></div>
      <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Free-agent tracker">
        <table className="fa-table">
          <caption>2026–27 free-agent class. Ages are for 2027; contract estimates are guaranteed dollars. AAV is average annual value.</caption>
          <thead>
            <tr>
              {sortHeader("name", false)}{sortHeader("fwar")}{sortHeader("war2027")}{sortHeader("war5")}{sortHeader("total")}{sortHeader("aav")}{sortHeader("age")}{sortHeader("status", false)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="fa-empty">{status === "signed" && counts.signed === 0 ? "No signings have been recorded yet." : "No players match these filters."} <button type="button" onClick={clearFilters}>Show the whole class</button></td></tr>}
            {rows.map((p) => {
              const st = stateOf(p), s = st.signing, w5 = war5(p);
              const diff = s?.total_musd != null && p.total != null && OFF_MARKET.includes(s.outcome) ? s.total_musd - p.total : null;
              return (
                <tr key={p.id} className={st.status === "signed" ? "fa-signed" : st.status === "pending" ? "fa-pending" : undefined}>
                  <th scope="row">
                    {p.name}
                    <small className="dv-war-sub">{p.pos} · {p.team ?? "—"}</small>
                    {(p.flag || p.option || p.basis === "scored") && <details className="fa-player-note"><summary>Player note</summary>{p.option && <p>{p.option}</p>}{p.flag && <p>{p.flag}</p>}{p.basis === "scored" && <p>Published forecast, frozen October 29.</p>}</details>}
                  </th>
                  <td className="num">{fmt(p.fwar2026)}</td>
                  <td className="num"><strong>{fmt(p.war2027)}</strong></td>
                  <td className="num">{fmt(w5)}</td>
                  <td className="num fa-estimate">{p.total == null ? "—" : minimum(p) ? "Minimum" : <>{money(p.total)}<small className="dv-war-sub">{yrs(p.years!)}</small></>}</td>
                  <td className="num">{p.aav == null ? "—" : minimum(p) ? "<$1M" : money(p.aav)}</td>
                  <td className="num">{p.age}</td>
                  <td className="fa-status">
                    {s ? (
                      <>
                        <strong className={`fa-status-chip ${st.status}`}>{outcomeLabel[s.outcome]}</strong>
                        {s.team && <> · {s.team}</>}
                        {s.total_musd != null && s.years != null && <small className="dv-war-sub">{yrs(s.years)}, {money(s.total_musd)}{diff != null && <> · <span className={diff >= 0 ? "fa-over" : "fa-under"}>{signedNum(diff)} vs estimate</span></>}</small>}
                      </>
                    ) : st.status === "pending" ? <><span className="fa-status-chip pending">Decision pending</span><small className="dv-war-sub">{pendingLabel(p)}</small></>
                      : p.market === "unmodeled" ? <span className="fa-status-chip unmodeled">Not estimated</span>
                      : <span className="fa-status-chip available">Available</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="fa-updated">Signings checked {new Date(signingsData.updated + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}. Estimates built {new Date(data.meta.built + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })} with {data.meta.projections}.</p>
      {signedRows.length > 0 && <p className="fa-updated">Recorded contracts total {signedNum(signedRows.reduce((a, x) => a + (x.s!.total_musd! - x.p.total!), 0))} million dollars versus our estimates, across {signedRows.length} players with both numbers.</p>}
    </section>
  );
}
