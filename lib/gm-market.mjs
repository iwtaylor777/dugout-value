// A three-round, seeded free-agent market. These are game behaviors, not reports.
import { allocate } from './depth-chart.mjs';
import { aiFreeAgency, askFor, buildLeague, closeoutMinimumAav, hash, payrollFor, respondToOffer, requiredOfferTotal, rivalBudget, rosterOf, openingTeamModes, MAX_RIVAL_MLB_SIGNINGS } from './gm-sim.mjs';

export const MARKET_ROUNDS = 3;
const draw = key => hash(key) / 0xffffffff;
const cents = n => Math.round(n * 10) / 10;
export const newMarket = () => ({ round: 0, bids: [], deals: [], offers: [], history: [], invites: [] });
const offerHistory = moves => moves.market.history ?? [...moves.signings, ...moves.market.bids].map(b => ({ pid: b.pid, years: b.years, total: b.total, round: Math.max(1, moves.market.round) }));
const preference = (seed, pid) => draw(`${seed}:${pid}:preference`) < .5 ? 'role' : 'contend';
const deadline = (seed, pid) => 1 + hash(`${seed}:${pid}:deadline`) % MARKET_ROUNDS;
const requiredTotal = requiredOfferTotal;

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
  const league = buildLeague(ctx, moves), modes = openingTeamModes(ctx);
  const available = new Set(ctx.players.filter(p => league.freeAgents.has(p.i)).map(p => p.pid));
  const rows = ctx.tracker.players.filter(r => available.has(r.id));
  const entries = new Map(rows.map(r => [r.id, ctx.players.filter(p => p.pid === r.id)]));
  const targets = new Map(rows.map(row => [row.id, { pid: row.id, preference: preference(moves.seed, row.id), deadline: deadline(moves.seed, row.id), rivals: [] }]));
  for (const team of Object.keys(ctx.sim.teams).filter(t => t !== moves.team)) {
    if (moves.market.deals.filter(d => d.team === team).length >= MAX_RIVAL_MLB_SIGNINGS) continue;
    const plan = rivalBudget(ctx, league, team, moves.seed);
    const room = plan.faLimit - plan.payroll;
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
  bid = { pid: bid.pid, years: bid.years, total: bid.total };
  if (!moves.market || moves.market.round >= MARKET_ROUNDS) return { accepted: false, reason: 'The bidding rounds have ended.' };
  const league = buildLeague(ctx, moves), row = ctx.tracker.players.find(r => r.id === bid.pid);
  if (!row || !ctx.players.some(p => p.pid === bid.pid && league.freeAgents.has(p.i))) return { accepted: false, reason: 'That player is no longer available.' };
  const ask = askFor(row, moves.seed);
  const minYears = moves.market.round === MARKET_ROUNDS - 1 ? 1 : ask.minYears;
  if (!Number.isInteger(bid.years) || bid.years < minYears || bid.years > ask.maxYears || !Number.isFinite(bid.total) || bid.total > 1000 || bid.total / bid.years < .8) return { accepted: false, reason: `Offer ${minYears}–${ask.maxYears} whole years, at least $0.8M per year, and no more than $1,000M total.` };
  const bids = [...moves.market.bids.filter(b => b.pid !== bid.pid), bid];
  if (moves.signings.length + bids.length > MAX_RIVAL_MLB_SIGNINGS) return { accepted: false, reason: 'Keep signed players plus pending offers to 12 MLB signings. Withdraw a bid or undo a signing first.' };
  const reserve = bids.reduce((sum, b) => sum + b.total / b.years, 0);
  const room = (moves.budget ?? Math.round(ctx.sim.teams[moves.team].cbt2026)) - payrollFor(ctx, league, moves.team);
  const warning = reserve > room + 1e-9 ? ` If all pending offers land, you must clear $${(reserve - room).toFixed(1)}M before simulating the season.` : '';
  const history = [...offerHistory(moves).filter(h => h.pid !== bid.pid), { ...bid, round: moves.market.round + 1 }];
  const low = bid.total / bid.years < closeoutMinimumAav(row, bid.years, moves.seed) ? ' This is below a credible final-market offer; his camp is unlikely to consider it. You can revise before advancing.' : '';
  return { accepted: true, reason: `Offer submitted. It is not a signing until the player decides.${low}${warning}`, moves: { ...moves, market: { ...moves.market, bids, history } } };
}

/** Resolve each user's latest offer from the actual ledger, including late closeout deals. */
export function userOfferOutcomes(ctx, moves) {
  if (!moves.market) return [];
  const history = offerHistory(moves);
  const league = buildLeague(ctx, moves), modes = openingTeamModes(ctx);
  return history.map(offer => {
    const signed = moves.signings.find(s => s.pid === offer.pid);
    const rival = moves.market.deals.find(s => s.pid === offer.pid);
    const pending = moves.market.bids.some(s => s.pid === offer.pid);
    const invite = moves.market.invites?.find(s => s.pid === offer.pid) ?? null;
    const status = offer.undone ? 'undone' : offer.withdrawn ? 'withdrawn' : signed ? 'signed' : rival ? 'lost' : invite ? 'minor' : pending ? (moves.market.round < offer.round ? 'submitted' : 'pending') : 'unsigned';
    const row = ctx.tracker.players.find(r => r.id === offer.pid);
    const reason = status === 'pending' ? (respondToOffer(row, offer, moves.seed).accepted ? 'Still considering offers. Your bid carries into the next round.' : 'His camp wants a stronger offer. You can revise or withdraw it.') : status === 'unsigned' ? 'The market closed without a signing. Your offer was not accepted.' : '';
    let standing = '';
    if (status === 'pending') {
      const response = respondToOffer(row, offer, moves.seed);
      if (!response.accepted) standing = response.reason;
      else {
        const score = utility(ctx, league, modes, moves, row, moves.team, offer);
        const ahead = (moves.market.offers ?? []).filter(o => o.pid === offer.pid).some(o => utility(ctx, league, modes, moves, row, o.team, o) > score + 1e-8);
        standing = ahead ? 'A rival offer is ahead. Improve your terms or keep this as a fallback bid.' : 'Your offer is in front. You can hold your terms while he decides.';
      }
    }
    return { offer, status, deal: signed ? { ...signed, team: moves.team } : rival ?? null, invite, reason, standing, decisionRound: pending ? Math.max(moves.market.round + 1, deadline(moves.seed, offer.pid)) : null };
  }).sort((a, b) => b.offer.round - a.offer.round || a.offer.pid.localeCompare(b.offer.pid));
}

export function withdrawMarketBid(moves, pid) {
  return { ...moves, market: { ...moves.market, bids: moves.market.bids.filter(b => b.pid !== pid), history: offerHistory(moves).map(h => h.pid === pid ? { ...h, withdrawn: true } : h) } };
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
    const league = buildLeague(ctx, next), modes = openingTeamModes(ctx);
    // The user may clear salary later; enforce the target at season readiness.
    const userResponse = userBid ? respondToOffer(row, userBid, moves.seed) : null;
    const credibleUserBid = userResponse?.accepted && next.signings.length < MAX_RIVAL_MLB_SIGNINGS;
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
      if (userBid) news.push(`${row.name} is still listening. ${!userResponse.accepted ? userResponse.reason : best?.team === moves.team ? 'Your offer is in front, but nothing is agreed.' : best ? `${ctx.sim.teams[best.team].name} are ahead; your offer needs work.` : 'His camp is considering the offer.'} Decision expected in round ${item.deadline}.`);
      continue;
    }
    if (best) {
      if (best.team === moves.team) next.signings.push({ pid: row.id, years: best.years, total: best.total });
      else next.market.deals.push({ pid: row.id, team: best.team, years: best.years, total: best.total, round });
      next.market.bids = next.market.bids.filter(b => b.pid !== row.id);
      const reason = userBid ? !userResponse.accepted ? userResponse.reason : best.total > userBid.total ? 'Their higher guarantee beat your offer.' : `His preference for ${item.preference === 'role' ? 'playing opportunity' : 'contention'} tipped the decision.` : 'Off the board.';
      news.push(`${row.name} signed with ${ctx.sim.teams[best.team].name}: ${best.years} ${best.years === 1 ? 'year' : 'years'}, $${best.total.toFixed(1)}M. ${best.team === moves.team ? 'You got him.' : reason}`);
    } else if (userBid) news.push(`${row.name} has not accepted. ${userResponse.reason}`);
  }
  if (round === MARKET_ROUNDS) {
    // Resolve the remaining market visibly, using budgets after every won bid.
    // Otherwise three crowded auctions would leave most MLB free agents unsigned.
    const cleanup = aiFreeAgency(ctx, buildLeague(ctx, next), next, moves.seed);
    for (const deal of cleanup.signings) {
      next.market.deals.push({ pid: deal.pid, team: deal.team, years: deal.years, total: deal.total, round });
      news.push(`Late signing: ${deal.name} to ${ctx.sim.teams[deal.team].name}, ${deal.years} ${deal.years === 1 ? 'year' : 'years'}, $${deal.total.toFixed(1)}M.`);
    }
    // The asking price is an opening position, not a permanent reserve price.
    // Reprice unfilled demand after regular negotiations, best players first.
    const remaining = ctx.tracker.players.filter(row => ctx.players.some(p => p.pid === row.id && cleanup.league.freeAgents.has(p.i)))
      .sort((a, b) => (b.aav ?? .8) - (a.aav ?? .8) || a.id.localeCompare(b.id));
    const closingLeague = buildLeague(ctx, next);
    const clubs = Object.keys(ctx.sim.teams);
    const rosters = Object.fromEntries(clubs.map(t => [t, rosterOf(ctx, closingLeague.teamOf, t)]));
    const payroll = Object.fromEntries(clubs.map(t => [t, payrollFor(ctx, closingLeague, t)]));
    const plans = Object.fromEntries(clubs.map(t => [t, rivalBudget(ctx, closingLeague, t, moves.seed)]));
    const counts = Object.fromEntries(clubs.map(t => [t, next.market.deals.filter(d => d.team === t).length]));
    const war = Object.fromEntries(clubs.map(t => [t, allocate(rosters[t]).total]));
    for (const row of remaining) {
      const modes = openingTeamModes(ctx);
      const fit = new Map();
      const entries = ctx.players.filter(p => p.pid === row.id);
      const askAav = askFor(row, moves.seed).total / Math.max(1, row.years ?? 1);
      const offers = [];
      for (const team of clubs.filter(t => t !== moves.team)) {
        if (counts[team] >= MAX_RIVAL_MLB_SIGNINGS) continue;
        const plan = plans[team];
        // Minimum-salary depth can dip into the planning reserve, but not
        // consume the last $5M reserved for trades and in-season moves.
        const ordinaryRoom = plan.faLimit - payroll[team];
        const depthRoom = plan.limit - 5 - payroll[team];
        const minimumDepth = closeoutMinimumAav(row, 1, moves.seed) <= .8;
        const room = ordinaryRoom >= .8 ? ordinaryRoom : minimumDepth && depthRoom >= .8 ? .8 : ordinaryRoom;
        if (room < .8) continue;
        const proposed = allocate([...rosters[team], ...entries]);
        const gain = proposed.total - war[team];
        const playingTime = Object.values(proposed.positions).flatMap(p => p.rows).filter(r => r.p.pid === row.id).reduce((n,r) => n+r.pt,0);
        if (gain < .1 || playingTime < (entries[0]?.k === 'p' ? 15 : 80)) continue;
        fit.set(team, 1 + .06 * (preference(moves.seed, row.id) === 'role' ? Math.min(1, gain / Math.max(.5, row.war2027 ?? 1)) : modes[team] === 'contend' ? 1 : modes[team] === 'middle' ? .5 : 0));
        const taste = .94 + .12 * draw(`${moves.seed}:${row.id}:${team}:taste`);
        const ceiling = Math.min(room, Math.max(.8, row.aav ?? .8) * 1.35, gain < .05 ? .8 : (gain * (modes[team] === 'contend' ? 14 : 11) + 5) * taste);
        if (ceiling < .8) continue;
        const annual = Math.max(.8, Math.floor(Math.min(ceiling, askAav * (.85 + .1 * draw(`${moves.seed}:${row.id}:${team}:closeout`))) * 10) / 10);
        // A big discount buys one year, not cheap control over a star's prime.
        const longTerm = Math.max(1, row.years ?? 1);
        const years = annual + 1e-9 >= closeoutMinimumAav(row, longTerm, moves.seed) ? longTerm : 1;
        if (annual + 1e-9 < closeoutMinimumAav(row, years, moves.seed)) continue;
        offers.push({ pid: row.id, team, years, total: cents(annual * years), closeout: true });
      }
      const user = next.market.bids.find(b => b.pid === row.id);
      if (user && next.signings.length < MAX_RIVAL_MLB_SIGNINGS && user.total / user.years + 1e-9 >= closeoutMinimumAav(row, user.years, moves.seed)) {
        offers.push({ ...user, team: moves.team, closeout: true });
        const gain = Math.max(0, allocate([...rosters[moves.team], ...entries]).total - war[moves.team]);
        fit.set(moves.team, 1 + .06 * (preference(moves.seed, row.id) === 'role' ? Math.min(1, gain / Math.max(.5, row.war2027 ?? 1)) : modes[moves.team] === 'contend' ? 1 : modes[moves.team] === 'middle' ? .5 : 0));
      }
      offers.sort((a, b) => b.total * fit.get(b.team) - a.total * fit.get(a.team) || draw(`${moves.seed}:${row.id}:${b.team}:tie`) - draw(`${moves.seed}:${row.id}:${a.team}:tie`));
      const best = offers[0];
      if (!best) {
        // Non-roster invitations do not create guaranteed MLB jobs, payroll,
        // or WAR. Only low-priced depth players enter this separate market.
        if ((row.aav ?? .8) <= 3 && (row.war2027 ?? 0) < 1) {
          const kind = entries[0]?.k ?? 'b';
          const destinations = clubs.filter(t => t !== moves.team && (next.market.invites ?? []).filter(d => d.team === t && ctx.players.find(p => p.pid === d.pid)?.k === kind).length < 3);
          destinations.sort((a,b) => {
            const depth = t => rosters[t].filter(p => p.k === kind).length + (next.market.invites ?? []).filter(d => d.team === t).length;
            return depth(a)-depth(b) || draw(`${moves.seed}:${row.id}:${a}:invite`)-draw(`${moves.seed}:${row.id}:${b}:invite`);
          });
          if (destinations.length) { next.market.invites = [...(next.market.invites ?? []), { pid: row.id, team: destinations[0] }]; continue; }
        }
        if (user) news.push(`${row.name} did not find a credible MLB offer with the right roster fit and budget. He remains available; your final offer was not accepted.`);
        continue;
      }
      if (best.team === moves.team) next.signings.push({ pid: best.pid, years: best.years, total: best.total, closeout: true });
      else next.market.deals.push({ ...best, round });
      if (best.team !== moves.team) counts[best.team]++;
      rosters[best.team].push(...entries);
      payroll[best.team] += best.total / best.years;
      war[best.team] = allocate(rosters[best.team]).total;
      news.push(`Market closeout: ${row.name} signed with ${ctx.sim.teams[best.team].name}, ${best.years} ${best.years === 1 ? 'year' : 'years'}, $${best.total.toFixed(1)}M.${best.team === moves.team ? ' You got him. His camp accepted your final offer.' : user ? ' He took another club’s final offer.' : ''}${best.years < (row.years ?? 1) ? ' He chose a shorter deal after the longer-term market fell short.' : best.total / best.years < askAav - .01 ? ' His asking price came down to meet the market.' : ' He accepted a final-market offer.'}`);
    }
    next.market.bids = [];
    if (next.market.invites?.length) news.push(`Depth market: ${next.market.invites.length} players accepted non-roster invitations. These are separate from MLB signings and add no projected MLB payroll or WAR.`);
  }
  return { moves: next, news };
}

export function standingPatMarket(ctx, moves) {
  let baseline = { team: moves.team, budget: moves.budget, seed: moves.seed, signings: [], trades: [], market: newMarket() };
  for (let i = 0; i < MARKET_ROUNDS; i++) baseline = advanceMarket(ctx, baseline).moves;
  return baseline;
}
