// GM simulator engine: free-agent offers, trade responses, AI free agency and the 2027 season simulation.
// Inputs are the depth-chart entries (app/data/depth-chart.json), the free-agent tracker, reported signings, team payroll
// and gm-sim.json (trade values, protection, budgets, divisions). Everything random is seeded, so a shared link replays
// the same offseason and the same 10,000 seasons.
import { allocate, teamsFor, payrollAdjustment, cbtHit, MINIMUM_SALARY, unitOf } from './depth-chart.mjs';

// ---------- randomness ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function normal(rand) {
  let u = 0; while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

// ---------- free agents ----------
/** A player's private asking multiplier on our estimate: centred about 3% above it, varying by player and game. */
export const askMultiplier = (seed, pid) => Math.exp(0.03 + 0.1 * normal(rng(hash(`${seed}:${pid}`))));
/**
 * What a free agent will accept. Minimum-salary players take a minimum deal. Everyone else wants at least his ask in
 * guaranteed money and no fewer than one year below our estimated term.
 */
export function askFor(fa, seed) {
  if (!fa || fa.total == null || fa.aav == null || fa.aav < 1) return { total: MINIMUM_SALARY, minYears: 1, maxYears: 2 };
  const m = askMultiplier(seed, fa.id);
  return { total: Math.round(fa.total * m * 10) / 10, minYears: Math.max(1, fa.years - 1), maxYears: Math.min(13, fa.years + 1) };
}
export function respondToOffer(fa, offer, seed) {
  const ask = askFor(fa, seed);
  if (!Number.isInteger(offer?.years) || offer.years < 1 || offer.years > 13 || !Number.isFinite(offer.total) || offer.total <= 0 || offer.total > 1000) return { accepted: false, reason: 'Enter 1–13 whole years and a guaranteed total up to $1,000M.' };
  if (offer.years < ask.minYears) return { accepted: false, reason: `He wants at least ${ask.minYears} years.` };
  if (offer.years > ask.maxYears) return { accepted: false, reason: `That's more years than his camp is asking for; ${ask.maxYears} at most.` };
  if (offer.total / offer.years < MINIMUM_SALARY) return { accepted: false, reason: 'That is below the league minimum.' };
  // Gameplay approximation: another guaranteed year cannot simply dilute AAV
  // while leaving the same asking total. Shorter deals retain the total ask.
  const estimatedYears = Math.max(1, fa?.years ?? 1);
  const required = ask.total * Math.max(1, offer.years / estimatedYears);
  if (offer.total + 1e-9 < required) {
    if (offer.years > estimatedYears && offer.total + 1e-9 >= ask.total) return { accepted: false, reason: `An extra year needs more guaranteed money. At ${offer.years} years, his camp wants at least $${(Math.ceil(required * 10) / 10).toFixed(1)}M total to preserve the annual value.` };
    const gap = required - offer.total;
    return { accepted: false, reason: gap > 0.15 * required ? 'Not close. His camp expects a lot more.' : 'Close, but he wants a bit more money.' };
  }
  return { accepted: true, reason: 'Deal.' };
}

/** A signing needs the player's yes and your ownership's: payroll after the deal can't exceed your budget. */
export function signFreeAgent(ctx, league, moves, budget, fa, offer, seed) {
  const entries = ctx.players.filter(p => p.pid === fa?.id);
  if (!entries.length || !entries.some(p => league.freeAgents.has(p.i)) || (moves.signings ?? []).some(s => s.pid === fa.id)) return { accepted: false, reason: 'That player is not an available free agent.' };
  const answer = respondToOffer(fa, offer, seed);
  if (!answer.accepted) return answer;
  const after = buildLeague(ctx, { ...moves, signings: [...(moves.signings ?? []), { pid: fa.id, years: offer.years, total: offer.total }] });
  const pay = payrollFor(ctx, after, moves.team);
  if (pay > budget + 1e-9) return { accepted: false, reason: `He'd take it, but ownership won't: payroll would be $${pay.toFixed(1)}M, over your $${budget.toFixed(0)}M budget.` };
  return answer;
}

// ---------- league state ----------
/**
 * Build the league after the user's moves.
 * ctx: { players (depth-chart entries), tracker, signings, sim (gm-sim.json), payroll (team-payroll cbt) }
 * moves: { team, signings: [{ pid, years, total }], trades: [{ partner, give: [pid], get: [pid] }] }
 */
export function buildLeague(ctx, moves) {
  const { team: base, freeAgents } = teamsFor(ctx.players, ctx.tracker, ctx.signings.entries ?? ctx.signings);
  const teamOf = new Map(base);
  const fas = new Set(freeAgents);
  const userAav = new Map();
  for (const s of moves.signings ?? []) for (const p of ctx.players.filter(q => q.pid === s.pid)) {
    teamOf.set(p.i, moves.team); fas.delete(p.i); userAav.set(p.pid, s.total / s.years);
  }
  const owner = new Map(); // prospects and anyone not in the depth chart
  for (const [id, v] of Object.entries(ctx.sim.players)) owner.set(id, v.t);
  for (const p of ctx.players) owner.set(p.pid, teamOf.get(p.i) ?? null);
  for (const tr of moves.trades ?? []) {
    for (const pid of tr.give ?? []) { owner.set(pid, tr.partner); for (const p of ctx.players.filter(q => q.pid === pid)) teamOf.set(p.i, tr.partner); }
    for (const pid of tr.get ?? []) { owner.set(pid, moves.team); for (const p of ctx.players.filter(q => q.pid === pid)) teamOf.set(p.i, moves.team); }
  }
  return { base, teamOf, freeAgents: fas, userAav, owner };
}
const faRow = (ctx) => { const m = new Map(ctx.tracker.players.map(r => [r.id, r])); return pid => m.get(pid); };
export const rosterOf = (ctx, teamOf, abbr) => ctx.players.filter(p => teamOf.get(p.i) === abbr);

/** 2027 CBT payroll for a team: the FanGraphs estimate, adjusted for reported signings, departures and every move. */
export function payrollFor(ctx, league, abbr, extraAav = new Map()) {
  const signedOutcome = new Set(['signed', 're-signed', 'extension', 'qo-accepted', 'option-exercised', 'opted-in']);
  const key = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/gi, '').toLowerCase();
  const entries = ctx.signings.entries ?? ctx.signings;
  const signedAav = new Map(entries.filter(s => s.years && s.total_musd != null).map(s => [key(s.player), s.total_musd / s.years]));
  const signed = new Set(ctx.players.filter(p => p.fa && signedOutcome.has(entries.find(s => key(s.player) === key(p.n))?.outcome)).map(p => p.i));
  const fa = faRow(ctx);
  const aav = p => league.userAav.get(p.pid) ?? extraAav.get(p.pid) ?? signedAav.get(key(p.n)) ?? fa(p.pid)?.aav ?? null;
  // Starting point: the FanGraphs estimate plus reported moves (same rule as the depth chart).
  let total = (ctx.payroll.teams[abbr]?.cbt2027 ?? 0) + payrollAdjustment(ctx.players, abbr, league.base, signed, aav);
  const seen = new Set();
  for (const p of ctx.players) {
    if (seen.has(p.pid)) continue;
    const before = league.base.get(p.i) === abbr, after = league.teamOf.get(p.i) === abbr;
    if (before === after) continue;
    seen.add(p.pid);
    const hit = league.userAav.has(p.pid) || extraAav.has(p.pid) ? Math.max(MINIMUM_SALARY, aav(p)) : cbtHit(p, league.freeAgents, aav);
    if (after) total += hit; else if (!p.co || signed.has(p.i)) total -= hit;
  }
  return total;
}

// ---------- trades ----------
export const teamWar = (ctx, teamOf, abbr) => allocate(rosterOf(ctx, teamOf, abbr)).total;
export function teamModes(ctx, teamOf) {
  const totals = Object.keys(ctx.sim.teams).map(t => [t, teamWar(ctx, teamOf, t)]).sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(totals.map(([t], i) => [t, i < 10 ? 'contend' : i >= 20 ? 'rebuild' : 'middle']));
}
const valueKey = { contend: 'v20', middle: 'v10', rebuild: 'v05' };
/** A star: projected for 3.5+ WAR in 2027, or worth $60M+ in surplus value (which covers elite prospects). */
export const isStar = v => (v?.w27 ?? 0) >= 3.5 || (v?.v10 ?? 0) >= 60;
/** Seasons of club control left after 2026. Prospects count as six. */
export const controlYears = v => (v?.k === 'p' ? 6 : v?.ctl == null ? 0 : Math.max(0, v.ctl - 2026));
/**
 * Extra value a team demands, as a share of a star's value, before it will move him. Stars with three or more years of
 * control cost well beyond fair value whatever the team's situation. With two years left, only a team out of contention
 * deals at fair value; with one, a contender still wants a little more.
 */
export function starPremium(v, mode) {
  if (!isStar(v)) return 0;
  const years = controlYears(v);
  if (years >= 4) return 0.8;
  if (years === 3) return 0.5;
  if (years === 2) return mode === 'rebuild' ? 0 : 0.25;
  return mode === 'contend' ? 0.2 : mode === 'middle' ? 0.1 : 0;
}
/** Most 2027 WAR a projected contender will give up in a trade (net of what comes back). */
export const CONTENDER_WAR_LOSS = 0.75;
const NICKNAMES = { WSN: 'Nats', PHI: 'Phillies', ARI: 'D-backs', ATH: "A's" };
/** Short team name for trade replies: "the Nats", "the Red Sox". */
export function nickname(ctx, abbr) {
  if (NICKNAMES[abbr]) return NICKNAMES[abbr];
  const words = (ctx.sim.teams[abbr]?.name ?? abbr).split(' ');
  return ['Sox', 'Jays'].includes(words.at(-1)) ? words.slice(-2).join(' ') : words.at(-1);
}
const pick = (key, lines) => lines[hash(key) % lines.length];
const yearsText = years => `${years >= 6 ? '6+' : years} year${years === 1 ? '' : 's'} of control`;

/**
 * The other team's answer to a proposed trade. They value players at their own discount rate (win-now, market or
 * rebuilding) and need to come out ahead. Stars cost extra by years of control (starPremium), and the team's two most
 * valuable players cost at least 50% extra, unless a rebuilding team has two years of control or fewer left on him. A projected contender won't lose more
 * than CONTENDER_WAR_LOSS of 2027 WAR, which they measure on their own depth chart, so they need MLB-ready talent back
 * unless the player sits at a position where they have depth. Full no-trade clauses are honored. They won't take on
 * salary past their budget, and your ownership won't approve going over yours.
 */
export function respondToTrade(ctx, league, moves, budget, proposal, modes) {
  const { partner, give = [], get = [] } = proposal;
  if (!ctx.sim.teams[partner] || partner === moves.team) return { accepted: false, reason: 'Pick a trade partner.' };
  if (!Array.isArray(give) || !Array.isArray(get) || give.length > 20 || get.length > 20 || new Set([...give, ...get]).size !== give.length + get.length) return { accepted: false, reason: 'Each player can appear only once in a trade.' };
  if (!give.length && !get.length) return { accepted: false, reason: 'Add players to the trade.' };
  const V = ctx.sim.players;
  if ([...give, ...get].some(pid => !V[pid])) return { accepted: false, reason: 'That player is not in this game snapshot.' };
  for (const pid of get) {
    if (V[pid]?.prot === 'full') return { accepted: false, reason: `${V[pid].n} has a full no-trade clause, and he isn't waiving it to go anywhere.` };
    if (league.owner.get(pid) !== partner) return { accepted: false, reason: `${V[pid]?.n ?? pid} isn't on their roster.` };
  }
  for (const pid of give) {
    if (V[pid]?.prot === 'full') return { accepted: false, reason: `${V[pid].n} has a full no-trade clause, and he isn't waiving it to go anywhere.` };
    if (league.owner.get(pid) !== moves.team) return { accepted: false, reason: `${V[pid]?.n ?? pid} isn't on your roster.` };
    if (league.userAav.has(pid)) return { accepted: false, reason: `${V[pid]?.n ?? 'He'} just signed with you and can't be traded yet.` };
  }
  const mode = modes[partner] ?? 'middle', k = valueKey[mode];
  const the = `the ${nickname(ctx, partner)}`, The = `The ${nickname(ctx, partner)}`;
  const key = `${partner}|${give.join(',')}|${get.join(',')}|${moves.seed}`;
  const val = pid => V[pid]?.[k] ?? 0;
  const received = give.reduce((s, pid) => s + val(pid), 0), sent = get.reduce((s, pid) => s + val(pid), 0);
  const theirs = Object.entries(V).filter(([pid]) => league.owner.get(pid) === partner).sort((a, b) => b[1].v10 - a[1].v10).slice(0, 2).map(([pid]) => pid);
  let premium = 0; const stars = [];
  for (const pid of get) {
    let share = starPremium(V[pid], mode);
    const years = controlYears(V[pid]);
    if (theirs.includes(pid) && (years >= 3 || (years === 2 && mode !== 'rebuild'))) share = Math.max(share, 0.5);
    if (V[pid]?.prot === 'partial') share += 0.15;
    if (share > 0) { premium += share * Math.max(0, val(pid)); if (share >= 0.25) stars.push([pid, share]); }
  }
  const need = sent + Math.max(2, 0.1 * Math.abs(sent)) + premium;
  const after = buildLeague(ctx, { ...moves, trades: [...(moves.trades ?? []), proposal] });
  // Salary
  const theirPay = payrollFor(ctx, after, partner), theirBefore = payrollFor(ctx, league, partner);
  const theirBudget = ctx.sim.teams[partner].cbt2026 * 1.02;
  if (theirPay > theirBefore + 0.5 && theirPay > theirBudget) return { accepted: false, reason: `${The} can't take on that much salary. Their owner shut it down before it got to the GM.` };
  const yourPay = payrollFor(ctx, after, moves.team);
  if (yourPay > budget + 1e-9 && yourPay > payrollFor(ctx, league, moves.team) + 0.5) return { accepted: false, reason: `Ownership won't approve it: your payroll would be $${yourPay.toFixed(1)}M, over your $${budget.toFixed(0)}M budget.` };
  // A contender protects its 2027 roster.
  const warLoss = teamWar(ctx, league.teamOf, partner) - teamWar(ctx, after.teamOf, partner);
  if (mode === 'contend' && warLoss > CONTENDER_WAR_LOSS) {
    const lost = warLoss.toFixed(1);
    const reason = pick(key, [
      `${The} are trying to win in 2027, and this deal costs them ${lost} WAR. They want MLB-ready help back, not a pile of prospects, unless he plays a position where they have depth.`,
      `Not in the middle of a pennant race. Losing ${lost} WAR off the 2027 roster is a dealbreaker for ${the}. They want MLB-ready help back, not just prospects.`,
      `${The} GM can't sell this to a clubhouse that expects to play in October. It costs them ${lost} WAR in 2027; they want MLB-ready help back, not just prospects.`,
    ]);
    return { accepted: false, reason, received, need, warLoss };
  }
  const modeText = mode === 'contend' ? "They're a projected contender and care most about 2027." : mode === 'rebuild' ? "They're projected to miss the playoffs and weigh the future more." : '';
  if (received + 1e-9 < need) {
    const short = need - received;
    stars.sort((x, y) => y[1] - x[1]);
    let starText = '';
    if (stars.length) {
      const [[pid, share], ...rest] = stars, name = V[pid].n, yrs = yearsText(controlYears(V[pid]));
      starText = share >= 0.5 ? pick(`${key}|star`, [
        `${The} say no way in hell are they trading ${name} with ${yrs} left. He'd take well beyond fair value.`,
        `${The} GM laughed and hung up. With ${yrs} left, ${name} would take well beyond fair value.`,
        `"Not a chance." ${The} aren't moving ${name} with ${yrs} left for anything short of well beyond fair value.`,
        `${The} asked if you'd lost your mind. ${name} has ${yrs} left, so it would take well beyond fair value.`,
      ]) : pick(`${key}|star`, [
        `${The} like ${name} more than that. With ${yrs} left, he'd take more than fair value.`,
        `${The} aren't giving ${name} away with ${yrs} left. They want more than fair value.`,
      ]);
      for (const [other, otherShare] of rest) starText += ` ${V[other].n} has ${yearsText(controlYears(V[other]))} left too, so he'd take ${otherShare >= 0.5 ? 'well beyond' : 'more than'} fair value.`;
    } else if (short > 0.4 * Math.max(need, 1)) {
      starText = pick(key, [
        `${The} didn't even counter.`,
        `Thanks, but no thanks, say ${the}.`,
        `${The} GM read your offer twice to make sure it wasn't a typo. Pass.`,
      ]);
    } else {
      starText = pick(key, [
        `${The} are tempted, but they want a little more.`,
        `So close. ${The} want one more piece.`,
        `${The} counter: add a bit more and you've got a deal.`,
      ]);
    }
    return { accepted: false, reason: `${starText} ${modeText}`.trim(), received, need, warLoss };
  }
  return { accepted: true, reason: `${pick(`${key}|yes`, [`Deal! ${The} accept.`, `${The} shake on it.`, `Done deal. ${The} accept.`])} ${modeText}`.trim(), received, need, warLoss };
}

// ---------- AI free agency ----------
/**
 * The other 29 teams sign the remaining free agents, most expensive first. Each goes to the team that gains the most
 * WAR per dollar among those with budget room, at his asking price. Players our estimate prices at the minimum stay
 * unsigned. Returns the signings and the updated league.
 */
export function aiFreeAgency(ctx, league, moves, seed) {
  const fa = faRow(ctx);
  const teamOf = new Map(league.teamOf), extra = new Map(), signings = [];
  const pool = [...league.freeAgents].map(i => ctx.players.find(p => p.i === i)).filter(p => p && fa(p.pid)?.aav >= 1)
    .sort((a, b) => (fa(b.pid).total ?? 0) - (fa(a.pid).total ?? 0));
  const teams = Object.keys(ctx.sim.teams).filter(t => t !== moves.team);
  const pay = Object.fromEntries(teams.map(t => [t, payrollFor(ctx, league, t)]));
  const war = Object.fromEntries(teams.map(t => [t, teamWar(ctx, teamOf, t)]));
  const rand = rng(hash(`${seed}:ai`));
  const done = new Set();
  for (const p of pool) {
    if (done.has(p.pid)) continue;
    const row = fa(p.pid), ask = askFor(row, seed), aav = ask.total / row.years;
    let best = null;
    for (const t of teams) {
      const room = ctx.sim.teams[t].cbt2026 * 1.02 - pay[t];
      if (aav > room) continue;
      const entries = ctx.players.filter(q => q.pid === p.pid);
      const gain = allocate([...rosterOf(ctx, teamOf, t), ...entries]).total - war[t];
      if (gain < 0.3) continue;
      const score = gain * 11 - aav + 3 * normal(rand);   // surplus per year, with taste
      if (!best || score > best.score) best = { t, gain, score };
    }
    if (!best) continue;
    for (const q of ctx.players.filter(q => q.pid === p.pid)) teamOf.set(q.i, best.t);
    extra.set(p.pid, aav); pay[best.t] += aav; war[best.t] = teamWar(ctx, teamOf, best.t); done.add(p.pid);
    signings.push({ pid: p.pid, name: p.n, team: best.t, years: row.years, total: ask.total });
  }
  const freeAgents = new Set([...league.freeAgents].filter(i => !done.has(ctx.players.find(p => p.i === i)?.pid)));
  return { league: { ...league, teamOf, freeAgents, extraAav: extra }, signings };
}

// ---------- season ----------
// Uncertainty per player in WAR per 600 PA or 180 IP (talent plus performance, including playing-time surprises). With
// typical rosters this gives a team spread of about 6 wins; with luck, about 7.3 wins in all, in line with the 7-8 win
// errors of preseason team projections.
export const PERFORMANCE_SD = 1.7;
export const LUCK_SD = 4.0;          // wins: sequencing and run-differential luck
/** Expected WAR and its uncertainty for every team. */
export function teamStrengths(ctx, teamOf) {
  const out = {};
  for (const t of Object.keys(ctx.sim.teams)) {
    const a = allocate(rosterOf(ctx, teamOf, t));
    // One player's performance uncertainty follows him between positions.
    // Hitting and pitching entries for a two-way player remain separate components.
    const workloads = new Map();
    for (const slot of Object.values(a.positions)) for (const r of slot.rows) workloads.set(r.p.i, (workloads.get(r.p.i) ?? 0) + r.pt / unitOf(r.p));
    const v = [...workloads.values()].reduce((sum, workload) => sum + (PERFORMANCE_SD * workload) ** 2, 0);
    out[t] = { war: a.total, sd: Math.sqrt(v) };
  }
  return out;
}
function series(p, wins, rand) {
  let a = 0, b = 0;
  while (a < wins && b < wins) { if (rand() < p) a++; else b++; }
  return a === wins;
}
const log5 = (a, b) => (a - a * b) / (a + b - 2 * a * b);
/**
 * Simulate n seasons. Wins = 81 + (team WAR - league mean) + performance noise + luck, recentred to 81 per season.
 * Playoffs: three division winners and three wild cards per league; the top two division winners get byes; wild-card
 * series best of three, then best of five, seven and seven. Uses the same random draws for any league passed with the
 * same seed, so two versions of the league can be compared season by season.
 */
export function simulateSeasons(ctx, strengths, n = 10000, seed = 1) {
  const teams = Object.keys(ctx.sim.teams), T = teams.length;
  const meanWar = teams.reduce((s, t) => s + strengths[t].war, 0) / T;
  const res = Object.fromEntries(teams.map(t => [t, { wins: new Float64Array(n), division: 0, playoffs: 0, pennant: 0, title: 0 }]));
  const byLeague = { AL: teams.filter(t => ctx.sim.teams[t].league === 'AL'), NL: teams.filter(t => ctx.sim.teams[t].league === 'NL') };
  const divisions = [...new Set(teams.map(t => ctx.sim.teams[t].division))];
  for (let s = 0; s < n; s++) {
    // Playoff lengths must not shift next season's regular-season draws when
    // comparing an edited roster with standing pat.
    const rand = rng(hash(`${seed}:season:${s}:regular`));
    const playoffRand = rng(hash(`${seed}:season:${s}:playoffs`));
    const talent = {}, wins = {};
    let total = 0;
    for (const t of teams) {
      talent[t] = 81 + strengths[t].war - meanWar + strengths[t].sd * normal(rand);
      wins[t] = talent[t] + LUCK_SD * normal(rand) + 0.001 * rand();
      total += wins[t];
    }
    const shift = 81 - total / T;
    for (const t of teams) { wins[t] = Math.max(30, Math.min(132, wins[t] + shift)); res[t].wins[s] = wins[t]; talent[t] += shift; }
    const champs = {};
    for (const lg of ['AL', 'NL']) {
      const divWinners = divisions.filter(d => d.startsWith(lg)).map(d => teams.filter(t => ctx.sim.teams[t].division === d).sort((a, b) => wins[b] - wins[a])[0]);
      for (const t of divWinners) res[t].division++;
      const dw = divWinners.sort((a, b) => wins[b] - wins[a]);
      const wc = byLeague[lg].filter(t => !dw.includes(t)).sort((a, b) => wins[b] - wins[a]).slice(0, 3);
      const seeds = [...dw, ...wc];
      for (const t of seeds) res[t].playoffs++;
      const pct = t => Math.max(0.25, Math.min(0.75, talent[t] / 162));
      const play = (a, b, w) => (series(log5(pct(a), pct(b)), w, playoffRand) ? a : b);
      const w36 = play(seeds[2], seeds[5], 2), w45 = play(seeds[3], seeds[4], 2);
      const d1 = play(seeds[0], w45, 3), d2 = play(seeds[1], w36, 3);
      champs[lg] = play(d1, d2, 4); res[champs[lg]].pennant++;
    }
    res[play2(champs.AL, champs.NL)].title++;
    function play2(a, b) { const pa = Math.max(0.25, Math.min(0.75, talent[a] / 162)), pb = Math.max(0.25, Math.min(0.75, talent[b] / 162)); return series(log5(pa, pb), 4, playoffRand) ? a : b; }
  }
  const summary = {};
  for (const t of teams) {
    const w = Array.from(res[t].wins).sort((a, b) => a - b), q = f => w[Math.min(n - 1, Math.floor(f * n))];
    summary[t] = { mean: w.reduce((a, b) => a + b, 0) / n, p10: q(0.1), p50: q(0.5), p90: q(0.9), division: res[t].division / n, playoffs: res[t].playoffs / n, pennant: res[t].pennant / n, title: res[t].title / n };
  }
  return summary;
}

// ---------- grading ----------
/** Net future value of the user's moves in $M: trade surplus gained at market value, plus FA contracts below our estimate. */
export function movesValue(ctx, moves) {
  const V = ctx.sim.players, fa = faRow(ctx);
  let trades = 0, signings = 0;
  for (const tr of moves.trades ?? []) trades += (tr.get ?? []).reduce((s, pid) => s + (V[pid]?.v10 ?? 0), 0) - (tr.give ?? []).reduce((s, pid) => s + (V[pid]?.v10 ?? 0), 0);
  for (const s of moves.signings ?? []) { const r = fa(s.pid); if (r?.total != null) signings += r.total - s.total; }
  return { trades, signings, total: trades + signings };
}
export function grade(deltaWins, netValue) {
  const points = deltaWins + netValue / 25;
  const letter = points >= 6 ? 'A' : points >= 3.5 ? 'B+' : points >= 2 ? 'B' : points >= 0.5 ? 'C+' : points >= -0.5 ? 'C' : points >= -2 ? 'D' : 'F';
  return { points, letter };
}

// ---------- sharing ----------
export function encodeMoves(moves) {
  const json = JSON.stringify(moves);
  const b = typeof Buffer !== 'undefined' ? Buffer.from(json, 'utf8').toString('base64') : btoa(unescape(encodeURIComponent(json)));
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeMoves(text) {
  try {
    if (typeof text !== 'string' || text.length > 100000) return null;
    const b = text.replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof Buffer !== 'undefined' ? Buffer.from(b, 'base64').toString('utf8') : decodeURIComponent(escape(atob(b)));
    const m = JSON.parse(json);
    if (!m || typeof m.team !== 'string' || !/^[A-Z]{2,3}$/.test(m.team)) return null;
    if (m.budget != null && (!Number.isFinite(m.budget) || m.budget < 60 || m.budget > 480)) return null;
    if (!Number.isInteger(m.seed) || m.seed < 1 || m.seed > 0xffffffff) return null;
    if (!Array.isArray(m.signings) || !Array.isArray(m.trades) || m.signings.length > 100 || m.trades.length > 100) return null;
    const pid = id => typeof id === 'string' && id.length > 0 && id.length <= 100;
    if (m.signings.some(s => !s || !pid(s.pid) || !Number.isInteger(s.years) || s.years < 1 || s.years > 13 || !Number.isFinite(s.total) || s.total <= 0 || s.total > 1000)) return null;
    if (new Set(m.signings.map(s => s.pid)).size !== m.signings.length) return null;
    if (m.trades.some(t => !t || typeof t.partner !== 'string' || !/^[A-Z]{2,3}$/.test(t.partner) || !Array.isArray(t.give) || !Array.isArray(t.get) || t.give.length > 20 || t.get.length > 20 || !t.give.every(pid) || !t.get.every(pid) || !t.give.length && !t.get.length || new Set([...t.give, ...t.get]).size !== t.give.length + t.get.length)) return null;
    return { team: m.team, budget: m.budget ?? null, seed: m.seed, signings: m.signings.map(({ pid, years, total }) => ({ pid, years, total })), trades: m.trades.map(({ partner, give, get }) => ({ partner, give, get })) };
  } catch { return null; }
}

/** Validate a shared game against this snapshot before it can render or auto-run. */
export function restoreMoves(ctx, candidate) {
  const moves = decodeMoves(encodeMoves(candidate));
  if (!moves || !ctx.sim.teams[moves.team]) return { moves: null, reason: 'This saved offseason has invalid game data.' };
  const current = { ...moves, signings: [], trades: [] };
  // The original format stores signing and trade lists separately, so their
  // interleaved chronology is unknown. Check structural legality, not a new
  // sequence of budget/valuation decisions that could reject a valid save.
  for (const signing of moves.signings) {
    const row = ctx.tracker.players.find(r => r.id === signing.pid);
    const league = buildLeague(ctx, current);
    const answer = signFreeAgent(ctx, league, current, Infinity, row, signing, moves.seed);
    if (!answer.accepted) return { moves: null, reason: `This saved signing no longer works with this snapshot: ${answer.reason}` };
    current.signings.push(signing);
  }
  for (const proposal of moves.trades) {
    const league = buildLeague(ctx, current);
    if (!ctx.sim.teams[proposal.partner] || proposal.partner === moves.team) return { moves: null, reason: 'This saved trade has an invalid partner.' };
    if ([...proposal.give, ...proposal.get].some(pid => !ctx.sim.players[pid] || ctx.sim.players[pid].prot === 'full')) return { moves: null, reason: 'This saved trade includes an unavailable or no-trade-protected player.' };
    if (proposal.give.some(pid => league.owner.get(pid) !== moves.team || league.userAav.has(pid)) || proposal.get.some(pid => league.owner.get(pid) !== proposal.partner)) return { moves: null, reason: 'This saved trade includes a player who is not on the required roster.' };
    current.trades.push(proposal);
  }
  const league = buildLeague(ctx, current);
  if (Object.keys(ctx.sim.teams).some(team => !Number.isFinite(payrollFor(ctx, league, team)))) return { moves: null, reason: 'This saved offseason has invalid payroll data.' };
  return { moves: current };
}

/** Undo a move and remove later trades that depended on the deleted acquisition. */
export function undoMove(ctx, moves, kind, index) {
  const next = {
    ...moves,
    signings: kind === 'signing' ? moves.signings.filter((_, i) => i !== index) : [...moves.signings],
    trades: [],
  };
  let removed = 1;
  for (const [i, proposal] of moves.trades.entries()) {
    if (kind === 'trade' && i === index) continue;
    const league = buildLeague(ctx, next);
    if (proposal.give.some(pid => league.owner.get(pid) !== moves.team) || proposal.get.some(pid => league.owner.get(pid) !== proposal.partner)) { removed++; continue; }
    next.trades.push(proposal);
  }
  return { moves: next, removed };
}
