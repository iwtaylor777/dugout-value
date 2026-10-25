import test from "node:test";
import assert from "node:assert/strict";
import { reconcilePlayerIdentities } from "../lib/refresh-identities.mjs";
import { reconcileMissingProspects, verifyRefreshEvidence } from "../lib/refresh-evidence.mjs";
import { mkdtemp, readFile, writeFile, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("provider transitions preserve earlier aliases without guessing from a name", () => {
  const prior = [{ id: "prospect-sa123", kind: "prospect", name: "Player", previousIds: ["prospect-old"] }];
  const next = [{ id: "mlb-42", kind: "mlb", name: "New spelling", fangraphsId: "99" }];
  const { players } = reconcilePlayerIdentities(prior, next, { providerLinks: [{ mlbamId: "42", fangraphsIds: ["sa123", "99"] }] });
  assert.deepEqual(players[0].previousIds, ["prospect-old", "prospect-sa123"]);
  assert.equal(reconcilePlayerIdentities(prior, [{ ...next[0], name: "Player" }]).transitions.length, 0);
});
test("ambiguous crosswalks fail instead of merging two players", () => {
  assert.throws(() => reconcilePlayerIdentities([{ id: "prospect-sa123", kind: "prospect" }], [
    { id: "mlb-1", fangraphsId: "sa123" }, { id: "mlb-2", fangraphsId: "sa123" },
  ]), /Ambiguous/);
});
test("retained grades keep their original source date and expire for later refreshes", () => {
  const prior = { id: "prospect-1", kind: "prospect", fv: "40", source: { refreshed: "2026-07-31" } };
  const registry = { validThrough: "2026-10-18", entries: [{ id: prior.id, action: "retain-grade", team: "CHW", effectiveDate: "2026-05-30" }] };
  const result = reconcileMissingProspects([prior], [], registry, "2026-10-18");
  assert.equal(result.players[0].source.refreshed, "2026-07-31");
  assert.equal(result.players[0].fv, "40");
  assert.equal(result.players[0].team, "CHW");
  assert.equal(result.players[0].refreshStatus, "retained-grade");
  assert.equal(reconcileMissingProspects([prior], [], registry, "2026-10-19").players.length, 0);
});
test("roster evidence verifies transaction identities and rejects tampered bytes", async () => {
  const source = new URL("../data/refresh-evidence/2026-10-18/", import.meta.url).pathname;
  const registry = JSON.parse(await readFile(new URL("../data/reviewed-roster-dispositions.json", import.meta.url)));
  await verifyRefreshEvidence(source, [registry]);
  const wrong = structuredClone(registry);
  wrong.entries[0].id = "mlb-wrong";
  await assert.rejects(verifyRefreshEvidence(source, [wrong]), /Transaction evidence mismatch/);
  const tmp = await mkdtemp(join(tmpdir(), "refresh-evidence-"));
  try {
    await cp(source, tmp, { recursive: true });
    await writeFile(join(tmp, "mlb-transactions.json"), "{}");
    await assert.rejects(verifyRefreshEvidence(tmp, [registry]), /checksum mismatch/);
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
