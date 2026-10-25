import assert from "node:assert/strict";
import test from "node:test";

import {
  agingPositionGroup,
  agingProjectionSummary,
  empiricalRateChange,
  projectWithAging,
  projectWarWithAging,
} from "../lib/aging-curve.mjs";

test("classifies athletic defensive positions without treating every outfielder alike", () => {
  assert.equal(agingPositionGroup("SS"), "up-the-middle");
  assert.equal(agingPositionGroup("2B/SS"), "up-the-middle");
  assert.equal(agingPositionGroup("CF"), "up-the-middle");
  assert.equal(agingPositionGroup("C/1B"), "catcher");
  assert.equal(agingPositionGroup("LF/RF"), "corner");
});

test("the fallback decline steepens gradually instead of imposing an aging cliff", () => {
  assert.ok(
    empiricalRateChange("position", 35, "1B") >
      empiricalRateChange("position", 36, "1B"),
  );
  assert.ok(
    empiricalRateChange("position", 36, "SS") <
      empiricalRateChange("position", 36, "1B"),
  );
});

test("Lindor's extension follows the shape of a published rest-of-career ZiPS curve", () => {
  const priorProjection = { WAR: 4.6, PA: 633 };
  const baseProjection = { WAR: 3.56898, PA: 587 };
  const args = {
    baseProjection,
    priorProjection,
    baseAge: 34,
    role: "position",
    position: "SS",
  };

  assert.equal(projectWarWithAging({ ...args, yearsOut: 1 }), 2.9);
  assert.equal(projectWarWithAging({ ...args, yearsOut: 2 }), 2.2);
  assert.equal(projectWarWithAging({ ...args, yearsOut: 3 }), 1.6);

  const firstAddedYear = projectWithAging({ ...args, yearsOut: 1 });
  assert.equal(firstAddedYear.workload, 555.3);
  assert.equal(firstAddedYear.workloadScale, 0.946);

  const summary = agingProjectionSummary(args);
  assert.equal(summary.profile, "up-the-middle");
  assert.equal(summary.unitLabel, "600 PA");
  assert.equal(summary.rateTrend, -0.71);
  assert.equal(summary.workloadRetention, 0.927);
});

test("starter and reliever aging is normalized to role-appropriate workloads", () => {
  const starter = projectWarWithAging({
    baseProjection: { WAR: 3, IP: 180 },
    baseAge: 32,
    role: "starter",
    position: "SP",
    yearsOut: 1,
  });
  const reliever = projectWarWithAging({
    baseProjection: { WAR: 1, IP: 65 },
    baseAge: 32,
    role: "reliever",
    position: "RP",
    yearsOut: 1,
  });

  assert.equal(starter, 2.6);
  assert.equal(reliever, 0.9);
});

test("one extreme projection pair cannot dominate the long-range curve", () => {
  const summary = agingProjectionSummary({
    priorProjection: { WAR: 6, PA: 650 },
    baseProjection: { WAR: 0, PA: 300 },
    baseAge: 30,
    role: "position",
    position: "LF",
  });

  assert.equal(summary.rateTrend, -1);
  assert.equal(summary.workloadRetention, 0.85);
});
