import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const tracker = read('../app/data/free-agent-tracker.json');
const signings = read('../app/data/free-agent-signings.json');
const frozen = read('../public/research/fa-predictions-2026-27/predictions_frozen.json');
const key = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/gi, '').toLowerCase();

test('current rows preserve the original R2 estimate in a separate record', () => {
  const scored = tracker.players.filter(p => p.publishedForecast);
  assert.equal(scored.length, frozen.predictions.length);
  for (const f of frozen.predictions) {
    const p = scored.find(r => key(r.name) === key(f.player));
    assert.ok(p, f.player);
    assert.deepEqual([p.publishedForecast.rank, p.publishedForecast.years, p.publishedForecast.total, p.publishedForecast.aav, p.age], [f.rank, f.years, f.total_musd, f.aav_musd, f.age_2027], f.player);
    assert.equal(p.basis,'live');
  }
});

test('every canonical player displays current WAR and the complete five-year horizon', () => {
  const dv=read('../app/data/dv-projections.json');
  for(const p of tracker.players)if(dv.players[p.id]&&p.total!=null) {
    assert.equal(p.war2027,dv.players[p.id].war['2027'],p.name);
    assert.deepEqual(p.warPath,JSON.parse(JSON.stringify(dv.players[p.id].war)),p.name);
  }
  const suzuki=tracker.players.find(p=>p.name==='Seiya Suzuki');
  assert.equal(suzuki.war2027,2.68);assert.equal(suzuki.years,4);assert.equal(suzuki.total,73.8);
  assert.equal(suzuki.marketForecast.reference.total,105);
  assert.equal(suzuki.marketForecast.consensus.total, 106.5);
  assert.deepEqual(suzuki.marketForecast.alternateValues, []);
  const rogers = tracker.players.find(p => p.name === 'Trevor Rogers');
  assert.deepEqual(rogers.marketForecast.consensus, {total: 109.5, minYears: 4, maxYears: 5, sourceCount: 2, singleSource: null});
  assert.deepEqual(rogers.marketForecast.alternateValues, [{years: 4, total: 63.9, aav: 16}]);
  const grisham = tracker.players.find(p => p.name === 'Trent Grisham');
  assert.equal(grisham.marketForecast.consensus.singleSource, 'FanGraphs — Ben Clemens');
  assert.equal(suzuki.publishedForecast.total,48.3);
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

test('every qualifying offer names a tracked player, his team and a known status', () => {
  const qo = signings.qualifying_offers;
  assert.ok(qo.amount_musd > 0);
  assert.match(qo.respond_by, /^\d{4}-\d{2}-\d{2}$/);
  for (const o of qo.players) {
    const p = tracker.players.find(r => key(r.name) === key(o.player));
    assert.ok(p, o.player);
    assert.equal(o.team, p.team, o.player);
    assert.ok(['pending', 'rejected'].includes(o.status), o.player);
  }
  assert.equal(new Set(qo.players.map(o => key(o.player))).size, qo.players.length);
});
