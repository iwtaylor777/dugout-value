import test from "node:test";
import assert from "node:assert/strict";
import ledger from "../app/data/ledger.json" with { type: "json" };
import database from "../app/data/player-database.json" with { type: "json" };
import { initialSettings, valuePlayer } from "../lib/value-model.mjs";
import { TRADE_SHARE_MODEL_VERSION } from "../lib/trade-share.mjs";

test("the ledger records only sourced historical moves with stable player IDs", () => {
  assert.equal(ledger.records.length, 2);
  assert.equal(ledger.playerDataAsOf, "2026-07-31");
  assert.ok(ledger.playerDataAsOf <= database.meta.refreshed);
  assert.equal(ledger.modelVersion, TRADE_SHARE_MODEL_VERSION);
  const byId = new Map(database.players.flatMap(player => [player.id, ...(player.previousIds ?? [])].map(id => [id, player])));
  const devers = ledger.records.find(record => record.slug === "devers-to-giants-2025");
  assert.equal(devers.date, "2025-06-15");
  assert.deepEqual(devers.sentByBoston.map(player => player.id), ["mlb-646240"]);
  assert.deepEqual(devers.sentBySanFrancisco.map(player => player.id), ["mlb-663855", "mlb-690986", "prospect-sa3025333", "prospect-sa3021530"]);
  for (const player of [...devers.sentByBoston, ...devers.sentBySanFrancisco]) {
    assert.equal(byId.get(player.id)?.name, player.name);
  }
  const soto = ledger.records.find(record => record.slug === "soto-mets-contract-2024");
  assert.equal(soto.date, "2024-12-11");
  assert.equal(soto.player.id, "mlb-665742");
  assert.equal(soto.guaranteeMillion, 765);
  assert.equal(soto.years, 15);
  assert.equal(soto.optionAfter, 2029);
  assert.equal(soto.voidCostMillion, 40);
  for (const record of ledger.records) {
    assert.ok(record.sources.length > 0);
    assert.ok(record.sources.every(source => source.url.startsWith("https://www.mlb.com/")));
  }
});

test("Soto's current model cases keep option paths separate", () => {
  const player = database.players.find(item => item.id === "mlb-665742");
  assert.ok(player?.contractScenario);
  const values = Object.fromEntries(player.contractScenario.options.map(option => [
    option.id,
    valuePlayer({ ...player, contractScenario: { ...player.contractScenario, selectedId: option.id } }, initialSettings, database),
  ]));
  assert.equal(values.option.valuationView, "offseason");
  assert.equal(values.walks.controlThrough, 2029);
  assert.equal(values.option.controlThrough, 2039);
  assert.equal(values.option.total, values.stays.total);
  assert.ok(values.walks.total > values.option.total);
  assert.ok(values.voided.total < values.option.total);
});
