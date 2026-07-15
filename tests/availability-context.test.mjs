import assert from "node:assert/strict";
import test from "node:test";
import {
  activeAvailabilityByMlbId,
  availabilityRiskAdjustment,
} from "../lib/availability-context.mjs";

test("keeps only current active IL records", () => {
  const rows = [
    { xMLBAMID: 1, season: 2026, status: "Activated" },
    { xMLBAMID: 2, season: 2025, status: "60-Day IL" },
    { xMLBAMID: 3, season: 2026, status: "10-Day IL" },
    { xMLBAMID: 4, season: 2026, status: "15-Day IL" },
  ];
  const active = activeAvailabilityByMlbId(rows, 2026);

  assert.deepEqual([...active.keys()], ["3", "4"]);
});

test("widens uncertainty more for long-term and severe injuries", () => {
  const short = availabilityRiskAdjustment({
    status: "10-Day IL",
    injurySurgery: "Strained hamstring",
    latestUpdate: "Rehab assignment",
  });
  const uncertain = availabilityRiskAdjustment({
    status: "15-Day IL",
    injurySurgery: "Elbow inflammation",
    latestUpdate: "No timetable for return",
  });
  const severe = availabilityRiskAdjustment({
    status: "60-Day IL",
    injurySurgery: "Tommy John surgery",
    latestUpdate: "Out for 2026 season",
  });

  assert.equal(short, 4);
  assert.equal(uncertain, 8);
  assert.equal(severe, 14);
  assert.equal(availabilityRiskAdjustment({ status: "Activated" }), 0);
});
