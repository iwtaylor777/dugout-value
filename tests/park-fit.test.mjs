import assert from "node:assert/strict";
import test from "node:test";
import data from "../app/data/park-fit.json" with { type: "json" };

test("each park replay's home-run change agrees with its individual play switches", () => {
  const parkIds = data.parks.map(park => park.id);
  assert.equal(parkIds.length, 5);
  assert.equal(data.players.length, 11);
  for (const player of data.players) {
    assert.equal(new Set(player.plays.map(play => play.id)).size, player.plays.length);
    for (const play of player.plays) {
      assert.ok(play.clears.length > 0 && play.clears.length < parkIds.length);
      assert.ok(play.clears.every(park => parkIds.includes(park)));
      for (const park of parkIds.filter(park => !play.clears.includes(park))) {
        const chances = play.inPlay[park];
        assert.equal(chances.length, 4);
        assert.ok(chances.every(p => p >= 0 && p <= 1));
        assert.ok(Math.abs(chances.reduce((total, p) => total + p, 0) - 1) <= .00021);
      }
    }
    for (const park of parkIds) {
      const net = player.plays.reduce((n, play) => n + Number(play.clears.includes(park)) - Number(play.clears.includes("chc")), 0);
      const delta = player.parks[park].hits[3] - player.parks.chc.hits[3];
      assert.ok(Math.abs(delta - net * (data.referencePa / 2) / player.samplePa) < .00002, player.name);
    }
  }
});
