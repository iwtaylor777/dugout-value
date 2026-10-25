import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const execFileAsync = promisify(execFile);
const root = new URL("..", import.meta.url);
const snapshot = new URL("../public/research/snapshots/2026-10-17/", import.meta.url);

test("the published snapshot verifies and identifies July data separately from its October capture", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", snapshot), "utf8"));
  assert.equal(manifest.captureDate, "2026-10-17");
  assert.equal(manifest.sourceDataAsOf, "2026-07-31");
  assert.equal(manifest.modelVersion, "2026-10-17.1");
  assert.equal(manifest.capturedAt, "2026-10-17T22:08:55-04:00");
  const { stdout } = await execFileAsync(process.execPath, ["scripts/verify-research-snapshot.mjs", "2026-10-17"], { cwd: root });
  assert.match(stdout, /Verified dugout-value-2026-10-17/);
});

test("the verifier detects a changed bundled input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dugout-snapshot-"));
  try {
    await cp(snapshot, directory, { recursive: true });
    const file = join(directory, "lib/value-model.mjs");
    await writeFile(file, `${await readFile(file, "utf8")}\n// altered\n`);
    await assert.rejects(
      execFileAsync(process.execPath, [
        "scripts/verify-research-snapshot.mjs",
        "2026-10-17",
        "--dir",
        directory,
      ], { cwd: root }),
      /Integrity check failed for lib\/value-model\.mjs/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the replay command loads the bundled model and defaults", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/replay-research-snapshot.mjs", "2026-10-17", "mlb-665742"],
    { cwd: root },
  );
  const replay = JSON.parse(stdout);
  assert.equal(replay.player.name, "Juan Soto");
  assert.equal(replay.settings.valuationView, "offseason");
  assert.equal(replay.value.controlThrough, 2039);
});

test("replay rejects an unknown player and refuses altered bundled code", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dugout-replay-"));
  try {
    await cp(snapshot, directory, { recursive: true });
    await assert.rejects(
      execFileAsync(process.execPath, ["replay.mjs", "not-a-player"], { cwd: directory }),
      /Unknown player ID/,
    );
    const model = join(directory, "lib/value-model.mjs");
    await writeFile(model, `${await readFile(model, "utf8")}\n// altered\n`);
    await assert.rejects(
      execFileAsync(process.execPath, ["replay.mjs", "mlb-665742"], { cwd: directory }),
      /Integrity check failed for lib\/value-model\.mjs/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("an archived snapshot verifies against its own manifest version, not the live model version", async () => {
  const { TRADE_SHARE_MODEL_VERSION } = await import("../lib/trade-share.mjs");
  const manifest = JSON.parse(await readFile(new URL("manifest.json", snapshot), "utf8"));
  assert.notEqual(manifest.modelVersion, TRADE_SHARE_MODEL_VERSION);
  const directory = await mkdtemp(join(tmpdir(), "dugout-version-"));
  try {
    await cp(snapshot, directory, { recursive: true });
    const manifestPath = join(directory, "manifest.json");
    const edited = { ...manifest, modelVersion: TRADE_SHARE_MODEL_VERSION };
    await writeFile(manifestPath, JSON.stringify(edited, null, 2));
    await assert.rejects(
      execFileAsync(process.execPath, ["scripts/verify-research-snapshot.mjs", "2026-10-17", "--dir", directory], { cwd: root }),
      /Manifest model version does not match the bundled trade-share model/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
