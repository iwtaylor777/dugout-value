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
  assert.match(html, /Neutral · no discount/);
  assert.match(html, /30<!-- -->% star premium/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /Cash sent \/ salary retained by/);
  assert.match(html, /Trade comparison scoreboard/);
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
  assert.match(page, /event\.key === "ArrowDown"/);
  assert.match(page, /event\.key === "ArrowUp"/);
  assert.match(page, /aria-activedescendant/);
  assert.doesNotMatch(page, /showLedger/);
  assert.doesNotMatch(page, /<datalist/);
  assert.match(css, /\.workspace-tabs/);
  assert.match(css, /\.rankings-panel/);
  assert.match(css, /\.picker-menu/);
});

test("keeps the audited navigation and model behavior explicit", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const model = await readFile(
    new URL("../lib/value-model.mjs", import.meta.url),
    "utf8",
  );
  const audit = await readFile(
    new URL("../docs/interaction-audit.md", import.meta.url),
    "utf8",
  );

  assert.match(page, /const openMethod/);
  assert.match(page, /getElementById\("methodology"\)/);
  assert.match(page, /scrollIntoView/);
  assert.match(page, /const swapTeams/);
  assert.match(page, /openPlayerEditor\(player\.id, true\)/);
  assert.match(model, /regularRosterWar: 0\.5/);
  assert.match(model, /relieverRosterWar: 0\.2/);
  assert.match(model, /timingPreference: 0/);
  assert.match(model, /starPremium: 30/);
  assert.match(model, /player\.role === "reliever"/);
  assert.match(page, /rosterContext/);
  assert.match(page, /Scouting risk/);
  assert.match(page, /Changes the range, not the FV median/);
  assert.match(page, /prospect-range-note/);
  assert.match(page, /Board rank/);
  assert.match(model, /prospectRankAdjustment/);
  assert.match(page, /Club control through/);
  assert.match(page, /Playing-time escalators use/);
  assert.match(page, /extra long-range uncertainty/);
  assert.match(page, /Contract path/);
  assert.match(page, /selected\.contractScenario\.options/);
  assert.match(page, /updateMlbSeasonAt/);
  assert.match(page, /Copy trade link/);
  assert.match(page, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(page, /navigator\.clipboard\?\.writeText/);
  assert.match(page, /document\.execCommand\("copy"\)/);
  assert.match(page, /decodeTradeState/);
  assert.match(page, /window\.history\.replaceState/);
  assert.match(page, /Tradeability/);
  assert.match(page, /Availability/);
  assert.match(page, /range widened, central WAR unchanged/);
  assert.match(page, /RosterResource injury report/);
  assert.match(page, /surplus value is unchanged/);
  assert.match(page, /tradeProtection/);
  assert.match(page, /Cash sent \/ salary retained by/);
  assert.match(page, /Reset to source/);
  assert.match(page, /Changing .* will clear that package/);
  assert.match(page, /setLeftCash/);
  assert.match(page, /packageConsolidation/);
  assert.match(page, /packageRange/);
  assert.match(page, /Package ranges keep 40% shared/);
  assert.match(page, /Package shape/);
  assert.match(page, /leftCash,/);
  assert.match(audit, /Navigate search with keyboard/);
  assert.match(audit, /Account for Rule 5 \/ 40-man pressure/);
  assert.match(audit, /Compare mutually exclusive contract paths/);
  assert.match(audit, /Copy a trade link \/ open a shared trade/);
  assert.match(audit, /Review trade protection/);
  assert.match(audit, /Add cash or retained salary/);
});
