const counts = ["G", "GS", "PA", "AB", "H", "1B", "2B", "3B", "HR", "R", "RBI", "BB", "IBB", "SO", "HBP", "SF", "SH", "SB", "CS", "ER", "W", "L", "SV", "HLD", "WAR"];
const teamLabel = row => String(row.TeamNameAbb ?? row.TeamName ?? row.Team ?? "").replace(/<[^>]*>/g, "").trim();
const isTotal = row => /^(TOT|TOTAL|---|- - -|\d+\s*(TM|TMS|TEAMS))$/i.test(teamLabel(row));
const signature = row => JSON.stringify([...counts, "IP"].map(key => row[key] == null ? null : Number(row[key])));

// Historical FanGraphs IP is baseball notation (.1/.2 = one/two outs).
// Forecast IP is a continuous estimate and must not use this conversion.
export function historicalInnings(value) {
  const n = Number(value);
  const whole = Math.floor(n);
  const outs = Math.round((n - whole) * 10);
  if (!Number.isFinite(n) || n < 0 || outs > 2 || Math.abs(n - whole - outs / 10) > 1e-7) throw new Error(`Invalid historical IP: ${value}`);
  return whole + outs / 3;
}

export function normalizeSeasonHistory(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.xMLBAMID) continue;
    if (!["bat", "pit"].includes(row._stats) || !Number.isInteger(Number(row.Season))) throw new Error("History requires a season and statistic family");
    if (counts.some(stat => row[stat] != null && !Number.isFinite(Number(row[stat])))) throw new Error(`Invalid history count: ${row.xMLBAMID}/${row.Season}`);
    const key = `${row.xMLBAMID}:${row.Season}:${row._stats}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const totals = group.filter(isTotal);
    let selected;
    if (totals.length) {
      if (new Set(totals.map(signature)).size > 1) throw new Error(`Conflicting history totals: ${key}`);
      selected = [totals[0]];
    } else {
      const byTeam = new Map();
      for (const row of group) {
        const team = teamLabel(row);
        if (byTeam.has(team) && signature(byTeam.get(team)) !== signature(row)) throw new Error(`Conflicting history stints: ${key}/${team}`);
        byTeam.set(team, row);
      }
      selected = [...byTeam.values()];
      if (selected.length > 1 && selected.some(row => !teamLabel(row))) throw new Error(`Unidentified history stint: ${key}`);
    }
    const output = { ...selected[0], _historyRows: group.length, _historySelection: totals.length ? "total" : selected.length > 1 ? "team-stints" : "single" };
    for (const stat of counts) {
      if (selected.some(row => row[stat] != null)) output[stat] = selected.reduce((sum, row) => sum + Number(row[stat] ?? 0), 0);
    }
    if (selected.some(row => row.IP != null)) output.IP = selected.reduce((sum, row) => sum + (row._inningsUnit === "decimal" ? Number(row.IP ?? 0) : historicalInnings(row.IP ?? 0)), 0);
    if (selected.length > 1) {
      // Only counts and derived rates below are safe to combine. Do not inherit
      // unrelated rate fields from the first team stint.
      for (const field of Object.keys(output)) if (typeof output[field] === "number" && ![...counts, "IP", "Season", "xMLBAMID", "playerid", "Age", "_historyRows"].includes(field)) delete output[field];
      output.Team = output.TeamName = output.TeamNameAbb = "TOT";
      output.AVG = output.AB ? output.H / output.AB : 0;
      output.ERA = output.IP ? 9 * output.ER / output.IP : 0;
    }
    output._inningsUnit = "decimal";
    return output;
  });
}

export function remainingSeasonProjection(projection, remainingFraction) {
  if (!Number.isFinite(remainingFraction) || remainingFraction < 0 || remainingFraction > 1) throw new Error("Invalid remaining-season fraction");
  return remainingFraction === 0 ? undefined : projection;
}
