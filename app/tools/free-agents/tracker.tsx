"use client";
import { useMemo, useState } from "react";
import data from "../../data/free-agent-tracker.json";
import signingsData from "../../data/free-agent-signings.json";

type Player = {
  name: string; id: string; pos: string; team: string | null; age: number; role: string; fwar2026: number | null; option: string | null;
  basis: "scored" | "live" | "none"; rank?: number; war2027?: number | null; warPath?: Record<string, number | null>;
  years?: number | null; total?: number | null; aav?: number | null; market: "expected" | "option" | "stays" | "qo" | "unmodeled"; flag: string | null; source?: string;
};
type Outcome = "signed" | "re-signed" | "extension" | "qo-accepted" | "option-exercised" | "option-declined" | "opted-out" | "opted-in" | "retired";
type Signing = { player: string; outcome: Outcome; team?: string | null; years?: number | null; total_musd?: number | null; date: string; source?: string };
type Status = "available" | "signed" | "pending" | "all";
type Sort = "total" | "aav" | "war2027" | "war5" | "fwar" | "age" | "name";

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
const war5 = (p: Player) => p.warPath ? Object.values(p.warPath).reduce<number>((a, b) => a + (b ?? 0), 0) : null;
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

export function FreeAgentTracker() {
  const [status, setStatus] = useState<Status>("available");
  const [group, setGroup] = useState<string>("All");
  const [sort, setSort] = useState<Sort>("total");
  const [query, setQuery] = useState("");
  const counts = useMemo(() => {
    const c = { available: 0, signed: 0, pending: 0, all: players.length };
    for (const p of players) c[stateOf(p).status]++;
    return c;
  }, []);
  const rows = useMemo(() => {
    const q = key(query);
    const list = players.filter((p) => inGroup(p.pos, group) && (status === "all" || stateOf(p).status === status) && (!q || key(`${p.name}${p.team ?? ""}${p.pos}`).includes(q)));
    const n = (v: number | null | undefined) => v ?? -Infinity;
    const by: Record<Sort, (a: Player, b: Player) => number> = {
      total: (a, b) => n(b.total) - n(a.total) || n(b.war2027) - n(a.war2027),
      aav: (a, b) => n(b.aav) - n(a.aav),
      war2027: (a, b) => n(b.war2027) - n(a.war2027),
      war5: (a, b) => n(war5(b)) - n(war5(a)),
      fwar: (a, b) => n(b.fwar2026) - n(a.fwar2026),
      age: (a, b) => a.age - b.age,
      name: (a, b) => a.name.split(" ").slice(1).join(" ").localeCompare(b.name.split(" ").slice(1).join(" ")),
    };
    return [...list].sort((a, b) => by[sort](a, b) || a.name.localeCompare(b.name));
  }, [status, group, sort, query]);
  const signedRows = players.map((p) => ({ p, s: stateOf(p).signing })).filter((x) => x.s && x.s.total_musd != null && x.p.total != null && OFF_MARKET.includes(x.s.outcome));

  return (
    <section className="dv-war-board fa-board">
      <div className="fa-summary" aria-label="Class summary">
        <p><strong>{counts.all}</strong><span>players in the class</span></p>
        <p><strong>{counts.available}</strong><span>available or expected to be</span></p>
        <p><strong>{counts.signed}</strong><span>signed or off the market</span></p>
        <p><strong>{counts.pending}</strong><span>options and opt-outs pending</span></p>
        {signedRows.length > 0 && <p><strong>{signedNum(signedRows.reduce((a, x) => a + (x.s!.total_musd! - x.p.total!), 0))}</strong><span>$M signed vs our estimates</span></p>}
      </div>
      <div className="dv-war-controls fa-controls">
        <label>
          <span>Show</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="available">Available ({counts.available})</option>
            <option value="signed">Signed ({counts.signed})</option>
            <option value="pending">Options and opt-outs pending ({counts.pending})</option>
            <option value="all">Whole class ({counts.all})</option>
          </select>
        </label>
        <label>
          <span>Position</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {POS_GROUPS.map((g) => <option key={g} value={g}>{g === "All" ? "All positions" : g}</option>)}
          </select>
        </label>
        <label>
          <span>Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="total">Contract estimate</option>
            <option value="aav">Average annual value</option>
            <option value="war2027">DV WAR, 2027</option>
            <option value="war5">DV WAR, 2027–31</option>
            <option value="fwar">fWAR, 2026</option>
            <option value="age">Youngest first</option>
            <option value="name">Last name</option>
          </select>
        </label>
        <label>
          <span>Find a player</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, team or position…" />
        </label>
      </div>
      <div className="article-table-wrap" tabIndex={0} role="region" aria-label="Free-agent tracker">
        <table className="fa-table">
          <caption>{rows.length} players · ages are for the 2027 season · contract estimates in guaranteed dollars</caption>
          <thead>
            <tr>
              <th scope="col" className="num">#</th>
              <th scope="col">Player</th>
              <th scope="col" className="num">fWAR 2026</th>
              <th scope="col" className="num">DV WAR 2027</th>
              <th scope="col" className="num">DV WAR 2027–31</th>
              <th scope="col" className="num">Our estimate</th>
              <th scope="col" className="num">AAV</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const st = stateOf(p), s = st.signing, w5 = war5(p);
              const diff = s?.total_musd != null && p.total != null && OFF_MARKET.includes(s.outcome) ? s.total_musd - p.total : null;
              return (
                <tr key={p.id} className={st.status === "signed" ? "fa-signed" : st.status === "pending" ? "fa-pending" : undefined}>
                  <td className="num">{i + 1}</td>
                  <th scope="row">
                    {p.name}
                    {p.basis === "scored" && <span className="fa-badge" title={`Scored prediction #${p.rank}, frozen October 29`}>Scored #{p.rank}</span>}
                    <small className="dv-war-sub">{p.pos} · {p.team ?? "—"} · age {p.age}{p.option ? ` · ${p.option}` : ""}</small>
                    {p.flag && <small className="fa-flag">{p.flag}</small>}
                  </th>
                  <td className="num">{fmt(p.fwar2026)}</td>
                  <td className="num"><strong>{fmt(p.war2027)}</strong></td>
                  <td className="num">{fmt(w5)}</td>
                  <td className="num">{p.total == null ? "—" : minimum(p) ? "Minimum" : <>{money(p.total)}<small className="dv-war-sub">{yrs(p.years!)}</small></>}</td>
                  <td className="num">{p.aav == null || minimum(p) ? "—" : money(p.aav)}</td>
                  <td className="fa-status">
                    {s ? (
                      <>
                        <strong>{outcomeLabel[s.outcome]}</strong>
                        {s.team && <> · {s.team}</>}
                        {s.total_musd != null && s.years != null && <small className="dv-war-sub">{yrs(s.years)}, {money(s.total_musd)}{diff != null && <> · <span className={diff >= 0 ? "fa-over" : "fa-under"}>{signedNum(diff)} vs estimate</span></>}</small>}
                      </>
                    ) : st.status === "pending" ? <span className="fa-muted">{pendingLabel(p)}</span>
                      : p.market === "unmodeled" ? <span className="fa-muted">Not estimated</span>
                      : <span>Available</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="fa-updated">Signings checked {new Date(signingsData.updated + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}. Estimates built {new Date(data.meta.built + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })} with {data.meta.projections}.</p>
    </section>
  );
}
