import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync(new URL('../app/data/dv-war-hitters.json', import.meta.url)));

test('DV WAR changes only contact batting credit', () => {
  assert.equal(data.meta.fieldingCredit, 1);
  for (const rows of Object.values(data.seasons)) {
    assert.equal(new Set(rows.map(r => r.id)).size, rows.length);
    for (const r of rows) {
      assert.ok(r.pa >= 300);
      assert.ok(Number.isFinite(r.dvwar));
      assert.ok(Math.abs(r.dvwar - r.fwar - r.bip) < 0.00011);
      assert.equal('fld' in r, false);
    }
  }
});

test('frozen 2026 fielding standouts retain their full fielding credit', () => {
  const expected = new Map([[678882, 3.4894], [677951, 7.3511], [691718, 10.3817]]);
  for (const [id, war] of expected) assert.equal(data.seasons['2026'].find(r => r.id === id).dvwar, war);
});
