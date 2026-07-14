import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_CASH_AMOUNT,
  normalizeCashAmount,
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
