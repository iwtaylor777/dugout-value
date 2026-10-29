"use client";
import { useMemo, useState } from "react";
import data from "../../data/dv-war-hitters.json";

type Row = { id: number; name: string; team: string; pos: string; pa: number; fwar: number; dvwar: number; bip: number; fld: number };
type Sort = "dvwar" | "diff" | "gain" | "fwar";
const seasons = data.seasons as Record<string, Row[]>;
const years = Object.keys(seasons).sort().reverse();
const signed = (v: number) => `${v > 0.04 ? "+" : v < -0.04 ? "−" : ""}${Math.abs(v).toFixed(1)}`;

export function DvWarLeaderboard() {
  const [year, setYear] = useState(years[0]);
  const [sort, setSort] = useState<Sort>("dvwar");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = seasons[year].filter((r) => !q || `${r.name} ${r.team} ${r.pos}`.toLowerCase().includes(q));
    const diff = (r: Row) => r.dvwar - r.fwar;
    return [...list].sort((a, b) =>
      sort === "dvwar" ? b.dvwar - a.dvwar : sort === "fwar" ? b.fwar - a.fwar : sort === "gain" ? diff(b) - diff(a) : diff(a) - diff(b),
    );
  }, [year, sort, query]);
  return (
    <section className="dv-war-board">
      <div className="dv-war-controls">
        <label>
          <span>Season</span>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label>
          <span>Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="dvwar">DV WAR</option>
            <option value="fwar">fWAR</option>
            <option value="gain">Gains most vs fWAR</option>
            <option value="diff">Loses most vs fWAR</option>
          </select>
        </label>
        <label>
          <span>Find a player</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, team or position…" />
        </label>
      </div>
      <div className="article-table-wrap" tabIndex={0} role="region" aria-label={`DV WAR leaderboard, ${year}`}>
        <table>
          <caption>{year} hitters with 300+ PA · {rows.length} players</caption>
          <thead>
            <tr>
              <th scope="col" className="num">#</th>
              <th scope="col">Player</th>
              <th scope="col" className="num">PA</th>
              <th scope="col" className="num">DV WAR</th>
              <th scope="col" className="num">fWAR</th>
              <th scope="col" className="num">Difference</th>
              <th scope="col" className="num">Balls in play</th>
              <th scope="col" className="num">Fielding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="num">{i + 1}</td>
                <th scope="row">{r.name}<small className="dv-war-sub">{r.team} · {r.pos}</small></th>
                <td className="num">{r.pa}</td>
                <td className="num"><strong>{r.dvwar.toFixed(1)}</strong></td>
                <td className="num">{r.fwar.toFixed(1)}</td>
                <td className="num">{signed(r.dvwar - r.fwar)}</td>
                <td className="num">{signed(r.bip)}</td>
                <td className="num">{signed(r.fld)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
