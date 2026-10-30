// Build app/data/free-agent-tracker.json: every player in the 2026–27 free-agent class with Dugout Value
// projections, a contract estimate and 2026 fWAR.
// Usage: node scripts/build-fa-tracker.mjs MLBTR_LIST SATO_JSON RAW_DIRECTORY [EXTRA_PLAYERS EXTRA_PROJECTIONS]
//
// The 31 players in the scored October 29 release keep their frozen R2 estimates (public/research/fa-predictions-2026-27).
// Everyone else is priced now with the same pricing code (lib/free-agent-pricing.mjs) and the current Dugout Value
// projections. Players outside the site's roster snapshot come from scripts in the research release
// (build-fa-class-coverage.py, then the projection builder); pass those files as EXTRA_PLAYERS and EXTRA_PROJECTIONS.
// The class list and raw FanGraphs files stay local. The output holds only the fields the tracker shows.
// Signings are not stored here: they live in app/data/free-agent-signings.json and are applied on the page.
import fs from 'node:fs';
import path from 'node:path';
import { nameKey, projectionAge, forecastWarPath, priceContract, marketReach } from '../lib/free-agent-pricing.mjs';

const [listFile, satoFile, rawDir, extraPlayersFile, extraProjectionsFile] = process.argv.slice(2);
if (!rawDir) throw new Error('Usage: MLBTR_LIST SATO_JSON RAW_DIRECTORY [EXTRA_PLAYERS EXTRA_PROJECTIONS]');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const db = read('app/data/player-database.json'), dv = read('app/data/dv-projections.json');
const frozen = read('public/research/fa-predictions-2026-27/predictions_frozen.json');
if (frozen.revision?.id !== 'R2') throw new Error(`Expected frozen revision R2, found ${frozen.revision?.id}`);
const sato = read(satoFile);
const extraPlayers = extraPlayersFile ? read(extraPlayersFile) : [];
const extraProjections = extraProjectionsFile ? read(extraProjectionsFile).players : {};

const players = new Map(db.players.filter(p => p.kind === 'mlb').map(p => [nameKey(p.name), p]));
for (const p of extraPlayers) players.set(nameKey(p.name), p);
for (const e of sato) players.set(nameKey(e.player.name), e.player);
const list = fs.readFileSync(listFile, 'utf8').trim().split('\n').map(line => { const [position, name, note = ''] = line.split('|'); return { position, name, note }; });
for (const e of sato) list.push({ position: e.listPos, name: e.player.name, note: '' });

const fwar = { bat: {}, pit: {} }, fgTeam = {};
for (const kind of ['bat', 'pit']) for (const r of read(path.join(rawDir, `fg_${kind}_2026.json`)).data) {
  fwar[kind][String(r.playerid)] = r.WAR ?? 0;
  if (/^[A-Z]{2,3}$/.test(r.TeamNameAbb ?? '')) fgTeam[String(r.playerid)] = r.TeamNameAbb;
}

const scored = new Map(frozen.predictions.map(r => [nameKey(r.player), r]));
const excludedFrozen = new Map(frozen.excluded.map(r => [nameKey(r.player), r]));
const noteFor = new Map((frozen.notes ?? []).map(n => [nameKey(n.player), n.note]));
const confirmed = new Set(Object.keys(frozen.known_decisions ?? {}).map(nameKey));

const money = v => `$${Number(v) % 1 ? Number(v).toFixed(1).replace(/\.0$/, '') : Number(v)}M`;
function contractNote(note) {
  if (!note) return null;
  let m = /^club ([\d.]+)(?: buyout ([\d.]+))?/.exec(note);
  if (m) return `${money(m[1])} club option${m[2] ? ` (${money(m[2])} buyout)` : ''}`;
  m = /^mutual ([\d.]+)(?: buyout ([\d.]+))?/.exec(note);
  if (m) return `${money(m[1])} mutual option${m[2] ? ` (${money(m[2])} buyout)` : ''}`;
  m = /^playeroption ([\d.]+)/.exec(note);
  if (m) return `${money(m[1])} player option`;
  m = /^optout (\d+)y ([\d.]+)(?: buyout ([\d.]+))?/.exec(note);
  if (m) return `Opt-out: ${m[1]} yr${m[1] === '1' ? '' : 's'}, ${money(m[2])} remaining`;
  return null;
}
const round = (v, d = 1) => v == null || !Number.isFinite(v) ? null : +v.toFixed(d);
const missing = [], rows = [];
for (const item of list) {
  const key = nameKey(item.name), p = players.get(key);
  if (!p) { missing.push(item.name); continue; }
  const pitcher = ['starter', 'reliever'].includes(p.role);
  const war2026 = p.id === 'npb-sato' ? null : fwar[pitcher ? 'pit' : 'bat'][String(p.fangraphsId)];
  const base = { name: item.name, id: p.id, pos: item.position, team: p.id === 'npb-sato' ? 'Hanshin (NPB)' : p.team === 'FA' ? fgTeam[String(p.fangraphsId)] ?? null : p.team,
    age: projectionAge(p), role: p.role, fwar2026: round(war2026), option: contractNote(item.note) };
  const f = scored.get(key);
  if (f) {
    const path5 = Object.fromEntries(Object.entries(f.war_path).filter(([y]) => +y <= 2031).map(([y, v]) => [y, round(v)]));
    rows.push({ ...base, age: f.age_2027, basis: 'scored', rank: f.rank, war2027: round(f.war_2027), warPath: path5,
      years: f.years, total: f.total_musd, aav: f.aav_musd, market: 'expected', flag: f.flag || null,
      source: f.projection_source.startsWith('Dugout Value') ? 'dv' : f.projection_source.includes('NPB') ? 'npb' : 'zips' });
    continue;
  }
  const projection = dv.players[p.id] ?? extraProjections[p.id];
  if (!projection && !(p.threeYearProjection?.length)) {
    rows.push({ ...base, basis: 'none', market: 'unmodeled', flag: 'Not estimated: too little recent MLB history and no public projection.' });
    continue;
  }
  const warPath = forecastWarPath(p, projection), price = priceContract(p, warPath, db);
  let market = 'expected', flag = noteFor.get(key) ?? null;
  const fx = excludedFrozen.get(key);
  const reason = fx ? fx.reason : marketReach(item.note, price.market_values, confirmed.has(key));
  if (reason === 'club option likely exercised') market = 'option';
  else if (reason === 'likely stays') market = 'stays';
  else if (noteFor.has(key) && /qualifying offer/.test(noteFor.get(key))) market = 'qo';
  else if (reason === 'availability outside the model') { market = 'unmodeled'; flag = 'Not estimated: his availability depends on matters outside the model.'; }
  const path5 = Object.fromEntries(Object.entries(warPath).filter(([y]) => +y <= 2031).map(([y, v]) => [y, round(v)]));
  rows.push({ ...base, basis: 'live', war2027: round(warPath[2027]), warPath: path5,
    years: market === 'unmodeled' ? null : price.years, total: market === 'unmodeled' ? null : price.total_musd, aav: market === 'unmodeled' ? null : price.aav_musd,
    market, flag, source: projection ? 'dv' : 'zips' });
}
if (missing.length) throw new Error('Unmatched class players: ' + missing.join(', '));
const order = (a, b) => (b.total ?? -1) - (a.total ?? -1) || (b.war2027 ?? -9) - (a.war2027 ?? -9) || a.name.localeCompare(b.name);
rows.sort(order);
const out = {
  meta: {
    built: new Date().toISOString().slice(0, 10),
    projections: dv.meta.model,
    scoredRelease: { revision: frozen.revision.id, path: '/research/fa-predictions-2026-27', count: rows.filter(r => r.basis === 'scored').length },
    priceSettings: { dollarsPerWar: 11, inflation: 3, discount: frozen.price_settings.timingPreference },
    players: rows.length,
  },
  players: rows,
};
fs.writeFileSync('app/data/free-agent-tracker.json', JSON.stringify(out) + '\n');
const count = k => rows.filter(r => r.market === k).length;
console.log(JSON.stringify({ players: rows.length, scored: out.meta.scoredRelease.count, expected: count('expected'), option: count('option'), stays: count('stays'), unmodeled: count('unmodeled'), qo: count('qo') }));
