import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { allocate, teamsFor, bestAdditions, rateAt, POSITIONS, DEFAULT_TARGETS, targetOf } from '../lib/depth-chart.mjs';
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
