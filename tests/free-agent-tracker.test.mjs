import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const tracker = read('../app/data/free-agent-tracker.json');
const signings = read('../app/data/free-agent-signings.json');
const frozen = read('../public/research/fa-predictions-2026-27/predictions_frozen.json');
const key = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/gi, '').toLowerCase();

test('scored players carry the frozen R2 estimates unchanged', () => {
  const scored = tracker.players.filter(p => p.basis === 'scored');
  assert.equal(scored.length, frozen.predictions.length);
  for (const f of frozen.predictions) {
    const p = scored.find(r => key(r.name) === key(f.player));
    assert.ok(p, f.player);
    assert.deepEqual([p.rank, p.years, p.total, p.aav, p.age], [f.rank, f.years, f.total_musd, f.aav_musd, f.age_2027], f.player);
  }
});

test('every row is unique and priced rows are complete', () => {
  assert.equal(new Set(tracker.players.map(p => p.id)).size, tracker.players.length);
  for (const p of tracker.players) {
    assert.ok(['expected', 'option', 'stays', 'qo', 'unmodeled'].includes(p.market), p.name);
    if (p.market !== 'unmodeled') assert.ok(p.years >= 1 && p.total >= 0 && p.aav >= 0 && Number.isFinite(p.war2027), p.name);
  }
});

test('the tracker publishes no raw class-list notes or market values', () => {
  for (const p of tracker.players) for (const k of ['contract_note', 'market_values', 'note', 'fangraphsId']) assert.ok(!(k in p), `${p.name}: ${k}`);
});

test('every signing names a tracked player and a known outcome', () => {
  const names = new Set(tracker.players.map(p => key(p.name)));
  const outcomes = ['signed', 're-signed', 'extension', 'qo-accepted', 'option-exercised', 'option-declined', 'opted-out', 'opted-in', 'retired'];
  assert.match(signings.updated, /^\d{4}-\d{2}-\d{2}$/);
  for (const s of signings.entries) {
    assert.ok(names.has(key(s.player)), s.player);
    assert.ok(outcomes.includes(s.outcome), `${s.player}: ${s.outcome}`);
    assert.match(s.date, /^\d{4}-\d{2}-\d{2}$/);
    if (['signed', 're-signed', 'extension'].includes(s.outcome)) assert.ok(s.team && s.years >= 1 && s.total_musd > 0, s.player);
  }
  assert.equal(new Set(signings.entries.map(s => key(s.player))).size, signings.entries.length);
});
