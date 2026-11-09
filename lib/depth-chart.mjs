// Depth chart allocation: turns a roster of projected rates and expected playing time into a 162-game team.
// Each player entry: { i, n, t, e: eligible positions (first = natural), k: 'b' | 'p', r: 2027 WAR per 600 PA or 180 IP, x: expected PA or IP }.
export const HITTING = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
export const PITCHING = ['SP', 'RP'];
export const POSITIONS = [...HITTING, ...PITCHING];
export const DEFAULT_TARGETS = { hitter: 683, SP: 850, RP: 595 };
// FanGraphs positional adjustments, runs per 162 games.
const ADJ = { C: 12.5, SS: 7.5, '2B': 2.5, '3B': 2.5, CF: 2.5, LF: -7.5, RF: -7.5, '1B': -12.5, DH: -17.5 };
// Direct, plausible offseason conversions, not a transitive defensive ladder.
// No automatic moves into C/SS/CF, from DH to the field, or from OF to the infield.
const SECONDARY = { C: ['1B'], SS: ['2B', '3B'], '3B': ['1B'], CF: ['LF', 'RF'], LF: ['RF'], RF: ['LF'] };
const RUNS_PER_WIN = 9.82; // 2026 FanGraphs runs per win
// A disclosed planning allowance, not an empirically fitted transition estimate.
export const SECONDARY_TRANSITION_RUNS = 2; // per 600 PA
export const isInferredPosition = (p, pos) => p.k === 'b' && pos !== 'DH' && !p.e.includes(pos) && p.e.some(from => (SECONDARY[from] ?? []).includes(pos));
export const eligiblePositions = p => p.k === 'p'
  ? [...new Set([...p.e, ...(p.e.includes('SP') ? ['RP'] : [])])]
  : [...new Set([...p.e, ...p.e.flatMap(pos => SECONDARY[pos] ?? []), 'DH'])];
// Conservative workload cap for an automatically converted starter. A manual
// role/playing-time edit can override it; this is a planning assumption.
export const MAX_CONVERTED_RELIEF_IP = 70;
export const MAX_NATIVE_RELIEF_IP = 85;

export const unitOf = p => (p.k === 'p' ? 180 : 600);
export const targetOf = (pos, targets = DEFAULT_TARGETS) => (pos === 'SP' || pos === 'RP' ? targets[pos] : targets.hitter);
const PER_600 = 600 / DEFAULT_TARGETS.hitter;
const ADJ_600 = Object.fromEntries(Object.entries(ADJ).map(([pos, runs]) => [pos, runs * PER_600]));
/** Runs below average assumed for a player at a listed position the projection doesn't treat as his own. */
export const BELOW_AVERAGE_FIELDING = 3.5;
/**
 * Share of a projected loss in defensive value that is applied (moves down the spectrum or to DH). Fit on 2022–24
 * backtests of the swap, where applying the full loss overpredicted the drop by 0.35 WAR per 600 PA; checked on 2025–26
 * (bias −0.48 → −0.22, RMSE 1.755 → 1.709). Moves up the spectrum were unbiased at full weight and keep it.
 */
export const DOWNWARD_SHARE = 0.55;
const samePosition = (tag, pos) => tag === pos || (tag === 'OF' && ['LF', 'CF', 'RF'].includes(pos));
/**
 * WAR rate at a position.
 * Hitters with component projections carry fs, projected fielding runs per full season at each position, and rd, the
 * fielding plus positional runs per 600 PA in their 2026 role. At a slot, the projected rate swaps the role's defense
 * for full-time defense there: fielding at that position plus its positional adjustment (a DH has no fielding). A
 * catcher slot for a player with no recent catching keeps the projected rate.
 * Hitters without components fall back to the implied-defense rule (d, mp): at a listed position the projection
 * doesn't assume, at least a slightly below-average fielder; at DH, no more than a DH's positional value.
 * Players with neither only lose the positional adjustment when moved to DH.
 */
function projectedRateAt(p, pos) {
  if (p.k === 'p') return p.r;
  if (p.fs && p.rd != null) {
    if (pos === 'C' && p.fs.C == null) return p.r;
    const def = pos === 'DH' ? ADJ_600.DH : (p.fs[pos] ?? 0) + ADJ_600[pos];
    const change = (def - p.rd) / RUNS_PER_WIN;
    return p.r + (change < 0 ? DOWNWARD_SHARE * change : change);
  }
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

export function rateAt(p, pos) {
  if (!isInferredPosition(p, pos)) return projectedRateAt(p, pos);
  const known = p.e.filter(role => role !== 'DH' && ADJ[role] != null);
  const nativeRate = Math.max(...known.map(role => projectedRateAt(p, role)));
  // Components already model position-specific defense. Without them, apply
  // the positional cost instead of carrying unchanged WAR to an unfamiliar role.
  const projected = p.fs && p.rd != null
    ? projectedRateAt(p, pos)
    : p.r + Math.min(0, ADJ[pos] - Math.max(...known.map(role => ADJ[role]))) * PER_600 / RUNS_PER_WIN;
  // A speculative conversion cannot manufacture individual WAR above a known
  // role. Roster gains must come from filling a hole or reducing displacement.
  return Math.min(projected, nativeRate) - SECONDARY_TRANSITION_RUNS / RUNS_PER_WIN;
}

/**
 * Allocate playing time.
 * edits: { [entryId]: { pos?: forced position, pt?: locked playing time } }
 * Locked players get exactly what is set. Then players placed at a position by hand fill it in order of rate.
 * Everyone else is assigned jointly to maximize projected WAR, within expected playing time and eligible roles.
 * Hitters can use observed/listed roles, DH, and a narrow set of inferred secondary
 * positions with a transition cost. Starters may supply at most 70 relief innings, and projected relievers at most 85. Players
 * can be left unused. This keeps an optional addition from making the best available roster worse. Any unfilled
 * playing time is replacement level, worth zero WAR by definition.
 */
export function allocate(roster, edits = {}, targets = DEFAULT_TARGETS) {
  const rem = Object.fromEntries(POSITIONS.map(pos => [pos, targetOf(pos, targets)]));
  const slots = Object.fromEntries(POSITIONS.map(pos => [pos, []]));
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
    auto.push(p);
  }
  // Players placed by hand.
  const forced = roster.filter(p => edits[p.i]?.pos && edits[p.i]?.pt == null);
  for (const pos of POSITIONS) for (const p of forced.filter(q => edits[q.i].pos === pos).sort(byRate(pos))) give(p, pos, Math.min(p.x, Math.max(0, rem[pos])), 'set');
  // Min-cost flow on a small player→position network. Reverse edges allow an
  // earlier assignment to move when that opens a better combination later.
  // Merely sorting all player/position pairs greedily cannot guarantee this.
  const ordered = auto.filter(p => p.x > 0).sort(byRate());
  const source = 0, playerStart = 1, posStart = playerStart + ordered.length;
  const sink = posStart + POSITIONS.length, graph = Array.from({ length: sink + 1 }, () => []);
  const edge = (from, to, cap, cost) => {
    const forward = { to, rev: graph[to].length, cap, cost };
    graph[from].push(forward);
    graph[to].push({ to: from, rev: graph[from].length - 1, cap: 0, cost: -cost });
    return forward;
  };
  const assignments = [];
  for (let i = 0; i < ordered.length; i++) {
    const p = ordered[i], node = playerStart + i;
    edge(source, node, p.x, 0);
    const eligible = eligiblePositions(p);
    for (const pos of eligible) {
      if (!(rem[pos] > 0)) continue;
      const rate = rateAt(p, pos) / unitOf(p);
      if (!(rate > 0)) continue;
      const reliefCap = p.e.includes('SP') && !p.e.includes('RP') ? MAX_CONVERTED_RELIEF_IP : MAX_NATIVE_RELIEF_IP;
      const cap = pos === 'RP' ? Math.min(p.x, reliefCap) : p.x;
      const forward = edge(node, posStart + POSITIONS.indexOf(pos), cap, -rate);
      assignments.push({ p, pos, forward, cap });
    }
  }
  POSITIONS.forEach((pos, i) => edge(posStart + i, sink, Math.max(0, rem[pos]), 0));
  const dist = new Float64Array(graph.length), previousNode = new Int32Array(graph.length), previousEdge = new Int32Array(graph.length);
  const queued = new Uint8Array(graph.length);
  for (;;) {
    dist.fill(Infinity); dist[source] = 0; previousNode.fill(-1); queued.fill(0);
    const queue = [source]; queued[source] = 1;
    for (let head = 0; head < queue.length; head++) {
      const from = queue[head]; queued[from] = 0;
      if (from === sink) continue;
      for (let i = 0; i < graph[from].length; i++) {
        const e = graph[from][i];
        if (e.cap <= 1e-9 || e.to === source || dist[e.to] <= dist[from] + e.cost + 1e-12) continue;
        dist[e.to] = dist[from] + e.cost; previousNode[e.to] = from; previousEdge[e.to] = i;
        if (!queued[e.to]) { queue.push(e.to); queued[e.to] = 1; }
      }
    }
    if (!(dist[sink] < -1e-12)) break;
    let amount = Infinity;
    for (let to = sink; to !== source; to = previousNode[to]) amount = Math.min(amount, graph[previousNode[to]][previousEdge[to]].cap);
    for (let to = sink; to !== source; to = previousNode[to]) {
      const e = graph[previousNode[to]][previousEdge[to]];
      e.cap -= amount; graph[to][e.rev].cap += amount;
    }
  }
  for (const { p, pos, forward, cap } of assignments) give(p, pos, cap - forward.cap, 'auto');
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
