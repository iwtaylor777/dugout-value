import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { applyPositionUsage, inningsToOuts, positionUsage } from '../scripts/refresh-depth-eligibility.mjs';
import { allocate, teamsFor, bestAdditions, rateAt, cbtHit, payrollAdjustment, payrollChange, MINIMUM_SALARY, POSITIONS, DEFAULT_TARGETS, MAX_CONVERTED_RELIEF_IP, MAX_NATIVE_RELIEF_IP, targetOf } from '../lib/depth-chart.mjs';
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const data = read('../app/data/depth-chart.json'), tracker = read('../app/data/free-agent-tracker.json'), signings = read('../app/data/free-agent-signings.json');
const h = (i, e, r, x) => ({ i, n: i, t: 'AAA', e, k: 'b', r, x });
const pit = (i, e, r, x) => ({ i, n: i, t: 'AAA', e, k: 'p', r, x });

test('MLB usage eligibility preserves contracts and projections, includes utility roles and marks missing samples', () => {
  const p = { ...h('one', ['CF', '3B'], 2, 500), pid: 'mlb-1', cb: 20, fs: { CF: 1, RF: 2 }, rd: 3 };
  const noData = { ...h('two', ['C'], 1, 100), pid: 'mlb-2' };
  const usage = { 'mlb-1': [{ pos: 'RF', outs: 300, games: 12, starts: 12 }, { pos: '2B', outs: 30, games: 10, starts: 0 }, { pos: 'CF', outs: 24, games: 1, starts: 1 }] };
  const result = applyPositionUsage({ players: [p, noData] }, usage);
  assert.deepEqual(result.depth.players[0], { ...p, e: ['RF', '2B'], eSource: 'mlb-2026' });
  assert.deepEqual(result.depth.players[1], { ...noData, eSource: 'listed-fallback' });
  assert.equal(result.matched, 1); assert.equal(result.fallback, 1);
  assert.equal(inningsToOuts('1065.1'), 3196);
  assert.throws(() => inningsToOuts('10.3'));
});

test('usage import rejects truncated, duplicate, and wrong-season responses', () => {
  const row = { season: '2026', player: { id: 1 }, position: { abbreviation: 'RF' }, stat: { innings: '75.0', gamesPlayed: 10, gamesStarted: 9 } };
  const response = rows => ({ stats: [{ group: { displayName: 'fielding' }, totalSplits: rows.length, splits: rows }] });
  assert.equal(positionUsage(response([row]))['mlb-1'][0].outs, 225);
  assert.throws(() => positionUsage(response([row, row])));
  assert.throws(() => positionUsage(response([{ ...row, season: '2025' }])));
  const partial = response([row]); partial.stats[0].totalSplits = 2;
  assert.throws(() => positionUsage(partial));
});

test('saved position usage replays exactly and corrects obsolete defensive positions', () => {
  const usage = read('../app/data/depth-position-usage.json');
  assert.equal(usage.meta.season, 2026);
  assert.deepEqual(applyPositionUsage(data, usage.players).depth, data);
  assert.deepEqual(data.players.find(p => p.n === 'Nick Castellanos').e, ['RF']);
  assert.deepEqual(data.players.find(p => p.n === 'Willson Contreras').e, ['1B']);
  assert.ok(data.players.find(p => p.n === 'Edmundo Sosa').e.includes('SS'));
});

test('every position fills to a full season, with replacement level for any gap', () => {
  const { team } = teamsFor(data.players, tracker, signings.entries);
  for (const t of data.teams) {
    const a = allocate(data.players.filter(p => team.get(p.i) === t.abbr));
    for (const pos of POSITIONS) {
      const s = a.positions[pos];
      assert.ok(Math.abs(s.filled + s.replacement - targetOf(pos)) < 1e-6, `${t.abbr} ${pos}`);
      assert.equal(s.over, 0, `${t.abbr} ${pos} overfilled`);
    }
    assert.ok(a.total > 10 && a.total < 70, `${t.abbr} ${a.total}`);
  }
});

test('players fill their own position by rate, then move down the spectrum and to DH', () => {
  const roster = [h('ss1', ['SS'], 4, 650), h('ss2', ['SS'], 3, 600), h('c1', ['C'], 2, 500)];
  const a = allocate(roster);
  assert.equal(a.positions.SS.rows[0].p.i, 'ss1');
  assert.equal(a.positions.SS.rows[0].pt, 650);
  assert.ok(a.positions['2B'].rows.some(r => r.p.i === 'ss2'), 'second shortstop moves to second base');
  assert.equal(a.positions.C.replacement, 183);
  assert.equal(a.positions.SS.rows.find(r => r.p.i === 'ss2').pt, 33);
});

test('locked playing time is kept exactly and moving a fielder to DH costs his positional adjustment', () => {
  const roster = [h('a', ['SS'], 4, 650), h('b', ['SS'], 3, 600)];
  const a = allocate(roster, { b: { pos: 'SS', pt: 400 } });
  assert.equal(a.positions.SS.rows.find(r => r.p.i === 'b').pt, 400);
  assert.equal(a.positions.SS.rows.find(r => r.p.i === 'a').pt, 283);
  assert.ok(rateAt(h('x', ['SS'], 4, 600), 'DH') < 4 - 2);
  assert.equal(rateAt(h('y', ['DH'], 2, 600), 'DH'), 2);
});

test('starters fill the rotation and spare innings go to the bullpen', () => {
  const roster = [1, 2, 3, 4, 5, 6].map(n => pit(`sp${n}`, ['SP'], 3, 180));
  const a = allocate(roster);
  assert.equal(a.positions.SP.filled, DEFAULT_TARGETS.SP);
  assert.equal(a.positions.RP.filled, 6 * 180 - DEFAULT_TARGETS.SP);
  assert.ok(a.positions.RP.rows.every(r => r.pt <= MAX_CONVERTED_RELIEF_IP));
});

test('automatic roles optimize the whole roster rather than committing the best flexible player first', () => {
  const flexible = h('flexible', ['1B', 'DH'], 3, 683), firstBase = h('first-base', ['1B'], 2.5, 683);
  const a = allocate([flexible, firstBase]);
  assert.equal(a.positions.DH.rows[0].p.i, flexible.i);
  assert.equal(a.positions['1B'].rows[0].p.i, firstBase.i);
  assert.ok(Math.abs(a.total - (3 + 2.5) * 683 / 600) < 1e-9);
});

test('optional negative-WAR depth stays unused; explicit user assignments still take effect', () => {
  const bad = h('negative', ['1B'], -1, 600);
  const a = allocate([bad]);
  assert.equal(a.total, 0);
  assert.deepEqual(a.unused, [bad]);
  const forced = allocate([bad], { negative: { pos: '1B', pt: 100 } });
  assert.equal(forced.positions['1B'].rows[0].pt, 100);
  assert.ok(forced.total < 0);
});

test('adding a reliever cannot displace better converted-starter innings and lower roster WAR', () => {
  const starters = [1, 2, 3, 4, 5, 6].map(n => pit(`sp${n}`, ['SP'], 3, 180));
  const base = allocate(starters), after = allocate([...starters, pit('reliever', ['RP'], 1, 69)]);
  assert.ok(after.total >= base.total - 1e-9);
  assert.ok(after.positions.RP.rows.filter(r => r.p.e.includes('SP')).every(r => r.pt <= MAX_CONVERTED_RELIEF_IP));
  for (const p of starters) {
    const innings = Object.values(after.positions).flatMap(s => s.rows).filter(r => r.p.i === p.i).reduce((sum, r) => sum + r.pt, 0);
    assert.ok(innings <= p.x + 1e-9);
  }
});

test('usage-verified fielders are not automatically taught new positions', () => {
  const abreu = data.players.find(p => p.n === 'Wilyer Abreu');
  const rafaela = data.players.find(p => p.n === 'Ceddanne Rafaela');
  const { team } = teamsFor(data.players, tracker, signings.entries);
  const roster = data.players.filter(p => team.get(p.i) === 'BOS'), automatic = allocate(roster);
  for (const p of [abreu, rafaela]) for (const [pos, slot] of Object.entries(automatic.positions)) {
    if (slot.rows.some(r => r.p.i === p.i)) assert.ok(pos === 'DH' || p.e.includes(pos), `${p.n} automatically moved to ${pos}`);
  }
  const manual = allocate(roster, { [abreu.i]: { pos: '1B', pt: 500 } });
  assert.equal(manual.positions['1B'].rows.find(r => r.p.i === abreu.i).pt, 500, 'explicit experiments remain possible');
});

test('RP-tagged bulk projections cannot bypass the automatic relief workload cap', () => {
  const houck = data.players.find(p => p.n === 'Tanner Houck');
  assert.ok(houck.e.includes('RP') && houck.x > MAX_NATIVE_RELIEF_IP);
  assert.equal(allocate([houck]).positions.RP.rows[0].pt, MAX_NATIVE_RELIEF_IP);
  assert.equal(allocate([houck], { [houck.i]: { pos: 'RP', pt: 111 } }).positions.RP.rows[0].pt, 111, 'manual workload overrides remain explicit');
});

test('adding real available players never reduces an automatic roster; input order is immaterial', () => {
  const { team, freeAgents } = teamsFor(data.players, tracker, signings.entries);
  const candidates = data.players.filter(p => freeAgents.has(p.i));
  // Cover every available free agent on three different rosters, plus every
  // club with the actual regression players from the market audit.
  const regressions = candidates.filter(p => ['Nick Castellanos', 'Enyel De Los Santos', 'Tyler Alexander', 'Rhys Hoskins'].includes(p.n));
  for (const t of data.teams) {
    const roster = data.players.filter(p => team.get(p.i) === t.abbr), before = allocate(roster);
    const sample = ['BOS', 'NYY', 'ATH'].includes(t.abbr) ? candidates : regressions;
    for (const p of sample) {
      const after = allocate([...roster, p]);
      assert.ok(after.total >= before.total - 1e-8, `${t.abbr} adding ${p.n}: ${before.total} → ${after.total}`);
      for (const slot of Object.values(after.positions)) assert.ok(slot.over < 1e-8);
    }
    assert.deepEqual(allocate([...roster].reverse()).positions, before.positions, `${t.abbr} order`);
  }
});

test('free agents leave their 2026 team and reported signings move them', () => {
  const skubal = data.players.find(p => p.n === 'Tarik Skubal');
  const before = teamsFor(data.players, tracker, []);
  assert.equal(before.team.get(skubal.i), null);
  assert.ok(before.freeAgents.has(skubal.i));
  const after = teamsFor(data.players, tracker, [{ player: 'Tarik Skubal', outcome: 'signed', team: 'NYM', years: 10, total_musd: 400, date: '2026-11-20' }]);
  assert.equal(after.team.get(skubal.i), 'NYM');
  assert.ok(!after.freeAgents.has(skubal.i));
  const acuna = data.players.find(p => p.n === 'Ronald Acuña Jr.');
  assert.equal(before.team.get(acuna.i), 'ATL', 'a likely-exercised club option keeps him in place');
});

test('a free agent adds less than his own WAR when he displaces someone', () => {
  const roster = [h('cf', ['CF'], 2, 650), ...['LF', 'RF', '1B', 'DH'].map(pos => h(pos, [pos], 3, 683))];
  const fa = h('fa', ['CF'], 4, 650);
  const [best] = bestAdditions(roster, {}, [fa]);
  // He takes 650 PA at 4 WAR/600; the incumbent keeps the other 33 and has nowhere else to play.
  assert.ok(Math.abs(best.gain - (4 * 650 + 2 * 33 - 2 * 650) / 600) < 1e-9, String(best.gain));
  assert.deepEqual(best.positions, ['CF']);
});

test('payroll changes add CBT hits for arrivals and subtract counted hits for departures', () => {
  const g = { ...h('g', ['SS'], 1, 600), t: 'AAA', cb: 20 }, o = { ...h('o', ['C'], 1, 600), t: 'AAA', cb: 8, co: 1 }, pre = h('pre', ['LF'], 1, 600);
  const fa = { ...h('fa', ['CF'], 1, 600), t: 'BBB', fa: 1 }, other = { ...h('x', ['RF'], 1, 600), t: 'BBB', cb: 12 };
  const fas = new Set(['fa']), aav = p => (p.i === 'fa' ? 15 : null);
  assert.equal(cbtHit(fa, fas, aav), 15);
  assert.equal(cbtHit(pre, fas, aav), MINIMUM_SALARY);
  const before = [g, o, pre];
  assert.equal(payrollChange(before, [g, o, pre, fa, other], fas, aav), 27);
  assert.equal(payrollChange(before, [pre], fas, aav), -20, 'a pending option was never counted');
  // A free agent who signs joins at his AAV; a counted player who leaves comes off.
  const teamOf = new Map([['g', null], ['o', 'AAA'], ['pre', 'AAA'], ['fa', 'AAA'], ['x', 'BBB']]);
  assert.equal(payrollAdjustment([g, o, pre, fa, other], 'AAA', teamOf, new Set(['fa']), aav), 15 - 20);
});

test('expired contracts outside the free-agent class leave the depth chart', () => {
  const { team } = teamsFor(data.players, tracker, signings.entries);
  const expired = data.players.filter(p => p.ex);
  assert.ok(expired.length > 0);
  for (const p of expired) assert.equal(team.get(p.i), null, p.n);
  const ohtani = data.players.filter(p => p.n === 'Shohei Ohtani');
  assert.equal(ohtani.length, 2);
  for (const p of ohtani) assert.equal(team.get(p.i), 'LAD');
});

test('every team has 2026 and 2027 CBT payroll estimates', () => {
  const pay = read('../app/data/team-payroll.json').cbt;
  for (const t of data.teams) {
    const x = pay.teams[t.abbr];
    assert.ok(x.cbt2026 > 50 && x.cbt2026 < 500 && x.cbt2027 > 50 && x.cbt2027 < 500, t.abbr);
    assert.ok(x.guaranteedAav2027 + x.arb2027 < x.cbt2027, t.abbr);
  }
  // Checked against the Red Sox's own payroll sheet ($268.4M) and MLB Trade Rumors' year-end figure ($268.2M).
  assert.ok(Math.abs(pay.teams.BOS.cbt2026 - 268.4) < 5);
});

test('a hitter listed at a position his projection does not assume is credited as a slightly below-average fielder there', () => {
  const mead = { ...h('m', ['2B'], 1.71, 513), d: -11.7, mp: '1B' };
  const adj2B = 2.5 * 600 / 683, runsPerWin = 9.82;
  assert.ok(Math.abs(rateAt(mead, '2B') - (1.71 + (adj2B - 3.5 + 11.7) / runsPerWin)) < 1e-9);
  assert.equal(rateAt(mead, '1B'), 1.71, 'his projected position is unchanged');
  assert.equal(rateAt(mead, 'SS'), 1.71, 'unlisted positions keep the projected rate');
  const good = { ...h('g', ['2B'], 3, 600), d: 5, mp: '3B' };
  assert.equal(rateAt(good, '2B'), 3, 'never lowered at a listed position');
  const ss = { ...h('s', ['SS'], 3, 600), d: 6, mp: 'SS' };
  assert.ok(Math.abs(rateAt(ss, 'DH') - (3 + (-17.5 * 600 / 683 - 6) / runsPerWin)) < 1e-9);
  const of = { ...h('o', ['CF'], 2, 600), d: -3, mp: 'OF' };
  assert.equal(rateAt(of, 'CF'), 2, 'outfield listings cover all three spots');
  const c = { ...h('c', ['C'], 1, 400), d: -10, mp: 'DH' };
  assert.equal(rateAt(c, 'C'), 1, 'no catcher credit is assumed');
});

test('with component projections, a slot swaps role defense for projected fielding plus positional value there', () => {
  const runsPerWin = 9.82, a600 = runs => runs * 600 / 683;
  const mead = { ...h('m', ['2B'], 1.71, 513), d: -11.7, mp: '1B', fs: { '1B': -3.6, '2B': -4.2, '3B': -4.8, SS: -5.7, LF: -2.6, CF: -4.6, RF: -2.6 }, rd: -6.7 };
  assert.ok(Math.abs(rateAt(mead, '2B') - (1.71 + (-4.2 + a600(2.5) + 6.7) / runsPerWin)) < 1e-9);
  assert.ok(Math.abs(rateAt(mead, 'DH') - (1.71 + 0.55 * (a600(-17.5) + 6.7) / runsPerWin)) < 1e-9, 'losses count at 55%');
  assert.equal(rateAt(mead, 'C'), 1.71, 'no recent catching: keep the projected rate');
  assert.ok(rateAt(mead, 'SS') > rateAt(mead, '2B'), 'shortstop adds positional value even with worse fielding');
});

test('2027 detail projections cover projected players with plausible values', () => {
  const detail = read('../app/data/dv-detail-2027.json').players;
  const dv = read('../app/data/dv-projections.json').players;
  const ids = Object.keys(detail);
  assert.ok(ids.length > 1000);
  for (const id of ids) {
    assert.ok(dv[id], id);
    const d = detail[id];
    if (d.wrc != null) {
      assert.ok(d.avg > 0.15 && d.avg < 0.35 && d.obp > d.avg && d.slg > d.avg && d.wrc > 30 && d.wrc < 220, id);
      if (d.fld != null) assert.ok(['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].includes(d.fpos) && Math.abs(d.fld) < 25, id);
    }
    if (d.fip != null) assert.ok(d.fip > 1.5 && d.fip < 7 && d.k > 5 && d.k < 45 && d.bb > 2 && d.bb < 20, id);
  }
});
