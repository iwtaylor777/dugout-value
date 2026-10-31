import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { allocate, teamsFor, bestAdditions, rateAt, cbtHit, payrollAdjustment, payrollChange, MINIMUM_SALARY, POSITIONS, DEFAULT_TARGETS, targetOf } from '../lib/depth-chart.mjs';
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const data = read('../app/data/depth-chart.json'), tracker = read('../app/data/free-agent-tracker.json'), signings = read('../app/data/free-agent-signings.json');
const h = (i, e, r, x) => ({ i, n: i, t: 'AAA', e, k: 'b', r, x });
const pit = (i, e, r, x) => ({ i, n: i, t: 'AAA', e, k: 'p', r, x });

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
  assert.ok(Math.abs(rateAt(mead, 'DH') - (1.71 + (a600(-17.5) + 6.7) / runsPerWin)) < 1e-9);
  assert.equal(rateAt(mead, 'C'), 1.71, 'no recent catching: keep the projected rate');
  assert.ok(rateAt(mead, 'SS') > rateAt(mead, '2B'), 'shortstop adds positional value even with worse fielding');
});
