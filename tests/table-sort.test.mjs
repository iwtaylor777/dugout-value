import test from "node:test";
import assert from "node:assert/strict";
import { compareTableValues } from "../lib/table-sort.mjs";

test("table sorting uses raw numbers and leaves missing values last in either direction", () => {
  const values = [null, 9, -1, 100, 0, NaN];
  assert.deepEqual([...values].sort((a, b) => compareTableValues(a, b, "ascending")), [-1, 0, 9, 100, null, NaN]);
  assert.deepEqual([...values].sort((a, b) => compareTableValues(a, b, "descending")), [100, 9, 0, -1, null, NaN]);
});
test("table text sorting supports both directions and equal values", () => {
  assert.ok(compareTableValues("Available", "Signed", "ascending") < 0);
  assert.ok(compareTableValues("Available", "Signed", "descending") > 0);
  assert.equal(compareTableValues(null, undefined), 0);
  assert.equal(compareTableValues(1.25, 1.25), 0);
});
