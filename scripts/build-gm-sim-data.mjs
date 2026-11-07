// Build app/data/gm-sim.json for the GM simulator.
// Usage: node scripts/build-gm-sim-data.mjs
// For every MLB player and prospect: surplus value from the site's value model with Dugout Value projections, at three
// discount rates (win-now 20%, market 10%, rebuilding 5%) so AI teams can value trades by their situation; trade
// protection; last year of club control; projected 2027 WAR; and identity fields. For every team: the 2026 CBT payroll (default budget), the 2027 CBT estimate so far,
// league and division.
import fs from 'node:fs';
import { valuePlayer, initialSettings } from '../lib/value-model.mjs';
import { contractNameKey, withReportedGmContract } from './gm-contract-inputs.mjs';

const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const db = read('app/data/player-database.json'), dv = read('app/data/dv-projections.json').players;
const payroll = read('app/data/team-payroll.json').cbt;
const reported = new Map(read('app/data/free-agent-signings.json').entries.map(row => [contractNameKey(row.player), row]));

// Same substitution the trade tools make when the projection source is Dugout Value.
function withDv(p) {
  const d = p.kind === 'mlb' ? dv[p.id] : null;
  if (!d) return p;
  return {
    ...p,
    agingModel: p.agingModel ? { ...p.agingModel, anchorYear: Math.max(Number(p.agingModel.anchorYear) || 0, 2031) } : p.agingModel,
    seasons: p.seasons.map(s => (d.seasons[String(s.year)] !== undefined && !s.ros ? { ...s, war: d.seasons[String(s.year)] } : s)),
    threeYearProjection: p.threeYearProjection?.map(s => (d.three[String(s.year)] !== undefined ? { ...s, war: d.three[String(s.year)], inSeasonAdjustment: 0 } : s)),
  };
}
const round = v => Math.round(v * 10) / 10;
const players = {};
for (const p of db.players) {
  const q = withReportedGmContract(withDv(p), reported.get(contractNameKey(p.name)), dv[p.id]);
  const value = rate => valuePlayer(q, { ...initialSettings, timingPreference: rate }, db);
  const base = value(10);
  const w27 = p.kind === 'mlb' ? (dv[p.id]?.war?.['2027'] ?? q.threeYearProjection?.find(s => s.year === 2027)?.war ?? 0) : 0;
  players[p.id] = {
    n: p.name, t: q.team, k: p.kind === 'prospect' ? 'p' : 'm', pos: p.position ?? p.depthPosition ?? '', age: p.age,
    ...(p.kind === 'prospect' ? { ...(p.fv != null ? { fv: p.fv } : {}), ...(Number.isFinite(Number(p.eta)) ? { eta: Number(p.eta) } : {}) } : {}),
    v20: round(value(20).total), v10: round(base.total), v05: round(value(5).total),
    // Last season of club control (contract or arbitration, excluding player options) and projected 2027 WAR.
    ctl: base.clubControlThrough ?? base.controlThrough ?? null, w27: round(w27),
    ...(p.kind === 'mlb' ? { contract: base.rows.filter(s => s.year >= 2027 && !s.excluded).map(s => ({ year: s.year, salary: Math.round(s.salary * 100) / 100, type: q.seasons.find(y => y.year === s.year)?.contractType ?? q.seasons.find(y => y.year === s.year)?.salaryMode ?? 'estimate' })) } : {}),
    ...(p.tradeProtection && p.tradeProtection !== 'none' ? { prot: p.tradeProtection } : {}),
  };
}
const DIVISIONS = {
  'AL East': ['BAL', 'BOS', 'NYY', 'TBR', 'TOR'], 'AL Central': ['CHW', 'CLE', 'DET', 'KCR', 'MIN'], 'AL West': ['ATH', 'HOU', 'LAA', 'SEA', 'TEX'],
  'NL East': ['ATL', 'MIA', 'NYM', 'PHI', 'WSN'], 'NL Central': ['CHC', 'CIN', 'MIL', 'PIT', 'STL'], 'NL West': ['ARI', 'COL', 'LAD', 'SDP', 'SFG'],
};
const teams = {};
for (const [division, list] of Object.entries(DIVISIONS)) for (const abbr of list) {
  const pay = payroll.teams[abbr];
  if (!pay) throw new Error(`No payroll for ${abbr}`);
  teams[abbr] = { name: db.teams.find(t => t.abbr === abbr)?.name ?? abbr, league: division.slice(0, 2), division, cbt2026: pay.cbt2026, cbt2027: pay.cbt2027 };
}
if (Object.keys(teams).length !== 30) throw new Error('Expected 30 teams');
fs.writeFileSync('app/data/gm-sim.json', JSON.stringify({ meta: { built: new Date().toISOString().slice(0, 10), projections: read('app/data/dv-projections.json').meta.model, discountRates: { winNow: 20, market: 10, rebuild: 5 } }, teams, players }) + '\n');
const top = Object.entries(players).sort((a, b) => b[1].v10 - a[1].v10).slice(0, 8).map(([, v]) => `${v.n} ${v.v10}`);
console.log(Object.keys(players).length, 'players;', top.join(', '));
