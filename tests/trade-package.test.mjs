import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_CASH_AMOUNT,
  normalizeCashAmount,
  packageConsolidation,
  packageRange,
  packageValue,
} from "../lib/trade-package.mjs";

test("cash adjustments are finite, nonnegative, bounded, and cent-precise", () => {
  assert.equal(normalizeCashAmount(-4), 0);
  assert.equal(normalizeCashAmount("not money"), 0);
  assert.equal(normalizeCashAmount(12.345), 12.35);
  assert.equal(normalizeCashAmount(MAX_CASH_AMOUNT + 1), MAX_CASH_AMOUNT);
});

test("cash adds dollar-for-dollar to package totals and ranges", () => {
  const values = {
    playerA: { total: 20, low: 15, high: 25 },
    playerB: { total: -3, low: -5, high: -1 },
  };

  assert.equal(packageValue(["playerA", "playerB"], 5, values), 22);
  assert.equal(packageValue(["playerA", "playerB"], 5, values, "low"), 15);
  assert.equal(packageValue(["playerA", "playerB"], 5, values, "high"), 29);
});

test("package ranges diversify player-specific risk but retain shared risk", () => {
  const values = {
    playerA: { total: 20, low: 10, high: 30 },
    playerB: { total: 20, low: 10, high: 30 },
  };

  const single = packageRange(["playerA"], 5, values);
  assert.deepEqual(single, { total: 25, low: 15, high: 35, sharedRisk: 0.4 });

  const pair = packageRange(["playerA", "playerB"], 5, values);
  const expectedWidth = Math.sqrt(0.4 * 20 ** 2 + 0.6 * (10 ** 2 + 10 ** 2));
  assert.equal(pair.total, 45);
  assert.equal(pair.low, 45 - expectedWidth);
  assert.equal(pair.high, 45 + expectedWidth);
  assert.ok(pair.low > 25, "downside should be narrower than summing both lows");
  assert.ok(pair.high < 65, "upside should be narrower than summing both highs");
});

test("flags a close quantity-for-headliner trade without changing its totals", () => {
  const values = {
    star: { total: 100 },
    prospectA: { total: 40 },
    prospectB: { total: 35 },
    prospectC: { total: 25 },
  };

  assert.deepEqual(
    packageConsolidation(
      ["star"],
      0,
      ["prospectA", "prospectB", "prospectC"],
      0,
      values,
    ),
    {
      headlinerSide: "left",
      headlinerId: "star",
      headlinerValue: 100,
      returningHeadlinerId: "prospectA",
      returningHeadlinerValue: 40,
    },
  );
  assert.equal(packageValue(["star"], 0, values), 100);
  assert.equal(
    packageValue(["prospectA", "prospectB", "prospectC"], 0, values),
    100,
  );
});

test("does not over-warn for one-for-one, modest, or clearly uneven trades", () => {
  const values = {
    star: { total: 100 },
    peer: { total: 90 },
    midA: { total: 30 },
    midB: { total: 25 },
    modest: { total: 40 },
    smallA: { total: 22 },
    smallB: { total: 18 },
  };

  assert.equal(packageConsolidation(["star"], 0, ["peer"], 10, values), null);
  assert.equal(
    packageConsolidation(["modest"], 0, ["smallA", "smallB"], 0, values),
    null,
  );
  assert.equal(
    packageConsolidation(["star"], 0, ["midA", "midB"], 0, values),
    null,
  );
});
