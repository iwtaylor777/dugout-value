import assert from "node:assert/strict";
import test from "node:test";
import { rosterAssignmentsFromDepthChart } from "../lib/roster-position.mjs";

test("depth-chart assignments separate current position from eligibility", () => {
  const assignments = rosterAssignmentsFromDepthChart(
    [
      {
        type: "mlb-bn",
        role: "Bench",
        position: "1B",
        position1: "1B",
        mlbamid: 575929,
      },
      {
        type: "mlb-sl",
        role: "2",
        position: "CF",
        position1: "CF/2B/SS",
        mlbamid: 678882,
      },
    ],
    "BOS",
  );

  assert.deepEqual(assignments.get("575929"), {
    team: "BOS",
    depthPosition: "1B",
    eligiblePosition: "1B",
    playerName: undefined,
    playerId: "",
    age: null,
    serviceTime: 0,
    actualWar: 0,
    projectedWar: 0,
    activeRoster: true,
    priority: 95,
  });
  assert.deepEqual(assignments.get("678882"), {
    team: "BOS",
    depthPosition: "CF",
    eligiblePosition: "CF/2B/SS",
    playerName: undefined,
    playerId: "",
    age: null,
    serviceTime: 0,
    actualWar: 0,
    projectedWar: 0,
    activeRoster: true,
    priority: 100,
  });
});

test("generic bench and IL labels fall back to the first concrete eligible position", () => {
  const assignments = rosterAssignmentsFromDepthChart(
    [
      {
        type: "mlb-bn",
        role: "Bench",
        position: "INF/OF",
        position1: "2B/1B/3B",
        mlbamid: 663853,
      },
      {
        type: "il-pp",
        role: "10IL",
        position: "INF",
        position1: "SS/3B/2B",
        mlbamid: 691785,
      },
    ],
    "BOS",
  );

  assert.equal(assignments.get("663853").depthPosition, "2B");
  assert.equal(assignments.get("691785").depthPosition, "SS");
});

test("active roster assignments outrank lower-level duplicates", () => {
  const assignments = rosterAssignmentsFromDepthChart(
    [
      {
        type: "aaa-pp",
        position: "C",
        position1: "C",
        mlbamid: 123,
      },
      {
        type: "mlb-sl",
        position: "1B",
        position1: "1B",
        mlbamid: 123,
      },
    ],
    "BOS",
  );

  assert.equal(assignments.get("123").depthPosition, "1B");
});
