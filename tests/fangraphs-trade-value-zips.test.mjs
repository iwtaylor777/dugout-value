import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parseTradeValueZiPS } from "../lib/fangraphs-trade-value-zips.mjs";

test("parses ranked future ZiPS rows from a Trade Value player block", () => {
  const html = `
    <div class="contract-container table-container table-green">
      <div class="table-title" id="table-title">#10 &#8212; <a href="https://www.fangraphs.com/players/cristopher-sanchez/20778/stats/pitching">Cristopher Sánchez</a>, PHI, SP</div>
      <table class="table-top"><tbody><tr><td id="out-fivewar-head">Five-Year WAR</td><td id="out-fivewar">20.3</td></tr></tbody></table>
      <table class="table-contract"><tbody>
        <tr class="table-row"><td>2027</td><td>30</td><td>5.0</td><td>$6.0M</td></tr>
        <tr class="table-row"><td>2028</td><td>31</td><td>4.6</td><td>$9.0M</td></tr>
      </tbody></table>
    </div>`;

  assert.deepEqual(parseTradeValueZiPS(html, "https://example.com"), [
    {
      fgId: "20778",
      name: "Cristopher Sánchez",
      team: "PHI",
      position: "SP",
      rank: 10,
      fiveYearWar: 20.3,
      projections: { 2027: 5, 2028: 4.6 },
      sourceUrl: "https://example.com",
    },
  ]);
});

test("the refreshed database carries all 50 published updates without double counting", async () => {
  const database = JSON.parse(
    await readFile(
      new URL("../app/data/player-database.json", import.meta.url),
      "utf8",
    ),
  );
  const updatedPlayers = database.players.filter(
    (player) => player.futureProjectionUpdate,
  );

  assert.equal(updatedPlayers.length, 50);
  assert.equal(
    new Set(
      updatedPlayers.map((player) => player.futureProjectionUpdate.rank),
    ).size,
    50,
  );
  for (const player of updatedPlayers.filter(
    (candidate) => candidate.kind === "mlb",
  )) {
    assert.equal(player.talentUpdate, undefined);
    for (const season of player.threeYearProjection.filter(
      (projection) => projection.year > database.meta.baseYear,
    )) {
      assert.equal(
        season.war,
        player.futureProjectionUpdate.projections[season.year],
      );
      assert.equal(season.inSeasonAdjustment, 0);
    }
  }
});
