// Build app/data/depth-chart.json for the depth chart tool.
// Usage: node scripts/build-depth-chart-data.mjs [EXTRA_PLAYERS EXTRA_PROJECTIONS]
// Each MLB player gets his 2027 WAR rate and expected full-season playing time from the Dugout Value projections
// (app/data/dv-projections.json). Two-way players are split into a hitting and a pitching entry using
// app/data/dv-two-way-parts.json, written by the same projection builder. Players without a DV projection keep their
// published 2027 WAR as a rate and start at part-time playing time. Free agents outside the roster snapshot come from
// the same optional files the free-agent tracker uses, so the tool can suggest them.
import fs from 'node:fs';
const [extraPlayersFile, extraProjectionsFile, fgPayrollFile] = process.argv.slice(2);
// 2027 luxury-tax (CBT) hits by player, parsed from FanGraphs RosterResource payroll pages (kept outside the repo):
// guaranteed AAV, option values and arbitration projections. Only the one number per player is published.
const fgPayroll = fgPayrollFile ? JSON.parse(fs.readFileSync(fgPayrollFile, 'utf8')).players : {};
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const db = read('app/data/player-database.json'), dv = read('app/data/dv-projections.json');
const twoWay = read('app/data/dv-two-way-parts.json');
const tracker = read('app/data/free-agent-tracker.json');
const extraPlayers = extraPlayersFile ? read(extraPlayersFile) : [];
const extraProjections = extraProjectionsFile ? read(extraProjectionsFile).players : {};

export const TARGETS = { hitter: 683, SP: 850, RP: 595 }; // PA per lineup spot (6,150 a team) and innings by role (1,445 a team)
const PART_TIME = { position: 250, starter: 60, reliever: 40 }; // players without a DV projection
const OF = ['LF', 'CF', 'RF'];
function eligible(p) {
  const d = p.depthPosition ?? p.position ?? '';
  if (['starter', 'reliever'].includes(p.role)) return [p.role === 'starter' ? 'SP' : 'RP'];
  const out = [];
  for (const part of String(d).split('/')) {
    if (part === 'OF') out.push(...OF); else if (['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'].includes(part)) out.push(part);
  }
  return out.length ? [...new Set(out)] : ['DH'];
}
const round = (v, d = 2) => +v.toFixed(d);
const players = [];
const faById = new Map(tracker.players.map(r => [r.id, r]));
// 2027 CBT hit in $M. cb: the hit; co: 1 when it is a pending option, which team payroll estimates leave out.
function cbt2027(p) {
  const rows = fgPayroll[String(p.mlbamId ?? '')] ?? [];
  const row = rows.find(r => r.team === p.team) ?? rows[0];
  if (!row || row.hit == null) return null;
  return { cb: row.hit, co: /OPTION/.test(row.type) ? 1 : 0 };
}
function push(p, team, entry) {
  const fa = faById.get(p.id), cbt = entry.noPay ? null : cbt2027(p);
  const has2027 = (p.seasons ?? []).some(s => s.year === 2027);
  players.push({ i: entry.id ?? p.id, pid: p.id, n: p.name, t: team, e: entry.e, k: entry.k, r: round(entry.r), x: Math.round(entry.x), s: entry.s,
    ...(cbt ? { cb: cbt.cb, ...(cbt.co ? { co: 1 } : {}) } : {}), ...(fa ? { fa: 1 } : {}),
    // Contract over after 2026 and not in the free-agent class (retiring, released or otherwise off the market).
    ...(!fa && !entry.noPay && p.seasons && !has2027 ? { ex: 1 } : {}) });
}
for (const p of db.players) {
  if (p.kind !== 'mlb') continue;
  if (p.role === 'two-way') {
    const parts = twoWay[p.id];
    if (!parts) throw new Error(`No two-way split for ${p.name}`);
    push(p, p.team, { id: `${p.id}-bat`, e: ['DH'], k: 'b', r: parts.bat.rate, x: parts.bat.pt, s: 'dv' });
    push(p, p.team, { id: `${p.id}-pit`, e: ['SP'], k: 'p', r: parts.pit.rate, x: parts.pit.pt, s: 'dv', noPay: true });
    continue;
  }
  const k = ['starter', 'reliever'].includes(p.role) ? 'p' : 'b';
  const d = dv.players[p.id];
  if (d?.rate && d.pt) { push(p, p.team, { e: eligible(p), k, r: d.rate['2027'], x: d.pt['2027'], s: 'dv' }); continue; }
  const z = (p.threeYearProjection ?? []).find(s => s.year === 2027);
  if (!z) continue;
  const unit = Number(/^(\d+)/.exec(p.agingModel?.unitLabel ?? '')?.[1]) || (k === 'b' ? 600 : p.role === 'starter' ? 180 : 65);
  const scale = k === 'b' ? 600 : 180; // rates are stored per 600 PA or 180 IP
  push(p, p.team, { e: eligible(p), k, r: z.war * scale / unit, x: PART_TIME[p.role] ?? 250, s: 'zips' });
}
// Free agents outside the roster snapshot (no 2027 team until they sign).
const have = new Set(players.map(p => p.pid));
for (const row of tracker.players) {
  if (have.has(row.id) || row.market === 'unmodeled') continue;
  const ep = extraPlayers.find(p => p.id === row.id), proj = extraProjections[row.id];
  const k = ['SP', 'RP'].includes(row.pos) ? 'p' : 'b';
  const e = k === 'p' ? [row.pos] : row.pos === 'DH' ? ['DH'] : [row.pos];
  if (ep && proj?.rate) { push({ id: row.id, name: row.name }, null, { e: ep.role === 'starter' ? ['SP'] : ep.role === 'reliever' ? ['RP'] : e, k, r: proj.rate['2027'], x: proj.pt['2027'], s: 'dv' }); continue; }
  if (row.source === 'npb' && row.war2027 != null) { push({ id: row.id, name: row.name }, null, { e: ['3B', ...OF], k: 'b', r: row.war2027, x: 600, s: 'npb' }); continue; }
  throw new Error(`No depth-chart projection for free agent ${row.name}`);
}
const out = { meta: { built: new Date().toISOString().slice(0, 10), projections: dv.meta.model, targets: TARGETS, partTime: PART_TIME },
  teams: db.teams, players };
fs.writeFileSync('app/data/depth-chart.json', JSON.stringify(out) + '\n');
console.log(players.length, 'entries;', players.filter(p => p.fa).length, 'in the free-agent class;', players.filter(p => p.s === 'zips').length, 'without DV');
