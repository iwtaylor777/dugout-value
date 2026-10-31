// Depth chart allocation: turns a roster of projected rates and expected playing time into a 162-game team.
// Each player entry: { i, n, t, e: eligible positions (first = natural), k: 'b' | 'p', r: 2027 WAR per 600 PA or 180 IP, x: expected PA or IP }.
export const HITTING = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
export const PITCHING = ['SP', 'RP'];
export const POSITIONS = [...HITTING, ...PITCHING];
export const DEFAULT_TARGETS = { hitter: 683, SP: 850, RP: 595 };
// FanGraphs positional adjustments, runs per 162 games.
const ADJ = { C: 12.5, SS: 7.5, '2B': 2.5, '3B': 2.5, CF: 2.5, LF: -7.5, RF: -7.5, '1B': -12.5, DH: -17.5 };
// Positions a player commonly moves down to when his own are full.
const DOWN = { C: ['1B'], SS: ['2B', '3B'], '2B': ['1B'], '3B': ['1B'], CF: ['LF', 'RF'], LF: ['RF', '1B'], RF: ['LF', '1B'], '1B': [], DH: [] };
const RUNS_PER_WIN = 9.82; // 2026 FanGraphs runs per win
const SPARE = 25; // smallest spare PA or IP moved to another position

export const unitOf = p => (p.k === 'p' ? 180 : 600);
export const targetOf = (pos, targets = DEFAULT_TARGETS) => (pos === 'SP' || pos === 'RP' ? targets[pos] : targets.hitter);
const PER_600 = 600 / DEFAULT_TARGETS.hitter;
const ADJ_600 = Object.fromEntries(Object.entries(ADJ).map(([pos, runs]) => [pos, runs * PER_600]));
/** Runs below average assumed for a player at a listed position the projection doesn't treat as his own. */
export const BELOW_AVERAGE_FIELDING = 3.5;
const samePosition = (tag, pos) => tag === pos || (tag === 'OF' && ['LF', 'CF', 'RF'].includes(pos));
/**
 * WAR rate at a position.
 * Hitters with a Dugout Value projection carry d, the fielding and positional runs per 600 PA built into their rate,
 * and mp, the position the projection saw (his FanGraphs listing). At that position the rate is unchanged. At DH he
 * keeps no more than a DH's positional value. At another position his team lists him at (except catcher), he is
 * credited at least as a slightly below-average fielder there. Moves anywhere else keep the projected rate, since the
 * tool doesn't estimate fielding at a new position.
 * Players without those fields only lose the positional adjustment when moved to DH.
 */
export function rateAt(p, pos) {
  if (p.k === 'p') return p.r;
  if (p.d != null && p.mp) {
    if (samePosition(p.mp, pos)) return p.r;
    let def = p.d;
    if (pos === 'DH') def = Math.min(p.d, ADJ_600.DH);
    else if (pos !== 'C' && p.e.includes(pos)) def = Math.max(p.d, ADJ_600[pos] - BELOW_AVERAGE_FIELDING);
    return p.r + (def - p.d) / RUNS_PER_WIN;
  }
  if (pos !== 'DH' || p.e.includes('DH')) return p.r;
  return p.r + ((ADJ.DH - ADJ[p.e[0]]) / RUNS_PER_WIN) * PER_600;
}

/**
 * Allocate playing time.
 * edits: { [entryId]: { pos?: forced position, pt?: locked playing time } }
 * Locked players get exactly what is set. Then players placed at a position by hand fill it in order of rate.
 * Everyone else fills his own positions in order of rate, up to his expected playing time; hitters with time left
 * move down the defensive spectrum, then to DH, and starters' spare innings go to the bullpen. Whatever is left is
 * replacement level, worth zero WAR by definition.
 */
export function allocate(roster, edits = {}, targets = DEFAULT_TARGETS) {
  const rem = Object.fromEntries(POSITIONS.map(pos => [pos, targetOf(pos, targets)]));
  const slots = Object.fromEntries(POSITIONS.map(pos => [pos, []]));
  const left = new Map();
  const give = (p, pos, pt, how) => {
    if (pt <= 0 && how !== 'set') return;
    pt = Math.max(0, pt);
    rem[pos] -= pt;
    const existing = slots[pos].find(row => row.p.i === p.i);
    if (existing) { existing.pt += pt; existing.war = rateAt(p, pos) * existing.pt / unitOf(p); return; }
    slots[pos].push({ p, pt, war: rateAt(p, pos) * pt / unitOf(p), how });
  };
  const byRate = pos => (a, b) => rateAt(b, pos ?? b.e[0]) - rateAt(a, pos ?? a.e[0]) || a.i.localeCompare(b.i);
  const auto = [];
  for (const p of roster) {
    const e = edits[p.i] ?? {};
    if (e.pt != null) { give(p, e.pos ?? p.e[0], e.pt, 'locked'); continue; }
    if (e.pos) continue;
    auto.push(p); left.set(p.i, p.x);
  }
  // Players placed by hand.
  const forced = roster.filter(p => edits[p.i]?.pos && edits[p.i]?.pt == null);
  for (const pos of POSITIONS) for (const p of forced.filter(q => edits[q.i].pos === pos).sort(byRate(pos))) give(p, pos, Math.min(p.x, Math.max(0, rem[pos])), 'set');
  // Own positions.
  for (const p of [...auto].sort(byRate())) {
    const own = p.e.filter(pos => pos !== 'DH');
    for (;;) {
      const l = left.get(p.i), open = own.filter(pos => rem[pos] > 0);
      if (l <= 0 || !open.length) break;
      const pos = open.reduce((a, b) => (rem[b] > rem[a] ? b : a));
      const pt = Math.min(l, rem[pos]);
      give(p, pos, pt, 'auto'); left.set(p.i, l - pt);
    }
  }
  // Down the spectrum, for players above replacement.
  for (const p of [...auto].filter(q => q.k === 'b' && q.r > 0).sort(byRate())) {
    const down = [...new Set(p.e.flatMap(pos => DOWN[pos] ?? []))].filter(pos => !p.e.includes(pos));
    for (const pos of down) {
      const l = left.get(p.i);
      if (l < SPARE) break;
      if (rem[pos] > 0) { const pt = Math.min(l, rem[pos]); give(p, pos, pt, 'auto'); left.set(p.i, l - pt); }
    }
  }
  // DH.
  for (const p of [...auto].filter(q => q.k === 'b' && left.get(q.i) >= (q.e.includes('DH') ? 1 : SPARE) && (q.e.includes('DH') || rateAt(q, 'DH') > 0)).sort(byRate('DH'))) {
    if (rem.DH <= 0) break;
    const pt = Math.min(left.get(p.i), rem.DH); give(p, 'DH', pt, 'auto'); left.set(p.i, left.get(p.i) - pt);
  }
  // Starters' spare innings in relief.
  for (const p of [...auto].filter(q => q.k === 'p' && q.e.includes('SP') && q.r > 0 && left.get(q.i) >= SPARE).sort(byRate())) {
    if (rem.RP <= 0) break;
    const pt = Math.min(left.get(p.i), rem.RP); give(p, 'RP', pt, 'auto'); left.set(p.i, left.get(p.i) - pt);
  }
  const positions = {};
  let hit = 0, pit = 0;
  for (const pos of POSITIONS) {
    const rows = slots[pos].sort((a, b) => b.pt - a.pt || b.war - a.war);
    const war = rows.reduce((s, r) => s + r.war, 0), target = targetOf(pos, targets);
    positions[pos] = { rows, war, target, filled: target - rem[pos], replacement: Math.max(0, rem[pos]), over: Math.max(0, -rem[pos]) };
    if (PITCHING.includes(pos)) pit += war; else hit += war;
  }
  const unused = roster.filter(p => !POSITIONS.some(pos => slots[pos].some(r => r.p.i === p.i)));
  return { positions, hit, pit, total: hit + pit, unused };
}

const OFF_MARKET = ['signed', 're-signed', 'extension', 'qo-accepted', 'option-exercised', 'opted-in', 'retired'];
const key = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/gi, '').toLowerCase();
/**
 * 2027 team for each entry. Free agents expected to reach the market leave their 2026 team; players with a pending
 * option, opt-out or qualifying offer stay; reported signings move players to the signing team.
 */
export function teamsFor(players, tracker, signings) {
  const market = new Map(tracker.players.map(r => [r.id, r.market]));
  const outcome = new Map(signings.map(s => [key(s.player), s]));
  const result = new Map(), freeAgents = new Set();
  for (const p of players) {
    if (p.ex) { result.set(p.i, null); continue; }
    const s = outcome.get(key(p.n));
    if (s && p.fa) {
      if (s.outcome === 'retired') { result.set(p.i, null); continue; }
      if (OFF_MARKET.includes(s.outcome)) { result.set(p.i, s.team ?? p.t); continue; }
      result.set(p.i, null); freeAgents.add(p.i); continue;
    }
    const m = market.get(p.pid);
    if (p.fa && (m === 'expected' || m === 'unmodeled')) { result.set(p.i, null); if (m === 'expected') freeAgents.add(p.i); continue; }
    result.set(p.i, p.t);
  }
  return { team: result, freeAgents };
}

/** Marginal WAR from adding each candidate to a roster, given the current edits. */
export function bestAdditions(roster, edits, candidates, targets = DEFAULT_TARGETS) {
  const base = allocate(roster, edits, targets).total;
  return candidates.map(c => {
    const after = allocate([...roster, c], edits, targets);
    const placed = POSITIONS.filter(pos => after.positions[pos].rows.some(r => r.p.i === c.i));
    return { p: c, gain: after.total - base, positions: placed };
  }).filter(x => x.gain > 0.05).sort((a, b) => b.gain - a.gain);
}

export const MINIMUM_SALARY = 0.78;
/**
 * A player's 2027 luxury-tax (CBT) hit in $M: his contract's AAV, option value or arbitration projection (cb), or the
 * minimum for pre-arbitration players. A free agent counts at his signed average salary once reported, otherwise at
 * our contract estimate.
 */
export function cbtHit(p, freeAgents, faAav = () => null) {
  if (freeAgents.has(p.i) || (p.fa && faAav(p) != null)) return Math.max(MINIMUM_SALARY, faAav(p) ?? MINIMUM_SALARY);
  return p.cb ?? MINIMUM_SALARY;
}
const countedIn = (p, abbr) => p.t === abbr && p.cb != null && !p.co;
/**
 * Moves since the payroll snapshot: free agents who have signed with the team join at their contract's AAV, and
 * players the snapshot counted who are no longer on the team come off.
 */
export function payrollAdjustment(players, abbr, teamOf, signed, faAav = () => null) {
  let adj = 0;
  for (const p of players) {
    const now = teamOf.get(p.i) === abbr;
    if (now && signed.has(p.i) && !countedIn(p, abbr)) adj += Math.max(MINIMUM_SALARY, faAav(p) ?? p.cb ?? MINIMUM_SALARY);
    else if (!now && countedIn(p, abbr) && !p.ex) adj -= p.cb;
  }
  return adj;
}
/** Change in 2027 CBT payroll from edits: added players' hits less the counted hits of anyone removed. */
export function payrollChange(defaultRoster, roster, freeAgents, faAav = () => null) {
  const before = new Set(defaultRoster.map(p => p.i)), after = new Set(roster.map(p => p.i));
  let change = 0;
  for (const p of roster) if (!before.has(p.i)) change += cbtHit(p, freeAgents, faAav);
  for (const p of defaultRoster) if (!after.has(p.i) && !p.co) change -= cbtHit(p, freeAgents, faAav);
  return change;
}
