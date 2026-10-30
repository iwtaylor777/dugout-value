// Dated revision R1 of the October 29 DV free-agent estimates.
// Usage: node scripts/revise-dv-free-agents.mjs public/research/fa-predictions-2026-27
// Reads the recorded snapshot, checks it against LOCK-DV-20261029.json, moves it to archive/2026-10-29-dv-original/,
// applies the editorial decisions below and writes the new root snapshot with LOCK-DV-20261029-R1.json.
// Prices still come from the market values recorded in the original snapshot; only the listed term is set by hand.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dir = process.argv[2];
if (!dir) throw new Error('Usage: RELEASE_DIRECTORY');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const base = JSON.parse(fs.readFileSync(path.join(dir, 'LOCK-DV-20261029.json')));
const archive = path.join(dir, 'archive/2026-10-29-dv-original');
const source = fs.existsSync(path.join(archive, 'predictions_frozen.json')) ? archive : dir;
for (const [name, hash] of Object.entries(base.files)) if (sha(path.join(source, name)) !== hash) throw new Error(`Original snapshot mismatch: ${name}`);
const original = JSON.parse(fs.readFileSync(path.join(source, 'predictions_frozen.json')));
if (source === dir) {
  fs.mkdirSync(archive, { recursive: true });
  for (const name of Object.keys(base.files)) fs.copyFileSync(path.join(dir, name), path.join(archive, name));
}

const decided = '2026-10-29';
const TERM_OVERRIDES = {
  'Tarik Skubal': { years: 10, reason: 'Set by hand to 10 years. The model\'s term rule stops at nine because his 2036 forecast (0.89 WAR) falls below one win, but the top of the market has given aces longer deals than that rule allows. The tenth season is priced from the same recorded market values, so the total and AAV still come from the model.' },
};
const NOTES = [
  { player: 'Jake Bauers', team_2026: 'MIL', position: '1B', note: 'Not priced as a market contract: I expect Milwaukee to make him a qualifying offer and him to accept it.', decided },
];

const discount = original.price_settings.timingPreference / 100;
const predictions = original.predictions.map(row => {
  const o = TERM_OVERRIDES[row.player];
  if (!o) return row;
  const mv = row.market_values;
  let value = 0, annuity = 0, warPath = {};
  for (let i = 0; i < o.years; i++) {
    const y = String(2027 + i);
    if (!Number.isFinite(mv[y])) throw new Error(`No recorded market value for ${row.player} ${y}`);
    const f = (1 + discount) ** (-i - 1); value += mv[y] * f; annuity += f;
  }
  const aav = value / annuity;
  const pathAll = row.war_path_full ?? null;
  for (let i = 0; i < o.years; i++) { const y = String(2027 + i); warPath[y] = row.war_path[y] ?? pathAll?.[y]; }
  return { ...row, flag: row.flag || `Term set to ${o.years} years by hand; the model's rule gives ${row.years} years and $${row.total_musd.toFixed(1)}M.`, years: o.years, total_musd: +(aav * o.years).toFixed(1), aav_musd: +aav.toFixed(1), war_path: warPath,
    manual_override: { field: 'years', model_years: row.years, model_total_musd: row.total_musd, model_aav_musd: row.aav_musd, set_years: o.years, reason: o.reason, decided } };
});
// The original JSON stores the WAR path only through the model term; fill the added years from the DV forecast path.
const sk = predictions.find(r => r.manual_override);
if (sk && Object.values(sk.war_path).some(v => v == null)) {
  const { forecastWarPath } = await import(path.resolve('lib/free-agent-pricing.mjs'));
  const db = JSON.parse(fs.readFileSync('app/data/player-database.json')), dv = JSON.parse(fs.readFileSync('app/data/dv-projections.json'));
  const p = db.players.find(x => x.id === sk.id), full = forecastWarPath(p, dv.players[p.id]);
  for (const y of Object.keys(sk.war_path)) if (sk.war_path[y] == null) sk.war_path[y] = full[y];
  if (Object.entries(sk.war_path).some(([y, v]) => y in original.predictions[0].war_path && v !== original.predictions[0].war_path[y])) throw new Error('Forecast path no longer matches the recorded snapshot');
}

const order = (a, b) => b.total_musd - a.total_musd || b.aav_musd - a.aav_musd;
predictions.sort(order).forEach((r, i) => { r.rank = i + 1; });
const result = { ...original, revision: { id: 'R1', recorded_utc: new Date().toISOString(), base_snapshot_lock_sha256: sha(path.join(dir, 'LOCK-DV-20261029.json')),
  summary: 'Skubal\'s term set by hand to 10 years, priced from the recorded market values; Jake Bauers added as a note (expected to accept a qualifying offer). Every other row is unchanged.' },
  predictions, notes: NOTES };
fs.writeFileSync(path.join(dir, 'predictions_frozen.json'), JSON.stringify(result, null, 2) + '\n');
const columns = ['rank', 'player', 'position', 'age_2027', 'war_2026', 'war_2027', 'years', 'total_musd', 'aav_musd', 'projection_source', 'flag_direction', 'flag'];
const cell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s; };
fs.writeFileSync(path.join(dir, 'predictions_frozen.csv'), [columns.join(','), ...predictions.map(r => columns.map(k => cell(r[k])).join(','))].join('\n') + '\n');
const lock = { locked_utc: result.revision.recorded_utc, revision: 'R1', base_lock: { 'LOCK-DV-20261029.json': result.revision.base_snapshot_lock_sha256, verifies: 'archive/2026-10-29-dv-original/' },
  inputs: { 'revise-dv-free-agents.mjs': sha(new URL(import.meta.url).pathname) },
  files: Object.fromEntries(['predictions_frozen.json', 'predictions_frozen.csv'].map(f => [f, sha(path.join(dir, f))])),
  note: 'Editorial revision recorded before any contract in this class was observed. The model\'s own Skubal estimate (9 years, $367.0M) is kept in manual_override and in the archived original snapshot.' };
fs.writeFileSync(path.join(dir, 'LOCK-DV-20261029-R1.json'), JSON.stringify(lock, null, 2) + '\n');
console.log(predictions.slice(0, 3).map(r => [r.player, r.years, r.total_musd, r.aav_musd]), predictions.length);
