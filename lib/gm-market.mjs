// A three-round, seeded free-agent market. These are game behaviors, not reports.
import { allocate } from './depth-chart.mjs';
import { aiFreeAgency, askFor, buildLeague, hash, payrollFor, respondToOffer, rosterOf, teamModes } from './gm-sim.mjs';

export const MARKET_ROUNDS = 3;
const draw = key => hash(key) / 0xffffffff;
const cents = n => Math.round(n * 10) / 10;
export const newMarket = () => ({ round: 0, bids: [], deals: [], offers: [] });
const preference = (seed, pid) => draw(`${seed}:${pid}:preference`) < .5 ? 'role' : 'contend';
const deadline = (seed, pid) => 1 + hash(`${seed}:${pid}:deadline`) % MARKET_ROUNDS;
const requiredTotal = (row, years, seed) => askFor(row, seed).total * Math.max(1, years / Math.max(1, row.years ?? 1));

// Money drives at least 94% of offer utility. Fit is a small, disclosed tie-breaker.
function utility(ctx, league, modes, moves, row, team, offer) {
  const entries = ctx.players.filter(p => p.pid === row.id);
  const before = allocate(rosterOf(ctx, league.teamOf, team)).total;
  const gain = Math.max(0, allocate([...rosterOf(ctx, league.teamOf, team), ...entries]).total - before);
  const fit = preference(moves.seed, row.id) === 'role'
    ? Math.min(1, gain / Math.max(.5, row.war2027 ?? 1))
    : modes[team] === 'contend' ? 1 : modes[team] === 'middle' ? .5 : 0;
  // Extra years must preserve AAV; shorter deals do not get a free utility boost.
  return offer.total * (1 + .06 * fit);
}

/** Every rival chooses ONE current target. Its whole offer is reserved until the round resolves. */
export function marketBoard(ctx, moves) {
  if (!moves.market || moves.market.round >= MARKET_ROUNDS) return [];
  const league = buildLeague(ctx, moves), modes = teamModes(ctx, league.teamOf);
  const available = new Set(ctx.players.filter(p => league.freeAgents.has(p.i)).map(p => p.pid));
  const rows = ctx.tracker.players.filter(r => available.has(r.id));
  const entries = new Map(rows.map(r => [r.id, ctx.players.filter(p => p.pid === r.id)]));
  const targets = new Map(rows.map(row => [row.id, { pid: row.id, preference: preference(moves.seed, row.id), deadline: deadline(moves.seed, row.id), rivals: [] }]));
  for (const team of Object.keys(ctx.sim.teams).filter(t => t !== moves.team)) {
    const room = ctx.sim.teams[team].cbt2026 * 1.02 - payrollFor(ctx, league, team);
    const roster = rosterOf(ctx, league.teamOf, team), war = allocate(roster).total;
    let best = null;
    for (const row of rows) {
      if ((row.aav ?? 0) < 1) continue;
      const years = Math.max(1, row.years ?? 1), ask = requiredTotal(row, years, moves.seed);
      const gain = allocate([...roster, ...entries.get(row.id)]).total - war;
      if (gain < .3) continue;
      const taste = .94 + .12 * draw(`${moves.seed}:${row.id}:${team}:taste`);
      const willingness = Math.min((row.aav ?? 1) * 1.35, (gain * (modes[team] === 'contend' ? 14 : 11) + 5) * taste);
      const ceiling = Math.floor(Math.min(room, willingness) * years * 10) / 10;
      if (ceiling < ask) continue;
      const score = gain * (modes[team] === 'contend' ? 14 : 11) - ask / years + 2 * draw(`${moves.seed}:${row.id}:${team}:priority`);
      if (score <= 0 || (best && best.score >= score)) continue;
      const previous = moves.market.offers?.find(o => o.pid === row.id && o.team === team)?.total ?? 0;
      const opening = Math.min(ceiling, Math.max(previous, cents(ask * (1 + .035 * moves.market.round + .04 * draw(`${moves.seed}:${row.id}:${team}:opening`)))));
      best = { pid: row.id, team, years, total: opening, ceiling, score, gain };
    }
    if (best) targets.get(best.pid).rivals.push(best);
  }
  return [...targets.values()];
}

export function submitMarketBid(ctx, moves, bid) {
  if (!moves.market || moves.market.round >= MARKET_ROUNDS) return { accepted: false, reason: 'The bidding rounds have ended.' };
  const league = buildLeague(ctx, moves), row = ctx.tracker.players.find(r => r.id === bid.pid);
  if (!row || !ctx.players.some(p => p.pid === bid.pid && league.freeAgents.has(p.i))) return { accepted: false, reason: 'That player is no longer available.' };
  const ask = askFor(row, moves.seed);
  if (!Number.isInteger(bid.years) || bid.years < ask.minYears || bid.years > ask.maxYears || !Number.isFinite(bid.total) || bid.total > 1000 || bid.total / bid.years < .8) return { accepted: false, reason: `Offer ${ask.minYears}–${ask.maxYears} whole years, at least $0.8M per year, and no more than $1,000M total.` };
  const bids = [...moves.market.bids.filter(b => b.pid !== bid.pid), bid];
  const reserve = bids.reduce((sum, b) => sum + b.total / b.years, 0);
  const room = (moves.budget ?? Math.round(ctx.sim.teams[moves.team].cbt2026)) - payrollFor(ctx, league, moves.team);
  const warning = reserve > room + 1e-9 ? ` If all pending offers land, you must clear $${(reserve - room).toFixed(1)}M before simulating the season.` : '';
  return { accepted: true, reason: `Offer submitted. It is not a signing until the player decides.${warning}`, moves: { ...moves, market: { ...moves.market, bids } } };
}

/** Rival replies have hard ceilings; each team can land at most one player per round. */
export function advanceMarket(ctx, moves) {
  if (!moves.market || moves.market.round >= MARKET_ROUNDS) return { moves, news: [] };
  const round = moves.market.round + 1, board = marketBoard(ctx, moves);
  const next = { ...moves, signings: [...moves.signings], market: { ...moves.market, round, bids: [...moves.market.bids], deals: [...moves.market.deals], offers: [] } };
  const news = [];
  for (const item of board) {
    const row = ctx.tracker.players.find(r => r.id === item.pid);
    const userBid = next.market.bids.find(b => b.pid === item.pid);
    if (!userBid && !item.rivals.length) continue;
    const league = buildLeague(ctx, next), modes = teamModes(ctx, league.teamOf);
    // The user may clear salary later; enforce the target at season readiness.
    const credibleUserBid = userBid && respondToOffer(row, userBid, moves.seed).accepted;
    const opening = item.rivals.map(r => ({ team: r.team, years: r.years, total: r.total }));
    if (credibleUserBid) opening.push({ ...userBid, team: moves.team });
    const fit = new Map(opening.map(o => [o.team, utility(ctx, league, modes, moves, row, o.team, { ...o, total: 1 })]));
    const leadingScore = Math.max(0, ...opening.map(o => o.total * fit.get(o.team)));
    // Simultaneous, bounded responses to the market, not an omniscient auction
    // that always beats the human by 1.5%. A club may stand on its offer.
    const offers = item.rivals.map(r => {
      let total = r.total;
      const ownFit = fit.get(r.team);
      const reaction = draw(`${moves.seed}:${row.id}:${r.team}:${round}:respond`);
      if (r.total * ownFit < leadingScore && reaction < .65) {
        const step = .02 + .04 * draw(`${moves.seed}:${row.id}:${r.team}:${round}:raise`);
        total = Math.min(r.ceiling, cents(r.total * (1 + step)), cents(leadingScore / ownFit * 1.01));
      }
      return { team: r.team, years: r.years, total };
    });
    if (credibleUserBid) offers.push({ ...userBid, team: moves.team });
    const eligible = offers.filter(o => respondToOffer(row, o, moves.seed).accepted);
    eligible.sort((a, b) => utility(ctx, league, modes, moves, row, b.team, b) - utility(ctx, league, modes, moves, row, a.team, a) || a.team.localeCompare(b.team));
    const best = eligible[0];
    if (round < item.deadline) {
      next.market.offers.push(...offers.filter(o => o.team !== moves.team).map(o => ({ pid: row.id, team: o.team, years: o.years, total: o.total })));
      if (userBid) news.push(`${row.name} is still listening. ${best?.team === moves.team ? 'Your offer is in front, but nothing is agreed.' : best ? `${ctx.sim.teams[best.team].name} are ahead; your offer needs work.` : 'His camp is looking for more guaranteed money.'} Decision expected in round ${item.deadline}.`);
      continue;
    }
    if (best) {
      if (best.team === moves.team) next.signings.push({ pid: row.id, years: best.years, total: best.total });
      else next.market.deals.push({ pid: row.id, team: best.team, years: best.years, total: best.total, round });
      next.market.bids = next.market.bids.filter(b => b.pid !== row.id);
      const reason = userBid ? !respondToOffer(row, userBid, moves.seed).accepted ? 'Your offer did not meet his contract requirements.' : best.total > userBid.total ? 'Their higher guarantee beat your offer.' : `His preference for ${item.preference === 'role' ? 'playing opportunity' : 'contention'} tipped the decision.` : 'Off the board.';
      news.push(`${row.name} signed with ${ctx.sim.teams[best.team].name}: ${best.years} ${best.years === 1 ? 'year' : 'years'}, $${best.total.toFixed(1)}M. ${best.team === moves.team ? 'You got him.' : reason}`);
    } else if (userBid) news.push(`${row.name} has not accepted. His camp wants more guaranteed money.`);
  }
  if (round === MARKET_ROUNDS) {
    next.market.bids = [];
    // Resolve the remaining market visibly, using budgets after every won bid.
    // Otherwise three crowded auctions would leave most MLB free agents unsigned.
    const cleanup = aiFreeAgency(ctx, buildLeague(ctx, next), next, moves.seed);
    for (const deal of cleanup.signings) {
      next.market.deals.push({ pid: deal.pid, team: deal.team, years: deal.years, total: deal.total, round });
      news.push(`Late signing: ${deal.name} to ${ctx.sim.teams[deal.team].name}, ${deal.years} ${deal.years === 1 ? 'year' : 'years'}, $${deal.total.toFixed(1)}M.`);
    }
  }
  return { moves: next, news };
}

export function standingPatMarket(ctx, moves) {
  let baseline = { team: moves.team, budget: moves.budget, seed: moves.seed, signings: [], trades: [], market: newMarket() };
  for (let i = 0; i < MARKET_ROUNDS; i++) baseline = advanceMarket(ctx, baseline).moves;
  return baseline;
}
