// Refresh only position eligibility. Never rebuild or replace the saved WAR,
// component-defense projections, playing time, contracts, or payroll inputs.
// Run normally to fetch MLB's 2026 regular-season fielding totals; --replay
// reapplies the checked-in compact usage snapshot without a network request.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const USAGE_SEASON = 2026;
export const USAGE_URL = 'https://statsapi.mlb.com/api/v1/stats?stats=season&group=fielding&season=2026&sportIds=1&playerPool=ALL&gameType=R&limit=5000';
const FIELD_POSITIONS = new Set(['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']);
const DEPTH = new URL('../app/data/depth-chart.json', import.meta.url);
const SNAPSHOT = new URL('../app/data/depth-position-usage.json', import.meta.url);

export function inningsToOuts(value) {
  const match = String(value ?? '0').match(/^(\d+)(?:\.([012]))?$/);
  if (!match) throw new Error(`Invalid innings notation: ${value}`);
  return Number(match[1]) * 3 + Number(match[2] ?? 0);
}

export function positionUsage(response) {
  const group = response.stats?.find(s => s.group?.displayName === 'fielding');
  if (!group?.splits || group.totalSplits !== group.splits.length) throw new Error('Missing or truncated MLB fielding sample');
  const players = {}, seen = new Set();
  for (const row of group.splits) {
    if (String(row.season) !== String(USAGE_SEASON)) throw new Error('Unexpected fielding season');
    const pos = row.position?.abbreviation;
    if (!FIELD_POSITIONS.has(pos)) continue;
    const id = `mlb-${row.player?.id}`, key = `${id}:${pos}`;
    if (!Number.isInteger(row.player?.id) || seen.has(key)) throw new Error(`Invalid or duplicate player-position row: ${key}`);
    seen.add(key);
    const outs = inningsToOuts(row.stat.innings), games = Number(row.stat.gamesPlayed ?? 0), starts = Number(row.stat.gamesStarted ?? 0);
    if (![games, starts].every(n => Number.isInteger(n) && n >= 0)) throw new Error(`Invalid playing time: ${key}`);
    (players[id] ??= []).push({ pos, outs, games, starts });
  }
  return players;
}

export function applyPositionUsage(depth, usage) {
  let matched = 0, changed = 0, fallback = 0;
  const players = depth.players.map(p => {
    if (p.k !== 'b') return p;
    const evidence = (usage[p.pid] ?? []).filter(r => r.outs >= 225 || r.games >= 10);
    // Field positions rank by innings; DH has no fielding innings, so use
    // starts × 9 as a role-frequency proxy solely for ordering the list.
    evidence.sort((a, b) => (b.pos === 'DH' ? b.starts * 27 : b.outs) - (a.pos === 'DH' ? a.starts * 27 : a.outs) || a.pos.localeCompare(b.pos));
    if (!evidence.length) { fallback++; return { ...p, eSource: 'listed-fallback' }; }
    matched++;
    const e = evidence.map(r => r.pos);
    if (JSON.stringify(e) !== JSON.stringify(p.e)) changed++;
    return { ...p, e, eSource: 'mlb-2026' };
  });
  return { depth: { ...depth, players }, matched, changed, fallback };
}

async function main() {
  const depth = JSON.parse(fs.readFileSync(DEPTH, 'utf8'));
  let snapshot;
  if (process.argv.includes('--replay')) {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    if (snapshot.meta.season !== USAGE_SEASON) throw new Error('Wrong usage snapshot season');
  } else {
    const response = await fetch(USAGE_URL, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`MLB fielding response ${response.status}`);
    const raw = await response.json(), all = positionUsage(raw);
    if ((raw.stats?.[0]?.splits?.length ?? 0) < 1000) throw new Error('Expected the full fielding pool, not qualified leaders');
    const ids = new Set(depth.players.filter(p => p.k === 'b').map(p => p.pid));
    snapshot = { meta: { season: USAGE_SEASON, source: USAGE_URL, retrievedAt: new Date().toISOString(), rule: 'At least 75 innings or 10 games at a position in 2026. This is a game eligibility rule, not an MLB restriction. Listed roles retained if no position qualifies. Field positions ordered by innings; DH by starts × 9.', rawRows: raw.stats[0].splits.length }, players: Object.fromEntries(Object.entries(all).filter(([id]) => ids.has(id)).sort(([a], [b]) => a.localeCompare(b))) };
  }
  const result = applyPositionUsage(depth, snapshot.players);
  if (result.matched < 300) throw new Error('Insufficient matched usage; refusing to change eligibility');
  fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + '\n');
  fs.writeFileSync(DEPTH, JSON.stringify(result.depth) + '\n');
  console.log(JSON.stringify({ matched: result.matched, changed: result.changed, fallback: result.fallback, source: snapshot.meta.source }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
