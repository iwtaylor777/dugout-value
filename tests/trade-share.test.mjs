import assert from "node:assert/strict";
import test from "node:test";
import { decodeTradeState, encodeTradeState } from "../lib/trade-share.mjs";

test("round-trips a versioned trade with Unicode player data", () => {
  const state = {
    v: 1,
    leftTeam: "BOS",
    rightTeam: "NYM",
    leftIds: ["custom-jose"],
    rightIds: ["mlb-123"],
    leftCash: 12.5,
    rightCash: 0,
    overrides: [{ id: "custom-jose", name: "José Álvarez ⚾" }],
  };

  assert.deepEqual(decodeTradeState(encodeTradeState(state)), state);
});

test("rejects malformed and unsupported trade payloads", () => {
  assert.equal(decodeTradeState("not-valid-base64"), null);
  assert.equal(decodeTradeState(encodeTradeState({ v: 2 })), null);
  assert.equal(decodeTradeState("a".repeat(100_001)), null);
  assert.throws(
    () => encodeTradeState({ v: 1, note: "a".repeat(100_001) }),
    /too large/,
  );
});
