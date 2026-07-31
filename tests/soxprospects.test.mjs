import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSoxProspects,
  soxGradeToFv,
} from "../lib/soxprospects.mjs";
import database from "../app/data/player-database.json" with { type: "json" };

test("converts SoxProspects grades to FV-style values", () => {
  assert.equal(soxGradeToFv(4), "40");
  assert.equal(soxGradeToFv(4.5), "45");
  assert.equal(soxGradeToFv(6), "60");
});

test("parses the current grade and keeps floor and ceiling separate", () => {
  const html = `
    <div>Last Rankings Update: 7/7/2026</div>
    <table>
      <tr>
        <td>1<br>(2)</td><td><a href="players/arias-franklin.htm"><img></a></td>
        <td><a href="players/arias-franklin.htm"><strong>Franklin<br>Arias</strong></a></td>
        <td>SS</td><td></td><td>20</td><td>2023 IFA</td><td>Early<br>2027</td>
        <td>.150</td><td>.250</td><td>.300</td><td>.550</td><td>1</td><td>20</td>
        <td>6<br>4.5-7</td>
      </tr>
      <tr>
        <td>4 (10)</td><td><a href="players/stale-photo-link.htm"><img></a></td>
        <td><a href="players/bennett-jake.htm"><strong>Jake Bennett</strong></a></td>
        <td>LHP</td><td></td><td>25</td><td>Trade</td><td>Now</td>
        <td>2.74</td><td>0.97</td><td>46</td><td>11</td><td>6.3</td><td>65.2</td>
        <td>5<br>4.5- 5.5</td>
      </tr>
    </table>`;

  const parsed = parseSoxProspects(html);
  assert.equal(parsed.rankingsDate, "2026-07-07");
  assert.deepEqual(parsed.prospects, [
    {
      slug: "arias-franklin",
      name: "Franklin Arias",
      rank: 1,
      position: "SS",
      age: 20,
      eta: 2027,
      grade: 6,
      fv: "60",
      floor: 4.5,
      ceiling: 7,
    },
    {
      slug: "bennett-jake",
      name: "Jake Bennett",
      rank: 4,
      position: "LHP",
      age: 25,
      eta: null,
      grade: 5,
      fv: "50",
      floor: 4.5,
      ceiling: 5.5,
    },
  ]);
});

test("the refreshed database applies SoxProspects grades without replacing global rank", () => {
  const graded = database.players.filter(
    (player) => player.team === "BOS" && player.soxProspects,
  );
  assert.equal(graded.length, database.meta.soxProspects.gradedPlayers);
  assert.ok(graded.length >= 30);

  const arias = graded.find((player) => player.name.trim() === "Franklin Arias");
  const eyanson = graded.find(
    (player) => player.name.trim() === "Anthony Eyanson",
  );
  const bennett = graded.find((player) => player.name.trim() === "Jake Bennett");
  const heyman = graded.find((player) => player.name.trim() === "Luke Heyman");

  assert.equal(arias.fv, "60");
  assert.equal(arias.rank, 2);
  assert.equal(arias.soxProspects.organizationRank, 1);
  assert.equal(eyanson.fv, "50");
  assert.equal(eyanson.rank, 27);
  assert.equal(bennett.lastProspect.fv, "50");
  assert.equal(heyman.fv, "40");
});
