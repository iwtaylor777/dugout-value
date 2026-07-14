import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the trade builder", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Dugout Value/);
  assert.match(html, /Deadline trade lab/);
  assert.match(html, /Trade builder/);
  assert.match(html, /Value rankings/);
  assert.match(html, /Value by control year/);
  assert.match(html, /role="combobox"/);
  assert.doesNotMatch(html, /Locked provenance/);
});

test("keeps rankings, search, and the yearly chart in the client", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /Overall trade value rankings/);
  assert.match(page, /setRankingTeam/);
  assert.match(page, /className="picker-menu"/);
  assert.match(page, /event\.key === "Enter"/);
  assert.doesNotMatch(page, /showLedger/);
  assert.doesNotMatch(page, /<datalist/);
  assert.match(css, /\.workspace-tabs/);
  assert.match(css, /\.rankings-panel/);
  assert.match(css, /\.picker-menu/);
});
