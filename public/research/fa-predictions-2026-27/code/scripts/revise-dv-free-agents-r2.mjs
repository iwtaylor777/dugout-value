// Revision R2 of the October 29 DV free-agent estimates: corrects 2027 ages.
// Usage: node scripts/revise-dv-free-agents-r2.mjs public/research/fa-predictions-2026-27
// The site database had about a third of players a year too old (RosterResource current age plus one, instead of
// season age). This revision reads R1 (checked against LOCK-DV-20261029-R1.json), copies it to
// archive/2026-10-29-dv-r1/, sets age_2027 from the corrected database and reprices every row the database covers
// with the unchanged pricing code. It stops if any listed price or term changes, so only ages and excluded-player
// reference prices can move. R1's hand-set Skubal term is kept.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { projectionAge, forecastWarPath, priceContract } from '../lib/free-agent-pricing.mjs';

const dir = process.argv[2];
if (!dir) throw new Error('Usage: RELEASE_DIRECTORY');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const r1Lock = JSON.parse(fs.readFileSync(path.join(dir, 'LOCK-DV-20261029-R1.json')));
const archive = path.join(dir, 'archive/2026-10-29-dv-r1');
const source = fs.existsSync(path.join(archive, 'predictions_frozen.json')) ? archive : dir;
for (const [name, hash] of Object.entries(r1Lock.files)) if (sha(path.join(source, name)) !== hash) throw new Error(`R1 snapshot mismatch: ${name}`);
const r1 = JSON.parse(fs.readFileSync(path.join(source, 'predictions_frozen.json')));
if (source === dir) {
  fs.mkdirSync(archive, { recursive: true });
  for (const name of Object.keys(r1Lock.files)) fs.copyFileSync(path.join(dir, name), path.join(archive, name));
}

const db = JSON.parse(fs.readFileSync('app/data/player-database.json')), dv = JSON.parse(fs.readFileSync('app/data/dv-projections.json'));
if (!db.meta.ageCorrection) throw new Error('Database has no age correction');
const byId = new Map(db.players.map(p => [p.id, p]));
const changes = [];
const discount = r1.price_settings.timingPreference / 100;
const fix = (row, listed) => {
  const p = byId.get(row.id);
  if (!p) return row;
  const age = projectionAge(p);
  const price = priceContract(p, forecastWarPath(p, dv.players[p.id]), db);
  const o = row.manual_override;
  let years = price.years, total = price.total_musd, aav = price.aav_musd;
  if (o) {
    if (price.years !== o.model_years || price.total_musd !== o.model_total_musd) throw new Error(`Model price moved for ${row.player}`);
    let value = 0, annuity = 0;
    for (let i = 0; i < o.set_years; i++) { const f = (1 + discount) ** (-i - 1); value += price.market_values[2027 + i] * f; annuity += f; }
    years = o.set_years; aav = +(value / annuity).toFixed(1); total = +((value / annuity) * years).toFixed(1);
  }
  const moved = years !== row.years || total !== row.total_musd || aav !== row.aav_musd;
  if (listed && moved) throw new Error(`Listed price moved for ${row.player}: ${row.years}/${row.total_musd} -> ${years}/${total}`);
  if (age === row.age_2027 && !moved) return row;
  changes.push({ player: row.player, age_2027: [row.age_2027, age], ...(moved ? { years: [row.years, years], total_musd: [row.total_musd, total] } : {}) });
  return moved ? { ...row, age_2027: age, years, total_musd: total, aav_musd: aav, war_2027: price.war_2027, war_path: price.war_path, market_values: price.market_values } : { ...row, age_2027: age };
};
const predictions = r1.predictions.map(r => fix(r, true));
const excluded = r1.excluded.map(r => fix(r, false));
const cut_next = (r1.cut_next ?? []).map(r => fix(r, false));

const result = { ...r1, revision: { id: 'R2', recorded_utc: new Date().toISOString(), base_snapshot_lock_sha256: sha(path.join(dir, 'LOCK-DV-20261029-R1.json')),
  summary: 'Ages corrected to 2027 season age (age on June 30). No listed price or term changed. R1 changes (Skubal\'s 10-year term, Bauers note) are kept.',
  previous: [r1.revision] , age_changes: changes }, predictions, excluded, cut_next };
fs.writeFileSync(path.join(dir, 'predictions_frozen.json'), JSON.stringify(result, null, 2) + '\n');
const columns = ['rank', 'player', 'position', 'age_2027', 'war_2026', 'war_2027', 'years', 'total_musd', 'aav_musd', 'projection_source', 'flag_direction', 'flag'];
const cell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s; };
fs.writeFileSync(path.join(dir, 'predictions_frozen.csv'), [columns.join(','), ...predictions.map(r => columns.map(k => cell(r[k])).join(','))].join('\n') + '\n');
const lock = { locked_utc: result.revision.recorded_utc, revision: 'R2', base_lock: { 'LOCK-DV-20261029-R1.json': result.revision.base_snapshot_lock_sha256, verifies: 'archive/2026-10-29-dv-r1/' },
  inputs: { 'revise-dv-free-agents-r2.mjs': sha(new URL(import.meta.url).pathname), 'player-database.json': sha('app/data/player-database.json') },
  files: Object.fromEntries(['predictions_frozen.json', 'predictions_frozen.csv'].map(f => [f, sha(path.join(dir, f))])),
  note: 'Data correction recorded before any contract in this class was observed: 2027 ages only. Listed prices and terms are unchanged.' };
fs.writeFileSync(path.join(dir, 'LOCK-DV-20261029-R2.json'), JSON.stringify(lock, null, 2) + '\n');
console.log(changes.length, 'rows changed'); for (const c of changes) console.log(JSON.stringify(c));
