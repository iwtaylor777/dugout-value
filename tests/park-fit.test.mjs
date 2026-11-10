import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import data from "../app/data/park-fit.json" with { type: "json" };

const load = (year, id) => JSON.parse(readFileSync(new URL(`../public/data/park-fit/${year}-${id}.json`, import.meta.url)));

test("both Savant modes reconcile park totals with individual switches and wOBA", () => {
  assert.equal(data.players.length, 11);
  for (const year of data.seasons) {
    const parks = data.parks[year];
    const ids = parks.map(park => park.id);
    assert.equal(new Set(ids).size, 30);
    assert.ok(parks.every(park => park.distances.length === 5 && park.heights.length === 5));
    for (const player of data.players) {
      const profile = load(year, player.id);
      const home = ids.indexOf(profile.home);
      assert.ok(home >= 0);
      assert.ok(profile.homePa > 0 && profile.homePa <= profile.totalHomePa);
      assert.equal(new Set(profile.plays.map(play => play.id)).size, profile.plays.length);
      for (const mode of ["adjusted", "standard"]) {
        const snapshot = profile.modes[mode];
        assert.equal(snapshot.ranges.length, 435);
        assert.equal(snapshot.extraRanges.length, 435);
        for (const bounds of [...snapshot.ranges, ...snapshot.extraRanges]) {
          assert.ok(bounds.every(Number.isFinite) && bounds[0] <= bounds[1]);
        }
        const reference = snapshot.parks[home];
        for (const [i, park] of parks.entries()) {
          const target = snapshot.parks[i];
          const gain = profile.plays.reduce((net, play) => net + Number(play.clears[mode].includes(park.id)) - Number(play.clears[mode].includes(profile.home)), 0);
          assert.equal(target.hrFlags - reference.hrFlags, gain);
          assert.ok(Math.abs(target.hits[3] - reference.hits[3] - gain * 300 / profile.samplePa) < .00002, profile.name);
          const woba = (target.runs - reference.runs) * data.wobaScale / profile.wobaDen;
          assert.ok(Math.abs(woba - (target.woba - reference.woba)) < .000002);
        }
      }
      for (const play of profile.plays) {
        for (const probabilities of Object.values(play.inPlay)) {
          assert.equal(probabilities.length, 4);
          assert.ok(probabilities.every(p => p >= 0 && p <= 1));
          assert.ok(Math.abs(probabilities.reduce((sum, p) => sum + p, 0) - 1) <= .00021);
        }
      }
    }
  }
});

test("Suzuki’s Yankees replay retains the observed-trajectory sensitivity", () => {
  const profile = load(2026, "673548");
  const parks = data.parks[2026].map(park => park.id);
  assert.equal(profile.home, "chc");
  assert.deepEqual(profile.actual.slash.map(n => n.toFixed(3)), ["0.270", "0.368", "0.473"]);
  const hrDelta = mode => profile.modes[mode].parks[parks.indexOf("nyy")].hrFlags - profile.modes[mode].parks[parks.indexOf("chc")].hrFlags;
  assert.equal(hrDelta("adjusted"), -7);
  assert.equal(hrDelta("standard"), -1);
});
